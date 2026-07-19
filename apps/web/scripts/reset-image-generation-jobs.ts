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
    await pool.request().query(`
      DELETE FROM cacsms.ImageGenerationVariants;
      DELETE FROM cacsms.ImageGenerationAssets;
      DELETE FROM cacsms.ImageGenerationJobs;
    `);
    console.log("Cleared autonomous image generation job, variant, and asset records.");
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
