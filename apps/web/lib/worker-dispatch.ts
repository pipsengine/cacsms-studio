export type WorkerJobType = "image" | "video" | "audio" | "render" | "publish";

export type AssetEngineId =
  | "script-writing"
  | "storyboard"
  | "image-generator"
  | "scene-video-generator"
  | "narration-generator"
  | "music-generator";

const orchestratorStageWorkers: Record<string, WorkerJobType> = {
  "visual-generation": "image",
  "audio-generation": "audio",
  assembly: "render",
  publishing: "publish"
};

const assetEngineWorkers: Record<AssetEngineId, WorkerJobType> = {
  "script-writing": "render",
  storyboard: "render",
  "image-generator": "image",
  "scene-video-generator": "video",
  "narration-generator": "audio",
  "music-generator": "audio"
};

export async function dispatchWorkerJob(input: {
  type: WorkerJobType;
  productionId: string;
  payload?: Record<string, unknown>;
}) {
  const baseUrl = process.env.CACSMS_WORKER_RUNTIME_URL ?? "http://127.0.0.1:3020";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${baseUrl}/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        type: input.type,
        productionId: input.productionId,
        payload: input.payload ?? {}
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Worker dispatch failed (${response.status})`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchOrchestratorStageJob(input: {
  productionId: string;
  stage: string;
  title?: string;
  productionType?: string;
}) {
  const type = orchestratorStageWorkers[input.stage];
  if (!type) return null;

  try {
    return await dispatchWorkerJob({
      type,
      productionId: input.productionId,
      payload: {
        stage: input.stage,
        title: input.title ?? null,
        productionType: input.productionType ?? null,
        source: "production-orchestrator"
      }
    });
  } catch (error) {
    console.warn("worker.dispatch.failed", {
      productionId: input.productionId,
      stage: input.stage,
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

export async function dispatchAssetEngineJob(input: {
  engine: AssetEngineId;
  productionId: string;
  title?: string | null;
  stage?: string | null;
  action?: string;
  metadata?: Record<string, unknown>;
}) {
  const type = assetEngineWorkers[input.engine];
  try {
    return await dispatchWorkerJob({
      type,
      productionId: input.productionId,
      payload: {
        engine: input.engine,
        title: input.title ?? null,
        stage: input.stage ?? null,
        action: input.action ?? "scheduler",
        source: "asset-engine",
        ...input.metadata
      }
    });
  } catch (error) {
    console.warn("worker.dispatch.asset-engine.failed", {
      engine: input.engine,
      productionId: input.productionId,
      message: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

export async function dispatchAssetEngineBatch(
  engine: AssetEngineId,
  productions: Array<{ id: string; title?: string | null; stage?: string | null }>,
  action = "scheduler"
) {
  const results = await Promise.allSettled(
    productions.map((production) =>
      dispatchAssetEngineJob({
        engine,
        productionId: production.id,
        title: production.title,
        stage: production.stage,
        action
      })
    )
  );
  return {
    dispatched: results.filter((result) => result.status === "fulfilled" && result.value).length,
    total: productions.length
  };
}

export async function dispatchSceneVideoJob(productionId: string, payload?: Record<string, unknown>) {
  return dispatchAssetEngineJob({
    engine: "scene-video-generator",
    productionId,
    metadata: payload
  });
}
