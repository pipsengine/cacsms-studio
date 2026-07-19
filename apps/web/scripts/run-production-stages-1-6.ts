import fs from "node:fs";
import path from "node:path";
import { getMssqlPool } from "../lib/database/mssql";
import { runAutonomousProductionCycle } from "../lib/autonomous-production-orchestrator";
import { runScriptWritingScheduler } from "../lib/script-editor-engine";
import { runStoryboardScheduler } from "../lib/storyboard-engine";
import { runImageGenerationScheduler } from "../lib/image-generator-engine";
import { runNarrationScheduler } from "../lib/narration-engine";
import { runMusicScheduler } from "../lib/music-engine";
import { runSceneVideoScheduler } from "../lib/scene-video-engine";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const targetStages = ["research", "scripting", "storyboard", "visual-generation", "audio-generation", "assembly"] as const;
const stageIndex = (stage: string) => targetStages.indexOf(stage as (typeof targetStages)[number]);

async function latestProduction(pool: Awaited<ReturnType<typeof getMssqlPool>>) {
  const result = await pool.request().query(`
    SELECT TOP (1)
      CONVERT(nvarchar(36), p.ProductionId) productionId,
      p.Code code,
      p.Title title,
      p.Stage stage,
      p.Status status,
      p.Progress progress,
      j.State imageJobState,
      (SELECT COUNT(*) FROM cacsms.ImageGenerationVariants v WHERE v.ProductionId = p.ProductionId AND v.State = N'Completed') approvedVariants
    FROM cacsms.Productions p
    LEFT JOIN cacsms.ImageGenerationJobs j ON j.ProductionId = p.ProductionId
    WHERE p.AutonomousSourceRecordId IS NOT NULL
    ORDER BY p.CreatedAt DESC;
  `);
  return result.recordset[0] as
    | {
        productionId: string;
        code: string;
        title: string;
        stage: string;
        status: string;
        progress: number;
        imageJobState: string | null;
        approvedVariants: number;
      }
    | undefined;
}

async function logStatus(pool: Awaited<ReturnType<typeof getMssqlPool>>, label: string) {
  const production = await latestProduction(pool);
  if (!production) {
    console.log(`[${label}] No autonomous production yet.`);
    return null;
  }
  console.log(
    `[${label}] ${production.code} stage=${production.stage} status=${production.status} progress=${production.progress}% imageJob=${production.imageJobState ?? "none"} approvedVariants=${production.approvedVariants}`
  );
  return production;
}

async function runStageCycle(cycle: number, stage: string) {
  console.log(`--- Cycle ${cycle}: driving stage ${stage} ---`);
  if (stage === "research" || stage === "scripting") {
    await runScriptWritingScheduler();
    return;
  }
  if (stage === "storyboard") {
    await runStoryboardScheduler();
    return;
  }
  if (stage === "visual-generation") {
    await runImageGenerationScheduler();
    return;
  }
  if (stage === "audio-generation") {
    await runNarrationScheduler();
    await runMusicScheduler();
    await runSceneVideoScheduler();
    return;
  }
  await runAutonomousProductionCycle("manual-e2e", true);
}

async function main() {
  loadLocalEnv();
  const maxCycles = Number.parseInt(process.argv[2] ?? "120", 10);
  const pool = await getMssqlPool();

  try {
    console.log("Launching autonomous production from executive recommendations...");
    const launch = await runAutonomousProductionCycle("manual-e2e", true);
    console.log("Launch result:", launch);

    let production = await logStatus(pool, "launch");
    if (!production) {
      throw new Error("No production was created. Ensure executive recommendations are in Auto-executing status.");
    }

    for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
      production = (await logStatus(pool, `cycle-${cycle}-start`)) ?? production;
      const currentIndex = stageIndex(production.stage);
      if (currentIndex >= stageIndex("assembly")) {
        console.log(`Reached target stage ${production.stage}. End-to-end stages 1-6 complete for ${production.code}.`);
        break;
      }

      await runStageCycle(cycle, production.stage);

      if (production.stage === "visual-generation" || production.stage === "storyboard" || production.stage === "scripting") {
        await runAutonomousProductionCycle("manual-e2e", true);
      }

      production = (await logStatus(pool, `cycle-${cycle}-end`)) ?? production;
      if (stageIndex(production.stage) >= stageIndex("assembly")) {
        console.log(`Reached target stage ${production.stage}. End-to-end stages 1-6 complete for ${production.code}.`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await logStatus(pool, "final");
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
