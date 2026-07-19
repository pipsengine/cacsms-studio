import fs from "node:fs";
import path from "node:path";
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
  const code = process.argv[2];
  if (!code) throw new Error("Usage: tsx scripts/reset-production-to-research.ts <production-code>");

  const pool = await getMssqlPool();
  try {
    await pool.request().input("code", code).query(`
      DECLARE @productionId uniqueidentifier = (
        SELECT ProductionId FROM cacsms.Productions WHERE Code = @code
      );
      IF @productionId IS NULL
        THROW 51000, 'Production not found.', 1;

      DELETE v FROM cacsms.ImageGenerationVariants v WHERE v.ProductionId = @productionId;
      DELETE a FROM cacsms.ImageGenerationAssets a WHERE a.ProductionId = @productionId;
      DELETE j FROM cacsms.ImageGenerationJobs j WHERE j.ProductionId = @productionId;
      DELETE r FROM cacsms.ScriptWritingRuns r WHERE r.ProductionId = @productionId;
      DELETE h FROM cacsms.ProductionStageHistory h WHERE h.ProductionId = @productionId;
      DELETE j FROM cacsms.RenderingJobs j WHERE j.ProductionId = @productionId;
      DELETE j FROM cacsms.PublishingJobs j WHERE j.ProductionId = @productionId;
      DELETE a FROM cacsms.AgentRuns a WHERE a.ProductionId = @productionId;

      UPDATE cacsms.Productions
      SET
        Stage = N'research',
        Status = N'active',
        Progress = 11,
        MetadataJson = JSON_MODIFY(
          JSON_MODIFY(
            JSON_MODIFY(
              JSON_MODIFY(ISNULL(MetadataJson, N'{}'), N'$.autonomousStoryboard', NULL),
              N'$.visualGeneration', NULL
            ),
            N'$.autonomousNarration', NULL
          ),
          N'$.autonomousMusic', NULL
        ),
        UpdatedAt = SYSUTCDATETIME()
      WHERE ProductionId = @productionId;

      INSERT cacsms.ProductionStageHistory(ProductionId, Stage, Status, Progress, Message)
      VALUES(@productionId, N'research', N'active', 11, N'Manual reset for fresh end-to-end pipeline run.');

      INSERT cacsms.AgentRuns(ProductionId, AgentName, AgentRole, TaskName, Status, QueueName, StartedAt, LastHeartbeatAt)
      VALUES
        (@productionId, N'Evidence Research Agent', N'research', N'Acquire and synthesize verified evidence', N'running', N'autonomous-production', SYSUTCDATETIME(), SYSUTCDATETIME()),
        (@productionId, N'Narrative Synthesis Agent', N'script', N'Generate production narrative', N'queued', N'autonomous-production', NULL, NULL),
        (@productionId, N'Story Architecture Agent', N'storyboard', N'Create adaptive story architecture', N'queued', N'autonomous-production', NULL, NULL),
        (@productionId, N'Multimodal Visual Agent', N'visual', N'Generate visual assets', N'queued', N'autonomous-production', NULL, NULL),
        (@productionId, N'Voice and Sound Agent', N'audio', N'Generate voice and soundscape', N'queued', N'autonomous-production', NULL, NULL),
        (@productionId, N'Timeline Assembly Agent', N'assembly', N'Assemble synchronized timeline', N'queued', N'autonomous-production', NULL, NULL),
        (@productionId, N'Autonomous QA Agent', N'quality', N'Run evidence, safety and quality gates', N'queued', N'autonomous-production', NULL, NULL),
        (@productionId, N'Distribution Agent', N'publishing', N'Optimize and distribute across channels', N'queued', N'autonomous-production', NULL, NULL);
    `);
    console.log(`Reset ${code} to research stage for fresh pipeline run.`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
