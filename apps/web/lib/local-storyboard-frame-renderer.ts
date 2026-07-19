import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { renderWithLocalImageModel } from "@/lib/local-image-model-runtime";

export type LocalStoryboardFrameAsset = {
  assetId: string;
  url: string;
  mimeType: string;
  fileName: string;
  checksumSha256: string;
  fileSizeBytes: number;
  absolutePath: string;
  renderMode: "photoreal-human";
  source: "local";
};

function projectRoot() {
  if (process.env.CACSMS_PROJECT_ROOT) return process.env.CACSMS_PROJECT_ROOT;
  const cwd = process.cwd();
  const standaloneMarker = `${path.sep}apps${path.sep}web${path.sep}.next${path.sep}standalone${path.sep}apps${path.sep}web`;
  if (cwd.endsWith(standaloneMarker)) {
    return cwd.slice(0, -standaloneMarker.length);
  }
  return cwd;
}

export const LOCAL_STORYBOARD_FRAME_DIR = path.join(projectRoot(), ".generated", "storyboard");

export function storyboardFrameChecksum(bytes: Buffer) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function buildPhotorealStoryboardPrompt(input: {
  productionTitle: string;
  sceneTitle: string;
  shotTitle: string;
  framing: string;
  camera: string;
  visualFocus: string;
  summary: string;
}) {
  return [
    "Photorealistic documentary photograph of a contemporary corporate enterprise scene. Not an illustration, not a cartoon, not a flat vector graphic, not a 3D stylized render.",
    "Show diverse adult Nigerian or West African business professionals with natural dark-brown skin tones, realistic facial features, skin texture, hair, hands, and contemporary corporate clothing.",
    `Production context: ${input.productionTitle}.`,
    `Scene: ${input.sceneTitle}. Shot plan: ${input.shotTitle}.`,
    `Framing direction: ${input.framing}. Camera path: ${input.camera}. Visual focus: ${input.visualFocus}.`,
    input.summary,
    "Use a real camera capture aesthetic, medium-wide composition, readable environment, soft directional lighting, accurate anatomy, no watermark, no text artifacts, no celebrity likeness.",
    "Modern Lagos or Nigerian enterprise interiors when supported by the brief; polished cinematic corporate mood."
  ]
    .filter(Boolean)
    .join(" ");
}

/** @deprecated Use buildPhotorealStoryboardPrompt */
export function buildStoryboardFramePrompt(input: {
  productionTitle: string;
  sceneTitle: string;
  shotTitle: string;
  framing: string;
  camera: string;
  visualFocus: string;
}) {
  return buildPhotorealStoryboardPrompt({ ...input, summary: input.visualFocus });
}

export async function renderStoryboardPhotorealFrame(prompt: string, seed: string, width = 1280, height = 720) {
  const local = await renderWithLocalImageModel({ prompt, width, height, seed });
  if (!local) {
    throw new Error(
      "Photoreal storyboard frames require the local neural image model. Configure CACSMS_LOCAL_IMAGE_RENDER_COMMAND like the Image Generator workspace."
    );
  }
  return local;
}

export async function persistLocalStoryboardFrame(
  productionId: string,
  shotId: string,
  prompt: string,
  bytes: Buffer
): Promise<LocalStoryboardFrameAsset> {
  const digest = storyboardFrameChecksum(bytes);
  const assetId = crypto
    .createHash("sha256")
    .update(`storyboard:photoreal:${productionId}:${shotId}:${digest}`)
    .digest("hex")
    .slice(0, 32);
  const fileName = `frame-${assetId}.png`;
  const directory = path.join(LOCAL_STORYBOARD_FRAME_DIR, productionId);
  const absolutePath = path.join(directory, fileName);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(absolutePath, bytes);
  return {
    assetId,
    url: `/api/storyboard/storyboard-editor/assets/${assetId}`,
    mimeType: "image/png",
    fileName,
    checksumSha256: digest,
    fileSizeBytes: bytes.length,
    absolutePath,
    renderMode: "photoreal-human",
    source: "local"
  };
}

export async function readLocalStoryboardFrame(productionId: string, fileName: string, checksumSha256: string) {
  const bytes = await fs.readFile(path.join(LOCAL_STORYBOARD_FRAME_DIR, productionId, fileName));
  if (storyboardFrameChecksum(bytes) !== checksumSha256) {
    throw new Error("Storyboard frame checksum verification failed.");
  }
  return bytes;
}
