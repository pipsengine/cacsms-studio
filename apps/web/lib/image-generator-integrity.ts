import zlib from "node:zlib";

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

export type TechnicalImageValidation = {
  mimeTypeValid: boolean;
  fileSizeValid: boolean;
  decodable: boolean;
  width: number | null;
  height: number | null;
  dimensionsValid: boolean;
  expectedDimensionsValid: boolean;
  hasAlpha: boolean;
  fullyTransparent: boolean;
  nearUniform: boolean;
  oneColor: boolean;
  pixelVariance: number;
  dominantColorPercentage: number;
  checksumCreatable: boolean;
  thumbnailCreatable: boolean;
  passed: boolean;
  reasons: string[];
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paethPredictor(left: number, above: number, upperLeft: number) {
  const p = left + above - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - above);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return above;
  return upperLeft;
}

function decodePngRgba(bytes: Buffer) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("The supplied bytes are not a valid PNG image.");
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error("The PNG color profile is not supported for technical validation.");
  }

  const channels = colorType === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      throw new Error("The PNG is truncated.");
    }
    if (type === "IDAT") {
      idat.push(bytes.subarray(dataStart, dataEnd));
    }
    offset = dataEnd + 4;
    if (type === "IEND") break;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source++];
    const rowStart = y * stride;
    const prevRowStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[source++];
      const left = x >= channels ? rgba[y * width * 4 + (x - channels) / channels * 4 + (x % channels)] ?? 0 : 0;
      const above =
        y > 0 ? rgba[(y - 1) * width * 4 + Math.floor(x / channels) * 4 + (x % channels)] ?? 0 : 0;
      const upperLeft =
        y > 0 && x >= channels
          ? rgba[(y - 1) * width * 4 + Math.floor((x - channels) / channels) * 4 + (x % channels)] ?? 0
          : 0;
      let decoded = value;
      if (filter === 1) decoded = (value + left) & 255;
      else if (filter === 2) decoded = (value + above) & 255;
      else if (filter === 3) decoded = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) decoded = (value + paethPredictor(left, above, upperLeft)) & 255;
      const pixelIndex = y * width * 4 + Math.floor(x / channels) * 4;
      const channelIndex = x % channels;
      rgba[pixelIndex + channelIndex] = decoded;
      if (channels === 3) {
        rgba[pixelIndex + 3] = 255;
      }
    }
  }

  return { width, height, rgba, hasAlpha: channels === 4 };
}

