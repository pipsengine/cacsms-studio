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
  const keepCode = process.argv[2] ?? null;
  const pool = await getMssqlPool();
  try {
    if (keepCode) {
      await pool.request().input("code", keepCode).query(`
        DELETE v FROM cacsms.ImageGenerationVariants v
        INNER JOIN cacsms.Productions p ON p.ProductionId = v.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE a FROM cacsms.ImageGenerationAssets a
        INNER JOIN cacsms.Productions p ON p.ProductionId = a.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE j FROM cacsms.ImageGenerationJobs j
        INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE r FROM cacsms.ScriptWritingRuns r
        INNER JOIN cacsms.Productions p ON p.ProductionId = r.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE d FROM cacsms.ProductionOrchestrationDecisions d
        INNER JOIN cacsms.Productions p ON p.ProductionId = d.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE h FROM cacsms.ProductionStageHistory h
        INNER JOIN cacsms.Productions p ON p.ProductionId = h.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE j FROM cacsms.RenderingJobs j
        INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE j FROM cacsms.PublishingJobs j
        INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE a FROM cacsms.AgentRuns a
        INNER JOIN cacsms.Productions p ON p.ProductionId = a.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE e FROM cacsms.CalendarEvents e
        INNER JOIN cacsms.Productions p ON p.ProductionId = e.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL AND p.Code <> @code;

        DELETE FROM cacsms.Productions
        WHERE AutonomousSourceRecordId IS NOT NULL AND Code <> @code;
      `);
      console.log(`Kept production ${keepCode}, removed the rest.`);
    }

    await pool.request().query(`
      UPDATE cacsms.ProductionOrchestrationSettings
      SET MaxConcurrentProductions = 1, UpdatedAt = SYSUTCDATETIME()
      WHERE WorkspaceId = (SELECT TOP (1) WorkspaceId FROM cacsms.Workspaces WHERE Status = N'active' ORDER BY CreatedAt);
    `);
    console.log("Set MaxConcurrentProductions = 1 for focused end-to-end runs.");

    const counts = await pool.request().query(`
      SELECT Code, Stage, Status, Progress
      FROM cacsms.Productions
      WHERE AutonomousSourceRecordId IS NOT NULL
      ORDER BY CreatedAt;
    `);
    console.log(JSON.stringify(counts.recordset, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch(console.error);
