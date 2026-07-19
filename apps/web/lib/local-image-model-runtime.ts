import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { GeneratedPng } from "@/lib/image-generator-png";

export type LocalImageModelRender = GeneratedPng & {
  provider: string;
  model: string;
  method: string;
};

function parseArgs(template: string, values: Record<string, string>) {
  const matches = template.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return matches.map((arg) => {
    const unquoted = arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg;
    return unquoted.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  });
}

function averageLuma(bytes: Buffer) {
  let total = 0;
  let count = 0;
  for (let index = 0; index < bytes.length; index += 997) {
    total += bytes[index] ?? 0;
    count += 1;
  }
  return count ? Math.round(total / count) : 0;
}

function readPngDimensions(bytes: Buffer) {
  if (bytes.length < 24 || bytes.subarray(1, 4).toString("ascii") !== "PNG") {
    throw new Error("Local image model did not return a PNG file.");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") {
    execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => undefined);
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The process already exited.
    }
  }
}

function localImageDaemonUrl() {
  return process.env.CACSMS_LOCAL_IMAGE_DAEMON_URL?.trim() || "";
}

export function localImageRenderTimeoutMs() {
  return Number(process.env.CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS ?? "2700000");
}

export function terminateOrphanedLocalImageRenders() {
  if (process.platform !== "win32") return;
  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*render.py*' -and $_.CommandLine -notlike '*render_daemon.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ],
    { windowsHide: true },
    () => undefined
  );
}

function buildLocalImageModelRender(bytes: Buffer, method: string): LocalImageModelRender {
  const dimensions = readPngDimensions(bytes);
  return {
    bytes,
    width: dimensions.width,
    height: dimensions.height,
    averageLuma: averageLuma(bytes),
    checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
    provider: "cacsms-local-neural-image-runtime",
    model: process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME || "CACSMS Local Neural Image Model",
    method
  };
}

function requestDaemon(
  method: "GET" | "POST",
  targetUrl: string,
  timeoutMs: number,
  body?: Record<string, unknown>
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const payload = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: payload
          ? {
              "Content-Type": "application/json",
              Accept: "image/png, application/json",
              "Content-Length": payload.length
            }
          : {
              Accept: "application/json"
            },
        timeout: timeoutMs
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Local image render daemon timed out after ${timeoutMs}ms.`));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function renderWithLocalImageDaemon(input: {
  prompt: string;
  width: number;
  height: number;
  seed: string;
}): Promise<LocalImageModelRender> {
  const baseUrl = localImageDaemonUrl().replace(/\/$/, "");
  const timeoutMs = localImageRenderTimeoutMs();
  const { statusCode, headers, body } = await requestDaemon("POST", `${baseUrl}/render`, timeoutMs, input);

  if (statusCode === 409) {
    throw new Error("Local image render daemon is busy with another diffusion job.");
  }

  const contentType = String(headers["content-type"] || "");
  if (statusCode < 200 || statusCode >= 300) {
    if (contentType.includes("application/json")) {
      const payload = JSON.parse(body.toString("utf8")) as { message?: string };
      throw new Error(payload.message || `Local image render daemon failed (${statusCode}).`);
    }
    throw new Error(`Local image render daemon failed (${statusCode}).`);
  }

  const method = String(headers["x-cacsms-render-method"] || "warm local diffusion daemon inference");
  return buildLocalImageModelRender(body, method);
}

async function renderWithLocalImageProcess(input: {
  prompt: string;
  width: number;
  height: number;
  seed: string;
}): Promise<LocalImageModelRender> {
  const command = process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND?.trim();
  if (!command) {
    throw new Error("CACSMS_LOCAL_IMAGE_RENDER_COMMAND is not configured.");
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cacsms-image-model-"));
  const promptFile = path.join(tmp, "prompt.txt");
  const outputFile = path.join(tmp, "output.png");
  await fs.writeFile(promptFile, input.prompt, "utf8");

  const args = parseArgs(
    process.env.CACSMS_LOCAL_IMAGE_RENDER_ARGS ?? "--prompt-file {promptFile} --output {outputFile} --width {width} --height {height} --seed {seed}",
    {
      promptFile,
      outputFile,
      width: String(input.width),
      height: String(input.height),
      seed: input.seed
    }
  );

  const timeoutMs = localImageRenderTimeoutMs();
  const useWindowsCommandShell = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: process.env.CACSMS_LOCAL_IMAGE_MODEL_DIR || process.cwd(),
        env: {
          ...process.env,
          CACSMS_IMAGE_PROMPT_FILE: promptFile,
          CACSMS_IMAGE_OUTPUT_FILE: outputFile,
          CACSMS_IMAGE_WIDTH: String(input.width),
          CACSMS_IMAGE_HEIGHT: String(input.height),
          CACSMS_IMAGE_SEED: input.seed
        },
        shell: useWindowsCommandShell,
        windowsHide: true
      });
      let stderr = "";
      const timer = setTimeout(() => {
        killProcessTree(child.pid);
        reject(new Error(`Local image model timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk).slice(0, 2000);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Local image model exited with ${code}. ${stderr}`.trim()));
      });
    });

    const bytes = await fs.readFile(outputFile);
    return buildLocalImageModelRender(bytes, "local executable neural inference");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

let activeRender: Promise<LocalImageModelRender | null> | undefined;

async function executeLocalImageRender(input: {
  prompt: string;
  width: number;
  height: number;
  seed: string;
}): Promise<LocalImageModelRender | null> {
  const daemonUrl = localImageDaemonUrl();
  if (daemonUrl) {
    return renderWithLocalImageDaemon(input);
  }

  if (!process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND?.trim()) {
    return null;
  }

  return renderWithLocalImageProcess(input);
}

export async function renderWithLocalImageModel(input: {
  prompt: string;
  width: number;
  height: number;
  seed: string;
}): Promise<LocalImageModelRender | null> {
  while (activeRender) {
    await activeRender.catch(() => undefined);
  }

  const current = executeLocalImageRender(input);
  activeRender = current;
  try {
    return await current;
  } finally {
    if (activeRender === current) {
      activeRender = undefined;
    }
  }
}

export async function getLocalImageDaemonHealth(): Promise<{
  reachable: boolean;
  modelLoaded: boolean;
  activeRender: boolean;
  message: string;
}> {
  const daemonUrl = localImageDaemonUrl();
  if (!daemonUrl) {
    return {
      reachable: false,
      modelLoaded: false,
      activeRender: false,
      message: "Local image render daemon URL is not configured."
    };
  }

  try {
    const { statusCode, body } = await requestDaemon("GET", `${daemonUrl.replace(/\/$/, "")}/health`, 5_000);
    if (statusCode < 200 || statusCode >= 300) {
      return {
        reachable: true,
        modelLoaded: false,
        activeRender: false,
        message: `Daemon health check failed (${statusCode}).`
      };
    }
    const payload = JSON.parse(body.toString("utf8")) as {
      modelLoaded?: boolean;
      activeRender?: boolean;
      modelError?: string | null;
      status?: string;
    };
    return {
      reachable: true,
      modelLoaded: Boolean(payload.modelLoaded),
      activeRender: Boolean(payload.activeRender),
      message: payload.modelError || payload.status || "Daemon reachable."
    };
  } catch (error) {
    return {
      reachable: false,
      modelLoaded: false,
      activeRender: false,
      message: error instanceof Error ? error.message : "Daemon unreachable."
    };
  }
}
