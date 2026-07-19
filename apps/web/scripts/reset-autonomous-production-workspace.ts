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

function projectRoot() {
  if (process.env.CACSMS_PROJECT_ROOT) return process.env.CACSMS_PROJECT_ROOT;
  const cwd = process.cwd();
  if (cwd.endsWith(`${path.sep}apps${path.sep}web`)) {
    return path.resolve(cwd, "..", "..");
  }
  return cwd;
}

function removeDirectoryContents(dir: string) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    fs.rmSync(target, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

async function main() {
  loadLocalEnv();
  const pool = await getMssqlPool();
  const root = projectRoot();
  const generatedDirs = [
    path.join(root, ".generated", "visuals"),
    path.join(root, ".generated", "storyboard"),
    path.join(root, ".generated", "audio"),
    path.join(root, ".generated", "video")
  ];

  try {
    const counts = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM cacsms.Productions WHERE AutonomousSourceRecordId IS NOT NULL) autonomousProductions,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationVariants) imageVariants,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationAssets) imageAssets,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationJobs) imageJobs,
        (SELECT COUNT(*) FROM cacsms.ScriptWritingRuns) scriptRuns,
        (SELECT COUNT(*) FROM cacsms.ProductionScriptSections) scriptSections;
    `);
    const before = counts.recordset[0] as Record<string, number>;
    console.log("Before cleanup:", before);

    await pool.request().query(`
      DELETE v
      FROM cacsms.ImageGenerationVariants v
      INNER JOIN cacsms.Productions p ON p.ProductionId = v.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE a
      FROM cacsms.ImageGenerationAssets a
      INNER JOIN cacsms.Productions p ON p.ProductionId = a.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE j
      FROM cacsms.ImageGenerationJobs j
      INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE r
      FROM cacsms.ScriptWritingRuns r
      INNER JOIN cacsms.Productions p ON p.ProductionId = r.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE d
      FROM cacsms.ProductionOrchestrationDecisions d
      INNER JOIN cacsms.Productions p ON p.ProductionId = d.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      IF OBJECT_ID(N'cacsms.StoryStructureAutonomyDecisions', N'U') IS NOT NULL
      BEGIN
        DELETE d
        FROM cacsms.StoryStructureAutonomyDecisions d
        INNER JOIN cacsms.Productions p ON p.ProductionId = d.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL;
      END

      IF OBJECT_ID(N'cacsms.StoryStructures', N'U') IS NOT NULL
      BEGIN
        DELETE s
        FROM cacsms.StoryStructures s
        INNER JOIN cacsms.Productions p ON p.ProductionId = s.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL;
      END

      IF OBJECT_ID(N'cacsms.MultiFormatAutonomyDecisions', N'U') IS NOT NULL
      BEGIN
        DELETE d
        FROM cacsms.MultiFormatAutonomyDecisions d
        INNER JOIN cacsms.Productions p ON p.ProductionId = d.SourceProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL;
      END

      IF OBJECT_ID(N'cacsms.TemplateAutonomyDecisions', N'U') IS NOT NULL
      BEGIN
        DELETE d
        FROM cacsms.TemplateAutonomyDecisions d
        INNER JOIN cacsms.Productions p ON p.ProductionId = d.ProductionId
        WHERE p.AutonomousSourceRecordId IS NOT NULL;
      END

      DELETE h
      FROM cacsms.ProductionStageHistory h
      INNER JOIN cacsms.Productions p ON p.ProductionId = h.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE j
      FROM cacsms.RenderingJobs j
      INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE j
      FROM cacsms.PublishingJobs j
      INNER JOIN cacsms.Productions p ON p.ProductionId = j.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE a
      FROM cacsms.AgentRuns a
      INNER JOIN cacsms.Productions p ON p.ProductionId = a.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE e
      FROM cacsms.CalendarEvents e
      INNER JOIN cacsms.Productions p ON p.ProductionId = e.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL;

      DELETE FROM cacsms.Productions WHERE AutonomousSourceRecordId IS NOT NULL;
    `);

    const after = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM cacsms.Productions WHERE AutonomousSourceRecordId IS NOT NULL) autonomousProductions,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationVariants) imageVariants,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationAssets) imageAssets,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationJobs) imageJobs,
        (SELECT COUNT(*) FROM cacsms.ScriptWritingRuns) scriptRuns,
        (SELECT COUNT(*) FROM cacsms.ProductionScriptSections) scriptSections;
    `);
    console.log("After SQL cleanup:", after.recordset[0]);

    for (const dir of generatedDirs) {
      const removed = removeDirectoryContents(dir);
      console.log(`Cleared ${removed} item(s) from ${dir}`);
    }

    console.log("Autonomous production workspace reset complete.");
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
