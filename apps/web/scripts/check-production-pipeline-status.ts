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
  const pool = await getMssqlPool();
  try {
    const result = await pool.request().query(`
      SELECT p.Code, p.Stage, p.Status, p.Progress,
        j.State jobState, j.FailureReason, j.NextRecoveryAction,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationVariants v WHERE v.ProductionId = p.ProductionId) variants,
        (SELECT COUNT(*) FROM cacsms.ImageGenerationVariants v WHERE v.ProductionId = p.ProductionId AND v.State = N'Completed') approved,
        (SELECT COUNT(*) FROM cacsms.ScriptWritingRuns r WHERE r.ProductionId = p.ProductionId) scriptRuns,
        (SELECT TOP 1 r.Status FROM cacsms.ScriptWritingRuns r WHERE r.ProductionId = p.ProductionId ORDER BY r.CreatedAt DESC) scriptStatus
      FROM cacsms.Productions p
      LEFT JOIN cacsms.ImageGenerationJobs j ON j.ProductionId = p.ProductionId
      WHERE p.AutonomousSourceRecordId IS NOT NULL
      ORDER BY p.CreatedAt DESC;
    `);
    console.log(JSON.stringify(result.recordset, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch(console.error);
