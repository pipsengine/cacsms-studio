import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
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

export async function renderWithLocalImageModel(input: {
  prompt: string;
  width: number;
  height: number;
  seed: string;
}): Promise<LocalImageModelRender | null> {
  const command = process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND?.trim();
  if (!command) return null;

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

  const timeoutMs = Number(process.env.CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS ?? "120000");
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
    const dimensions = readPngDimensions(bytes);
    return {
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      averageLuma: averageLuma(bytes),
      checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
      provider: "cacsms-local-neural-image-runtime",
      model: process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME || "CACSMS Local Neural Image Model",
      method: "local executable neural inference"
    };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}
