import fs from "node:fs";
import path from "node:path";
import sql from "mssql";
import { getMssqlPool } from "../lib/database/mssql";

const DEFAULT_PRODUCTION_ID = "5FCD6681-0681-F111-8DC2-0093372AF0A2";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadLocalEnv();
  const productionId = process.argv[2] || DEFAULT_PRODUCTION_ID;
  const prompt = [
    "Retest revision after stricter visual QA.",
    "Photorealistic documentary medium-wide photograph of contemporary Nigerian business professionals in a Lagos corporate AI operations office.",
    "One clear foreground adult professional centered inside the safe area, full natural unmasked face visible, complete head and upper body visible, natural skin texture, normal eyes, realistic hands using a laptop or workstation.",
    "AI appears only as software dashboards and analytics screens, never as robotic or cybernetic facial or body features.",
    "Modern corporate clothing only: blazer, shirt, business dress, smart-casual workwear. No mask, no helmet, no visor, no cybernetic face, no ceremonial attire, no festival clothing, no default traditional costume.",
    "Moderate depth of field, readable Lagos corporate interior, realistic lighting, grounded shadows, no foreign signage, no watermarks or logos."
  ].join(" ");

  const pool = await getMssqlPool();
  try {
    const result = await pool
      .request()
      .input("productionId", sql.NVarChar(36), productionId)
      .input("prompt", sql.NVarChar(sql.MAX), prompt)
      .query<{ variantId: string; variantNumber: number }>(`
        DECLARE @jobId uniqueidentifier = (
          SELECT TOP(1) ImageGenerationJobId
          FROM cacsms.ImageGenerationJobs
          WHERE CONVERT(nvarchar(36), ProductionId)=@productionId
          ORDER BY CreatedAt DESC
        );

        IF @jobId IS NULL
          THROW 51000, 'No image-generation job exists for the requested production.', 1;

        DECLARE @variantNumber int = (
          SELECT ISNULL(MAX(VariantNumber), 0) + 1
          FROM cacsms.ImageGenerationVariants
          WHERE ImageGenerationJobId=@jobId
        );

        DECLARE @created TABLE (variantId nvarchar(36), variantNumber int);

        INSERT cacsms.ImageGenerationVariants (ProductionId, ImageGenerationJobId, VariantNumber, State, RenderPrompt, RetryCount)
        OUTPUT CONVERT(nvarchar(36), inserted.ImageGenerationVariantId), inserted.VariantNumber INTO @created(variantId, variantNumber)
        VALUES (CONVERT(uniqueidentifier, @productionId), @jobId, @variantNumber, N'Queued', @prompt, 0);

        UPDATE cacsms.ImageGenerationJobs
        SET State=N'Revising',
            RetryCount=0,
            FailureReason=NULL,
            NextRecoveryAction=N'Complete retest: regenerate, validate humans, check composition, check culture, then approve only if all gates pass.',
            StorageResult=N'Retest variant queued without erasing rejection history.',
            WorkerHeartbeatAt=SYSUTCDATETIME(),
            UpdatedAt=SYSUTCDATETIME(),
            LastTransitionAt=SYSUTCDATETIME()
        WHERE ImageGenerationJobId=@jobId;

        UPDATE cacsms.Productions
        SET Stage=N'visual-generation',
            Status=N'active',
            Progress=70,
            UpdatedAt=SYSUTCDATETIME()
        WHERE CONVERT(nvarchar(36), ProductionId)=@productionId;

        SELECT TOP(1) variantId, variantNumber FROM @created;
      `);
    const row = result.recordset[0];
    console.log(`Queued retest variant ${row.variantNumber}: ${row.variantId}`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