export function validateTechnicalImageBytes(input: {
  bytes: Buffer;
  mimeType: string | null;
  expectedMimeType?: string;
  expectedWidth?: number;
  expectedHeight?: number;
  minimumFileSizeBytes?: number;
}): TechnicalImageValidation {
  const reasons: string[] = [];
  const expectedMimeType = input.expectedMimeType ?? "image/png";
  const minimumFileSizeBytes = input.minimumFileSizeBytes ?? 4096;
  const mimeTypeValid =
    !!input.mimeType && input.mimeType.toLowerCase().startsWith(expectedMimeType.toLowerCase());
  const fileSizeValid = input.bytes.length >= minimumFileSizeBytes;
  const checksumCreatable = input.bytes.length > 0;
  const thumbnailCreatable = input.bytes.length > 0;

  if (!mimeTypeValid) {
    reasons.push("The persisted asset response returned an unexpected Content-Type.");
  }
  if (!fileSizeValid) {
    reasons.push("The persisted asset response is below the minimum file-size threshold.");
  }

  try {
    const decoded = decodePngRgba(input.bytes);
    let transparentPixels = 0;
    let identicalPixels = 0;
    let previousColor = "";
    let sampleCount = 0;
    let luminanceTotal = 0;
    let luminanceSquaredTotal = 0;
    const colorCounts = new Map<string, number>();

    for (let index = 0; index < decoded.rgba.length; index += 16) {
      const r = decoded.rgba[index] ?? 0;
      const g = decoded.rgba[index + 1] ?? 0;
      const b = decoded.rgba[index + 2] ?? 0;
      const a = decoded.rgba[index + 3] ?? 255;
      const key = `${r},${g},${b},${a}`;
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
      if (sampleCount > 0 && key === previousColor) identicalPixels += 1;
      previousColor = key;
      if (a <= 3) transparentPixels += 1;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminanceTotal += luminance;
      luminanceSquaredTotal += luminance * luminance;
      sampleCount += 1;
    }

    const averageLuminance = sampleCount ? luminanceTotal / sampleCount : 0;
    const variance = sampleCount
      ? Math.max(0, luminanceSquaredTotal / sampleCount - averageLuminance * averageLuminance)
      : 0;
    const dominantColorPercentage = sampleCount
      ? Math.max(...Array.from(colorCounts.values())) / sampleCount
      : 1;
    const fullyTransparent = sampleCount > 0 && transparentPixels / sampleCount >= 0.98;
    const nearUniform = sampleCount > 0 && variance < 8;
    const oneColor = dominantColorPercentage >= 0.98;
    const expectedDimensionsValid =
      (!input.expectedWidth || decoded.width === input.expectedWidth) &&
      (!input.expectedHeight || decoded.height === input.expectedHeight);
    const dimensionsValid = decoded.width > 0 && decoded.height > 0;

    if (!dimensionsValid) {
      reasons.push("The persisted asset response has invalid image dimensions.");
    }
    if (!expectedDimensionsValid) {
      reasons.push("The persisted asset response does not match the expected image dimensions.");
    }
    if (fullyTransparent) {
      reasons.push("The persisted asset response is fully transparent.");
    }
    if (nearUniform) {
      reasons.push("The persisted asset response has near-uniform pixel variance and appears blank.");
    }
    if (oneColor) {
      reasons.push("The persisted asset response is effectively one colour and appears blank.");
    }

    return {
      mimeTypeValid,
      fileSizeValid,
      decodable: true,
      width: decoded.width,
      height: decoded.height,
      dimensionsValid,
      expectedDimensionsValid,
      hasAlpha: decoded.hasAlpha,
      fullyTransparent,
      nearUniform,
      oneColor,
      pixelVariance: Number(variance.toFixed(2)),
      dominantColorPercentage: Number(dominantColorPercentage.toFixed(4)),
      checksumCreatable,
      thumbnailCreatable,
      passed: reasons.length === 0,
      reasons
    };
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : "The persisted asset response could not be decoded.");
    return {
      mimeTypeValid,
      fileSizeValid,
      decodable: false,
      width: null,
      height: null,
      dimensionsValid: false,
      expectedDimensionsValid: false,
      hasAlpha: false,
      fullyTransparent: false,
      nearUniform: false,
      oneColor: false,
      pixelVariance: 0,
      dominantColorPercentage: 0,
      checksumCreatable,
      thumbnailCreatable,
      passed: false,
      reasons
    };
  }
}

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
  bytes?: Buffer;
  expectedWidth?: number;
  expectedHeight?: number;
}) {
  const errors: string[] = [];
  if (!response.ok) errors.push("The persisted asset URL did not return a successful response.");
  if (!response.contentType || !response.contentType.toLowerCase().startsWith(response.expectedMimeType.toLowerCase())) {
    errors.push("The persisted asset response returned an unexpected Content-Type.");
  }
  if (response.byteLength <= 0) {
    errors.push("The persisted asset response returned empty image bytes.");
  }
  if (response.bytes && response.byteLength > 0) {
    const technical = validateTechnicalImageBytes({
      bytes: response.bytes,
      mimeType: response.contentType,
      expectedMimeType: response.expectedMimeType,
      expectedWidth: response.expectedWidth,
      expectedHeight: response.expectedHeight
    });
    errors.push(...technical.reasons);
  }
  return errors;
}
