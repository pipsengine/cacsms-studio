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
      SELECT
        v.VariantNumber,
        v.State,
        v.RetryCount,
        LEFT(ISNULL(v.FailureReason, ''), 120) FailureReason,
        j.State jobState,
        CONVERT(nvarchar(40), j.UpdatedAt, 127) jobUpdatedAt,
        CONVERT(nvarchar(40), j.WorkerHeartbeatAt, 127) heartbeat
      FROM cacsms.ImageGenerationVariants v
      JOIN cacsms.ImageGenerationJobs j ON j.ImageGenerationJobId = v.ImageGenerationJobId
      JOIN cacsms.Productions p ON p.ProductionId = v.ProductionId
      WHERE p.Code = N'AUTO-DFCB91A8E5'
      ORDER BY v.VariantNumber;
    `);
    console.log(JSON.stringify(result.recordset, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch(console.error);
