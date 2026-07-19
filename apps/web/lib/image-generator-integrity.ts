export const IMAGE_GENERATION_STATES = [
  "Waiting for Inputs",
  "Queued",
  "Generating",
  "Uploading",
  "Persisting",
  "Validating",
  "Reviewing",
  "Revising",
  "Rejected",
  "Completed",
  "Blocked",
  "Failed"
] as const;

export type ImageGenerationState = (typeof IMAGE_GENERATION_STATES)[number];
export type BrowserLoadStatus = "pending" | "loaded" | "failed";

export type CompletedVariantIntegrity = {
  state: ImageGenerationState;
  assetId: string | null;
  assetUrl: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  browserLoadStatus: BrowserLoadStatus;
};

const stateProgressMap: Record<ImageGenerationState, number> = {
  "Waiting for Inputs": 4,
  Queued: 12,
  Generating: 28,
  Uploading: 44,
  Persisting: 58,
  Validating: 72,
  Reviewing: 84,
  Revising: 70,
  Rejected: 0,
  Completed: 100,
  Blocked: 0,
  Failed: 0
};

export function stateToProgress(state: ImageGenerationState) {
  return stateProgressMap[state];
}

export function isDevelopmentPreviewEnabled() {
  return process.env.NEXT_PUBLIC_CACSMS_IMAGE_GENERATOR_DEV_PREVIEW === "true";
}

export function createVisualAssetUrl(assetId: string) {
  return `/api/visuals/image-generator/assets/${assetId}`;
}

export function getCompletedVariantIntegrityErrors(variant: CompletedVariantIntegrity) {
  if (variant.state !== "Completed") return [];

  const errors: string[] = [];
  if (!variant.assetId) errors.push("Completed variants must reference a persisted asset ID.");
  if (!variant.assetUrl || !/^\/api\/visuals\/image-generator\/assets\/[0-9a-f-]+$/i.test(variant.assetUrl)) {
    errors.push("Completed variants must expose a loadable authenticated asset URL.");
  }
  if (!variant.fileSizeBytes || variant.fileSizeBytes <= 0) errors.push("Completed variants must have a non-zero persisted file size.");
  if (!variant.checksumSha256 || !/^[0-9a-f]{64}$/i.test(variant.checksumSha256)) {
    errors.push("Completed variants must include a SHA-256 checksum.");
  }
  if (!variant.width || variant.width <= 0 || !variant.height || variant.height <= 0) {
    errors.push("Completed variants must include valid image dimensions.");
  }
  if (!variant.mimeType || !/^image\/(png|webp)$/i.test(variant.mimeType)) {
    errors.push("Completed variants must persist a PNG or WebP MIME type.");
  }
  if (variant.browserLoadStatus !== "loaded") {
    errors.push("Completed variants must only be marked complete after the browser loads the asset URL.");
  }
  return errors;
}

export function validateServedImageResponse(response: {
  ok: boolean;
  contentType: string | null;
  byteLength: number;
  expectedMimeType: string;
}) {
  const errors: string[] = [];
  if (!response.ok) errors.push("The persisted asset URL did not return a successful response.");
  if (!response.contentType || !response.contentType.toLowerCase().startsWith(response.expectedMimeType.toLowerCase())) {
    errors.push("The persisted asset response returned an unexpected Content-Type.");
  }
  if (response.byteLength <= 0) {
    errors.push("The persisted asset response returned empty image bytes.");
  }
  return errors;
}
