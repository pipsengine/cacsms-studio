import fs from "node:fs";
import path from "node:path";
import { getMssqlPool } from "../lib/database/mssql";
import { runImageGenerationScheduler } from "../lib/image-generator-engine";
import { terminateOrphanedLocalImageRenders } from "../lib/local-image-model-runtime";

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
  const code = process.argv[2] ?? "AUTO-DFCB91A8E5";
  terminateOrphanedLocalImageRenders();

  const pool = await getMssqlPool();
  await pool.request().input("code", code).query(`
      UPDATE v
      SET v.State = N'Queued',
          v.FailureReason = NULL,
          v.StorageResult = N'Manual recovery reset a stale generating variant.',
          v.UpdatedAt = SYSUTCDATETIME()
      FROM cacsms.ImageGenerationVariants v
      INNER JOIN cacsms.Productions p ON p.ProductionId = v.ProductionId
      WHERE p.Code = @code AND v.State = N'Generating';

      UPDATE j
      SET j.State = N'Queued',
          j.FailureReason = NULL,
          j.NextRecoveryAction = N'Retry neural render after manual recovery.',
          j.StorageResult = N'Manual recovery reset a stale generating job.',
          j.UpdatedAt = SYSUTCDATETIME(),
          j.LastTransitionAt = SYSUTCDATETIME()
      FROM cacsms.ImageGenerationJobs j
      INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
      WHERE p.Code = @code AND j.State = N'Generating';

      UPDATE j
      SET j.State = N'Queued',
          j.FailureReason = NULL,
          j.NextRecoveryAction = N'Retry neural render after rejected-job recovery.',
          j.StorageResult = N'Manual recovery reopened a rejected job with queued variants.',
          j.UpdatedAt = SYSUTCDATETIME(),
          j.LastTransitionAt = SYSUTCDATETIME()
      FROM cacsms.ImageGenerationJobs j
      INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
      WHERE p.Code = @code
        AND j.State = N'Rejected'
        AND EXISTS (
          SELECT 1
          FROM cacsms.ImageGenerationVariants v
          WHERE v.ImageGenerationJobId = j.ImageGenerationJobId AND v.State = N'Queued'
        );

      UPDATE p
      SET p.Stage = N'visual-generation',
          p.Status = N'active',
          p.Progress = 70,
          p.UpdatedAt = SYSUTCDATETIME()
      FROM cacsms.Productions p
      WHERE p.Code = @code
        AND EXISTS (
          SELECT 1
          FROM cacsms.ImageGenerationJobs j
          WHERE j.ProductionId = p.ProductionId AND j.State IN (N'Queued', N'Generating', N'Revising')
        );
    `);
  console.log(`Recovered stuck image generation for ${code}.`);

  console.log("Running one image generation scheduler cycle...");
  await runImageGenerationScheduler();
  console.log("Scheduler cycle complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
