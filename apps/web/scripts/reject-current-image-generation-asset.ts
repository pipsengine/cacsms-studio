import fs from "node:fs";
import path from "node:path";
import sql from "mssql";
import { getMssqlPool } from "../lib/database/mssql";

const DEFAULT_ASSET_ID = "A8B19F65-1283-F111-B837-C8CB9ED966CD";

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
  const assetId = process.argv[2] || DEFAULT_ASSET_ID;
  const now = new Date().toISOString();
  const rejectionReason =
    "Rejected - subject cropped, focal composition failed and character consistency below threshold.";
  const qualitySummary = {
    passed: false,
    quality: {
      brief: 88,
      humanPhotorealism: 86,
      facialRealism: 78,
      anatomy: 78,
      subjectDiversity: 72,
      lightingPerspective: 76,
      sharpnessResolution: 72,
      subjectVisibility: 35,
      identityConsistency: 45,
      geographicAccuracy: 70,
      culturalIntegrity: 70,
      brand: 84,
      composition: 35,
      technical: 74,
      originality: 82,
      safety: 92
    },
    defects: [
      "Face partially outside the frame.",
      "Incomplete head or body in the selected primary subject.",
      "Excessive blur reduces scene clarity.",
      "Insufficient clear subject-area coverage.",
      "No clear focal subject.",
      "Unexpected robotic or cybernetic facial features.",
      "Identity mismatch across variants.",
      "Scene-composition deviation from the persisted brief."
    ],
    recommendedState: "Rejected - subject cropped, focal composition failed and character consistency below threshold",
    nextWorkflow: [
      "Revising visual instructions",
      "Regenerating",
      "Validating humans",
      "Checking anatomy",
      "Checking originality",
      "Quality approved",
      "Completed"
    ],
    auditedAt: now
  };

  const pool = await getMssqlPool();
  try {
    const result = await pool
      .request()
      .input("assetId", sql.NVarChar(36), assetId)
      .input("reason", sql.NVarChar(2000), rejectionReason)
      .input("quality", sql.NVarChar(sql.MAX), JSON.stringify(qualitySummary))
      .input(
        "nextAction",
        sql.NVarChar(1000),
        "Revising visual instructions, regenerating with medium/medium-wide safe-area composition, validating humans, checking anatomy, checking originality, then re-running quality approval."
      )
      .input("storage", sql.NVarChar(400), `Rejected asset ${assetId} during mandatory composition and identity validation.`)
      .input(
        "revisionPrompt",
        sql.NVarChar(sql.MAX),
        [
          "Mandatory revision: generate a photorealistic medium or medium-wide image with the complete natural adult human subject centered inside the 10% safe area.",
          "Keep the full head, face, hands and upper body visible; avoid edge cropping and extreme close-up framing.",
          "Use moderate depth of field so the person and intended environment remain clear.",
          "Preserve a consistent synthetic identity across variants; do not introduce robotic, cyborg, mannequin or mechanical facial features.",
          "Resolve and enforce the scene locale profile, including country, region, city, environment, audience, clothing, architecture, signage, currency, climate and infrastructure.",
          `Rejected defects to correct: ${qualitySummary.defects.join(" ")}`
        ].join(" ")
      )
      .query<{ affectedVariants: number; affectedJobs: number }>(`
        DECLARE @variantIds TABLE (ImageGenerationVariantId uniqueidentifier, ImageGenerationJobId uniqueidentifier, ProductionId uniqueidentifier);

        INSERT @variantIds (ImageGenerationVariantId, ImageGenerationJobId, ProductionId)
        SELECT ImageGenerationVariantId, ImageGenerationJobId, ProductionId
        FROM cacsms.ImageGenerationVariants
        WHERE CONVERT(nvarchar(36), ImageGenerationAssetId)=@assetId;

        UPDATE v
        SET
          State=N'Rejected',
          FailureReason=@reason,
          StorageResult=@storage,
          QualityScore=55,
          QualitySummaryJson=@quality,
          UpdatedAt=SYSUTCDATETIME()
        FROM cacsms.ImageGenerationVariants v
        JOIN @variantIds x ON x.ImageGenerationVariantId=v.ImageGenerationVariantId;

        UPDATE j
        SET
          State=N'Revising',
          FailureReason=@reason,
          NextRecoveryAction=@nextAction,
          StorageResult=@storage,
          ModelResponseJson=@quality,
          WorkerHeartbeatAt=SYSUTCDATETIME(),
          UpdatedAt=SYSUTCDATETIME(),
          LastTransitionAt=SYSUTCDATETIME()
        FROM cacsms.ImageGenerationJobs j
        JOIN @variantIds x ON x.ImageGenerationJobId=j.ImageGenerationJobId;

        INSERT cacsms.ImageGenerationVariants (ProductionId, ImageGenerationJobId, VariantNumber, State, RenderPrompt, RetryCount)
        SELECT
          x.ProductionId,
          x.ImageGenerationJobId,
          ISNULL((SELECT MAX(v2.VariantNumber) FROM cacsms.ImageGenerationVariants v2 WHERE v2.ImageGenerationJobId=x.ImageGenerationJobId), 0) + 1,
          N'Queued',
          CONCAT(ISNULL((SELECT TOP(1) v3.RenderPrompt FROM cacsms.ImageGenerationVariants v3 WHERE v3.ImageGenerationVariantId=x.ImageGenerationVariantId), N''), N' ', @revisionPrompt),
          ISNULL((SELECT TOP(1) j2.RetryCount FROM cacsms.ImageGenerationJobs j2 WHERE j2.ImageGenerationJobId=x.ImageGenerationJobId), 0)
        FROM @variantIds x;

        UPDATE p
        SET
          Stage=N'visual-generation',
          Status=N'active',
          Progress=80,
          UpdatedAt=SYSUTCDATETIME()
        FROM cacsms.Productions p
        JOIN @variantIds x ON x.ProductionId=p.ProductionId;

        SELECT
          (SELECT COUNT(*) FROM @variantIds) AS affectedVariants,
          (SELECT COUNT(DISTINCT ImageGenerationJobId) FROM @variantIds) AS affectedJobs;
      `);
    const row = result.recordset[0] ?? { affectedVariants: 0, affectedJobs: 0 };
    if (!row.affectedVariants) throw new Error(`No image-generation variant found for asset ${assetId}.`);
    console.log(`Rejected asset ${assetId}; updated ${row.affectedVariants} variant(s) and ${row.affectedJobs} job(s).`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
