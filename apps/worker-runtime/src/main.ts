#!/usr/bin/env node
/**
 * Worker runtime for long-running media tasks outside Next.js.
 */
import { createServer } from "node:http";

type WorkerJobType = "image" | "video" | "audio" | "render" | "publish";

type WorkerJob = {
  id: string;
  type: WorkerJobType;
  productionId: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "completed" | "failed";
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

const queue: WorkerJob[] = [];
const completed: WorkerJob[] = [];
const activeKeys = new Set<string>();
const port = Number(process.env.CACSMS_WORKER_PORT ?? 3020);
const pollMs = Number(process.env.CACSMS_WORKER_POLL_MS ?? 2000);

function jobKey(job: Pick<WorkerJob, "type" | "productionId" | "payload">) {
  const engine = typeof job.payload.engine === "string" ? job.payload.engine : "";
  const action = typeof job.payload.action === "string" ? job.payload.action : "";
  return `${job.type}:${job.productionId}:${engine}:${action}`;
}

function enqueue(job: Omit<WorkerJob, "status" | "queuedAt" | "startedAt" | "completedAt" | "error">) {
  const key = jobKey(job);
  if (activeKeys.has(key)) {
    return { duplicate: true as const, job: null };
  }

  const entry: WorkerJob = {
    ...job,
    status: "queued",
    queuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null
  };
  queue.push(entry);
  activeKeys.add(key);
  console.log(
    `[worker-runtime] queued ${entry.type} job ${entry.id} for production ${entry.productionId}` +
      (entry.payload.engine ? ` (${entry.payload.engine})` : "")
  );
  return { duplicate: false as const, job: entry };
}

async function processJob(job: WorkerJob) {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  const engine = typeof job.payload.engine === "string" ? job.payload.engine : job.type;
  console.log(`[worker-runtime] processing ${engine} / ${job.type} job ${job.id}`);

  const duration =
    job.type === "render" ? 1200 : job.type === "video" ? 1000 : job.type === "image" ? 900 : 750;
  await new Promise((resolve) => setTimeout(resolve, duration));

  job.status = "completed";
  job.completedAt = new Date().toISOString();
  completed.unshift(job);
  if (completed.length > 100) completed.pop();
  activeKeys.delete(jobKey(job));
  console.log(`[worker-runtime] completed ${engine} job ${job.id}`);
}

setInterval(() => {
  if (!queue.length) return;
  const job = queue.shift();
  if (!job) return;
  void processJob(job).catch((error) => {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Worker failure";
    job.completedAt = new Date().toISOString();
    completed.unshift(job);
    activeKeys.delete(jobKey(job));
    console.error(`[worker-runtime] failed ${job.type} job ${job.id}`, job.error);
  });
}, pollMs);

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", queued: queue.length, completed: completed.length, activeKeys: activeKeys.size }));
    return;
  }

  if (url.pathname === "/v1/jobs" && request.method === "POST") {
    const body = await new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    const parsed = JSON.parse(body) as {
      id: string;
      type: WorkerJobType;
      productionId: string;
      payload?: Record<string, unknown>;
    };
    const result = enqueue({
      id: parsed.id,
      type: parsed.type,
      productionId: parsed.productionId,
      payload: parsed.payload ?? {}
    });
    if (result.duplicate) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "duplicate", queueLength: queue.length }));
      return;
    }
    response.writeHead(202, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "queued", job: result.job, queueLength: queue.length }));
    return;
  }

  if (url.pathname === "/v1/jobs" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        queued: queue.slice(0, 20),
        completed: completed.slice(0, 20),
        counts: { queued: queue.length, completed: completed.length, activeKeys: activeKeys.size }
      })
    );
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ message: "Not found" }));
}).listen(port, () => {
  console.log(`CACSMS worker runtime listening on http://127.0.0.1:${port}`);
});
