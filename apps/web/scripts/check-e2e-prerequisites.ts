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
      SELECT COUNT(*) cnt
      FROM cacsms.OpportunityOperationalRecords
      WHERE PageSlug = N'executive-recommendations' AND Status = N'Auto-executing';

      SELECT TOP (5) Title, Status, Score
      FROM cacsms.OpportunityOperationalRecords
      WHERE PageSlug = N'executive-recommendations'
      ORDER BY Score DESC;

      SELECT TOP (1) AutoAdvanceEnabled
      FROM cacsms.ProductionLifecycleSettings s
      JOIN cacsms.Workspaces w ON w.WorkspaceId = s.WorkspaceId
      WHERE w.Status = N'active'
      ORDER BY w.CreatedAt;
    `);
    console.log(JSON.stringify(result.recordsets, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch(console.error);
