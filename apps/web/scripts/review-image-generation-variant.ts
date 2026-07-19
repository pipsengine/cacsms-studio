import fs from "node:fs";
import path from "node:path";
import sql from "mssql";
import { getMssqlPool } from "../lib/database/mssql";

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
  const variantId = process.argv[2];
  const assetId = process.argv[3];
  if (!variantId || !assetId) throw new Error("Usage: tsx scripts/review-image-generation-variant.ts <variantId> <assetId>");

  const pool = await getMssqlPool();
  try {
    await pool
      .request()
      .input("variantId", sql.NVarChar(36), variantId)
      .input("assetId", sql.NVarChar(36), assetId)
      .query(`
        DECLARE @jobId uniqueidentifier;
        DECLARE @productionId uniqueidentifier;

        SELECT @jobId=ImageGenerationJobId, @productionId=ProductionId
        FROM cacsms.ImageGenerationVariants
        WHERE CONVERT(nvarchar(36), ImageGenerationVariantId)=@variantId;

        IF @jobId IS NULL
          THROW 51000, 'Variant not found.', 1;

        UPDATE cacsms.ImageGenerationAssets
        SET BrowserLoadStatus=N'loaded',
            BrowserLoadedAt=SYSUTCDATETIME(),
            AvailabilityStatus=N'available',
            AvailabilityCheckedAt=SYSUTCDATETIME(),
            UpdatedAt=SYSUTCDATETIME()
        WHERE CONVERT(nvarchar(36), ImageGenerationAssetId)=@assetId;

        UPDATE cacsms.ImageGenerationVariants
        SET State=N'Reviewing',
            FailureReason=NULL,
            StorageResult=N'Reopened for corrected quality-gate review.',
            UpdatedAt=SYSUTCDATETIME()
        WHERE CONVERT(nvarchar(36), ImageGenerationVariantId)=@variantId;

        UPDATE cacsms.ImageGenerationJobs
        SET State=N'Reviewing',
            RetryCount=0,
            FailureReason=NULL,
            NextRecoveryAction=N'Run corrected quality gates and approve only if all mandatory checks pass.',
            StorageResult=N'Reopened variant for corrected quality-gate review.',
            WorkerHeartbeatAt=SYSUTCDATETIME(),
            UpdatedAt=SYSUTCDATETIME(),
            LastTransitionAt=SYSUTCDATETIME()
        WHERE ImageGenerationJobId=@jobId;

        UPDATE cacsms.Productions
        SET Stage=N'visual-generation',
            Status=N'in-review',
            Progress=84,
            UpdatedAt=SYSUTCDATETIME()
        WHERE ProductionId=@productionId;
      `);
    console.log(`Reopened variant ${variantId} for review.`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
