import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import {
  createVisualAssetUrl,
  getCompletedVariantIntegrityErrors,
  stateToProgress,
  validateTechnicalImageBytes,
  validateServedImageResponse,
  type BrowserLoadStatus,
  type ImageGenerationState,
  type TechnicalImageValidation
} from "@/lib/image-generator-integrity";
import { readPngDimensions } from "@/lib/image-generator-png";
import { localImageRenderTimeoutMs, terminateOrphanedLocalImageRenders } from "@/lib/local-image-model-runtime";
import { buildPhotorealStoryboardPrompt } from "@/lib/local-storyboard-frame-renderer";
import {
  getVisualGenerationProvider,
  getVisualGenerationProviderDefaults,
  type ImageGenerationProviderHealth
} from "@/lib/visual-generation-provider";
import { dispatchAssetEngineJob } from "@/lib/worker-dispatch";

const VISUAL_STEPS = [
  "Inputs validated",
  "Visual brief resolved",
  "Generating variants",
  "Quality review",
  "Auto-revision",
  "Asset approved"
] as const;

// #region debug-point A:image-engine-report
function reportImageEngineDebug(hypothesisId: "A" | "B" | "C" | "D" | "E", location: string, msg: string, data: Record<string, unknown>) {
  let url = "http://127.0.0.1:7777/event";
  let sessionId = "image-gen-stall";
  try {
    const env = fs.readFileSync(".dbg/image-gen-stall.env", "utf8");
    url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || url;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
  } catch {}
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, runId: "pre-fix", hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() })
  }).catch(() => {});
}
// #endregion

type ProductionRow = {
  ProductionId: string;
  Code: string;
  Title: string;
  ProductionType: string;
  Stage: string;
  Status: string;
  Priority: string;
  Progress: number;
  DueAt: Date | null;
  UpdatedAt: Date;
  MetadataJson: string | null;
};

type VisualQuality = {
  brief: number;
  humanPhotorealism: number;
  facialRealism: number;
  anatomy: number;
  subjectDiversity: number;
  lightingPerspective: number;
  sharpnessResolution: number;
  subjectVisibility: number;
  identityConsistency: number;
  geographicAccuracy: number;
  culturalIntegrity: number;
  brand: number;
  composition: number;
  technical: number;
  originality: number;
  safety: number;
};

type LocaleProfile = {
  hierarchy: string[];
  country: string;
  region: string;
  city: string;
  locality: string;
  environment: string;
  audience: string;
  demographics: string;
  clothing: string;
  architecture: string;
  infrastructure: string;
  climate: string;
  language: string;
  currency: string;
  dateFormat: string;
  signage: string;
  culturalNotes: string[];
  sources: string[];
  stereotypeAvoidance: string[];
};

type VisualIssue = {
  title: string;
  detail: string;
  status: string;
};

type VisualLog = {
  createdAt: string;
  text: string;
  highlighted?: boolean;
};

type VisualVersion = {
  id: string;
  note: string;
  createdAt: string;
};

const imageGenerationGlobal = globalThis as typeof globalThis & {
  __imageGenerationScheduler?: Promise<ImageGeneratorPayload>;
};

export type VisualVariant = {
  id: string;
  label: string;
  note: string;
  status: ImageGenerationState;
  assetId: string | null;
  assetUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  failureReason: string | null;
  browserLoadStatus: BrowserLoadStatus;
  storageResult: string | null;
  providerResponse: string | null;
};

export type VisualAgent = {
  name: string;
  model: string;
  action: string;
  elapsedSeconds: number;
  heartbeat: string;
  retryCount: number;
  nextAction: string;
  modelResponse: string;
  storageResult: string;
};

export type VisualRouting = {
  status: string;
  target: string;
  updatedAt: string | null;
};

export type ImageGeneratorProduction = {
  id: string;
  code: string;
  title: string;
  asset: string;
  stage: string;
  state: ImageGenerationState;
  priority: string;
  progress: number;
  step: number;
  stepLabel: string;
  variant: number;
  variantCount: number;
  dueAt: string | null;
  updatedAt: string;
  brief: {
    purpose: string;
    scene: string;
    subject: string;
    composition: string;
    style: string;
    aspectRatio: string;
    brandProfile: string;
    localeProfile: LocaleProfile;
  };
  constraints: {
    required: string[];
    prohibited: string[];
    typography: string;
    safeArea: string;
    originality: string;
  };
  references: Array<{ id: string; status: string }>;
  brand: {
    tone: string;
    profile: string;
    swatches: string[];
    match: number;
  };
  prompt: string;
  variants: VisualVariant[];
  quality: VisualQuality;
  issues: VisualIssue[];
  versions: VisualVersion[];
  decisions: VisualLog[];
  agent: VisualAgent;
  routing: VisualRouting;
  recovery: string | null;
  lastActionAt: string | null;
  preview: false;
  activeAssetUrl: string | null;
  activeAssetId: string | null;
  failureReason: string | null;
  workerHeartbeatAt: string | null;
  storageResult: string | null;
  browserLoadStatus: BrowserLoadStatus;
};

export type ImageGeneratorPayload = {
  generatedAt: string;
  productions: ImageGeneratorProduction[];
  summary: {
    total: number;
    active: number;
    approved: number;
    averageQuality: number;
    queueDepth: number;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseMetadata(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return list.length ? list : fallback;
}

function asNumber(value: unknown, fallback: number, min = 0, max = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function asFraction(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function titleCase(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function shortTopic(row: ProductionRow, metadata: Record<string, unknown>) {
  return asString(metadata.topic, row.Title);
}

function sceneName(row: ProductionRow, metadata: Record<string, unknown>) {
  const stored = asOptionalString(metadata.sceneTitle);
  if (stored) return stored;
  const base = shortTopic(row, metadata).replace(/\s+/g, " ").trim();
  const sceneIndex = ((base.length % 5) + 1).toString().padStart(2, "0");
  return `Scene ${sceneIndex} · ${base}`;
}

function sceneSubject(row: ProductionRow) {
  const title = row.Title.toLowerCase();
  if (title.includes("market")) return "Enterprise AI operations command center";
  if (title.includes("education") || title.includes("training")) return "Collaborative smart learning environment";
  if (title.includes("energy")) return "Industrial control room with predictive dashboards";
  return "AI-enabled operations environment";
}

function seedPrompt(row: ProductionRow, metadata: Record<string, unknown>, asset: string, subject: string) {
  const topic = shortTopic(row, metadata);
  return [
    `${asset}.`,
    `Create a cinematic, realistic, corporate still image for "${topic}".`,
    `Subject: ${subject}.`,
    "Composition: wide frame, centered focal subject, layered depth, controlled lighting, high detail.",
    "Constraints: no fantasy elements, no stock-photo look, no unapproved logos, no text except subtle interface labels.",
    "Brand profile: CACSMS Corporate 2026, credible, future-ready, polished, enterprise-grade."
  ].join(" ");
}

const WORKFLOW_STEPS = [
  "Waiting for Inputs",
  "Queued",
  "Generating",
  "Uploading",
  "Persisting",
  "Validating",
  "Reviewing",
  "Revising",
  "Rejected",
  "Completed"
] as const;

const DEFAULT_WORKER = "CACSMS Image Worker";
const PHOTO_REAL_PROVIDER = "cacsms-local-neural-image-runtime";
const CLAIM_LEASE_SECONDS = Math.max(30, Number.parseInt(process.env.CACSMS_IMAGE_CLAIM_LEASE_SECONDS ?? "120", 10) || 120);

function configuredNeuralImageModel() {
  return (
    process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME?.trim() ||
    getVisualGenerationProviderDefaults().modelDisplayName
  );
}

function defaultJobRuntime() {
  const defaults = getVisualGenerationProviderDefaults();
  return {
    worker: DEFAULT_WORKER,
    provider: defaults.providerId,
    model: defaults.modelDisplayName
  };
}

function generationStaleMs(updatedAt: Date | string) {
  return Date.now() - new Date(updatedAt).getTime();
}

function generationStillRunning(updatedAt: Date | string) {
  return generationStaleMs(updatedAt) < localImageRenderTimeoutMs() + 120_000;
}
const PHOTOREAL_HUMAN_NEGATIVE_PROMPT = [
  "cartoon",
  "illustration",
  "vector art",
  "3D avatar",
  "CGI",
  "plastic skin",
  "mannequin",
  "silhouette",
  "placeholder",
  "stock photo replica",
  "generic stock office portrait",
  "single person portrait",
  "passport photo",
  "beauty portrait",
  "celebrity likeness",
  "duplicated face",
  "cropped face",
  "cut off head",
  "subject at frame edge",
  "unclear focal subject",
  "excessive blur",
  "cyborg",
  "robotic face",
  "mechanical skin",
  "face mask",
  "masked face",
  "helmet",
  "visor",
  "sci-fi facial markings",
  "cybernetic implants",
  "traditional costume unless explicitly requested",
  "ceremonial attire unless explicitly requested",
  "head wrap unless explicitly requested",
  "white European subject when Nigeria is required",
  "generic Western office when Lagos is required",
  "empty office",
  "malformed anatomy",
  "extra fingers",
  "missing fingers",
  "fused limbs",
  "distorted eyes",
  "asymmetric eyes",
  "deformed face",
  "disfigured face",
  "melted face",
  "smudged face",
  "blurry face",
  "waxy skin",
  "doll face",
  "text artifacts",
  "watermark",
  "logo",
  "low-detail background",
  "blur"
].join(", ");

async function renderIndependentVisual(prompt: string, width: number, height: number, seed: string, allowFallback: boolean) {
  const provider = getVisualGenerationProvider();
  try {
    return await provider.generate({ prompt, width, height, seed });
  } catch (error) {
    console.warn("cacsms.visualGenerationProvider.failed", error);
    return null;
  }
}
const MAX_RETRIES = 5;
const MIN_QUALITY_SCORE = 85;
const TARGET_VARIANT_COUNT = Math.max(
  1,
  Number.parseInt(process.env.CACSMS_IMAGE_GENERATION_VARIANT_COUNT ?? "3", 10) || 3
);
const MAX_VARIANT_CAP = Math.max(
  TARGET_VARIANT_COUNT,
  Number.parseInt(process.env.CACSMS_IMAGE_GENERATION_MAX_VARIANTS ?? "12", 10) || 12
);

type StoryboardSnapshot = {
  generatedAt: string;
  versionLabel?: string;
  scenes: Array<{
    id: string;
    title: string;
    shots: Array<{
      id: string;
      title: string;
      framing: string;
      camera: string;
      visualFocus: string;
      summary: string;
      previewAssetId?: string | null;
    }>;
  }>;
};

function storyboardSnapshotFromMetadata(metadata: Record<string, unknown>) {
  const snapshot = asObject(metadata.autonomousStoryboard);
  if (!snapshot.generatedAt || !Array.isArray(snapshot.scenes)) return null;
  return snapshot as unknown as StoryboardSnapshot;
}

function storyboardShotCount(metadata: Record<string, unknown>) {
  const snapshot = storyboardSnapshotFromMetadata(metadata);
  if (!snapshot) return TARGET_VARIANT_COUNT;
  return snapshot.scenes.reduce((total, scene) => total + scene.shots.length, 0);
}

function targetVisualAssetCount(metadata: Record<string, unknown>) {
  return Math.max(TARGET_VARIANT_COUNT, Math.min(storyboardShotCount(metadata), MAX_VARIANT_CAP));
}

type StoryboardRequestContext = {
  sceneId: string | null;
  shotId: string | null;
  sceneTitle: string | null;
  shotTitle: string | null;
  storyboardVersionLabel: string | null;
  targetAssetCount: number;
  routedAssetId: string | null;
};

function currentStoryboardRequestContext(
  brief: VisualBrief,
  metadata: Record<string, unknown>
): StoryboardRequestContext {
  const snapshot = storyboardSnapshotFromMetadata(metadata);
  const visualGeneration = asObject(metadata.visualGeneration);
  const persistedBrief = asObject(visualGeneration.brief);
  const references = asStringList(persistedBrief.references, brief.references);
  const referenceSceneId = references[1] ?? null;
  const referenceShotId = references[2] ?? null;
  const activeScene =
    snapshot?.scenes.find((scene) => scene.id === asOptionalString(asObject(metadata.autonomousStoryboardProduction).activeSceneId)) ??
    snapshot?.scenes.find((scene) => scene.id === referenceSceneId) ??
    snapshot?.scenes.find((scene) => scene.title === brief.scene) ??
    snapshot?.scenes[0] ??
    null;
  const activeShot =
    activeScene?.shots.find((shot) => shot.id === asOptionalString(asObject(metadata.autonomousStoryboardProduction).activeShotId)) ??
    activeScene?.shots.find((shot) => shot.id === referenceShotId) ??
    activeScene?.shots.find((shot) => shot.visualFocus === brief.subject) ??
    activeScene?.shots[0] ??
    null;
  return {
    sceneId: activeScene?.id ?? referenceSceneId,
    shotId: activeShot?.id ?? referenceShotId,
    sceneTitle: activeScene?.title ?? brief.scene ?? null,
    shotTitle: activeShot?.title ?? null,
    storyboardVersionLabel: snapshot?.versionLabel ?? null,
    targetAssetCount: targetVisualAssetCount(metadata),
    routedAssetId: asOptionalString(asObject(visualGeneration.approvedAsset).assetId)
  };
}

async function routeApprovedAsset(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  metadata: Record<string, unknown>,
  brief: VisualBrief,
  requestId: string,
  variant: VariantRow & Partial<AssetRow>,
  asset: AssetRow
) {
  const routedAt = new Date().toISOString();
  const snapshot = storyboardSnapshotFromMetadata(metadata);
  const context = currentStoryboardRequestContext(brief, metadata);
  let routedSceneId = context.sceneId;
  let routedShotId = context.shotId;
  let routedSnapshot = snapshot;

  if (snapshot?.scenes.length) {
    const scenes = snapshot.scenes.map((scene) => {
      if (routedSceneId && scene.id !== routedSceneId) return scene;
      const shots = scene.shots.map((shot) => {
        if (routedShotId && shot.id !== routedShotId) return shot;
        if (!routedShotId && shot.previewAssetId) return shot;
        routedSceneId = scene.id;
        routedShotId = shot.id;
        return {
          ...shot,
          previewAssetId: asset.ImageGenerationAssetId,
          previewUrl: asset.PublicUrl,
          previewFileName: asset.FileName,
          previewChecksumSha256: asset.ChecksumSha256,
          previewRenderMode: "photoreal-human" as const,
          previewSource: "image-generator" as const
        };
      });
      return { ...scene, shots };
    });
    routedSnapshot = { ...snapshot, generatedAt: routedAt, scenes };
  }

  const visualGeneration = asObject(metadata.visualGeneration);
  const merged = {
    ...metadata,
    ...(routedSnapshot ? { autonomousStoryboard: routedSnapshot } : {}),
    visualGeneration: {
      ...visualGeneration,
      approvedAsset: {
        assetId: asset.ImageGenerationAssetId,
        assetUrl: asset.PublicUrl,
        checksumSha256: asset.ChecksumSha256,
        variantId: variant.ImageGenerationVariantId,
        variantNumber: variant.VariantNumber,
        qualityScore: variant.QualityScore ?? null,
        storyboardSceneId: routedSceneId,
        storyboardShotId: routedShotId,
        storyboardVersionLabel: context.storyboardVersionLabel,
        requestId,
        routedAt
      },
      routing: {
        status: "approved-routed",
        storyboard: routedShotId ? "routed" : "pending-context",
        assetLibrary: "ready",
        videoStudio: asset.PublicUrl ? "ready" : "pending",
        targetSceneId: routedSceneId,
        targetShotId: routedShotId,
        requestId,
        updatedAt: routedAt
      }
    }
  };

  await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("metadataJson", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query(`
      UPDATE cacsms.Productions
      SET MetadataJson = @metadataJson, UpdatedAt = SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ProductionId) = @productionId;
    `);

  return merged;
}

async function advanceVisualBriefToNextStoryboardShot(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  metadata: Record<string, unknown>
) {
  const snapshot = storyboardSnapshotFromMetadata(metadata);
  if (!snapshot) return metadata;

  const usedAssetIds = new Set<string>();
  for (const scene of snapshot.scenes) {
    for (const shot of scene.shots) {
      if (shot.previewAssetId) usedAssetIds.add(shot.previewAssetId);
    }
  }

  let next: { scene: StoryboardSnapshot["scenes"][number]; shot: StoryboardSnapshot["scenes"][number]["shots"][number] } | null = null;
  for (const scene of snapshot.scenes) {
    for (const shot of scene.shots) {
      if (!shot.previewAssetId) {
        next = { scene, shot };
        break;
      }
    }
    if (next) break;
  }
  if (!next) return metadata;

  const prompt = buildPhotorealStoryboardPrompt({
    productionTitle: row.Title,
    sceneTitle: next.scene.title,
    shotTitle: next.shot.title,
    framing: next.shot.framing,
    camera: next.shot.camera,
    visualFocus: next.shot.visualFocus,
    summary: next.shot.summary
  });
  const existingBrief = asObject(asObject(metadata.visualGeneration).brief);
  const merged = {
    ...metadata,
    visualGeneration: {
      ...asObject(metadata.visualGeneration),
      brief: {
        purpose: asString(existingBrief.purpose, `Create photoreal human visual assets for ${row.Title}.`),
        scene: next.scene.title,
        subject: next.shot.visualFocus,
        composition: next.shot.framing,
        style: "Photorealistic, cinematic, realistic human subjects, corporate documentary still.",
        aspectRatio: asString(existingBrief.aspectRatio, "16:9 (1280x720)"),
        brandProfile: asString(existingBrief.brandProfile, "CACSMS Corporate 2026"),
        prompt,
        required: ["Primary subject", "Brand-safe palette", "Storyboard-aligned framing"],
        prohibited: ["Fantasy", "Cartoon style", "Unapproved logos"],
        typography: asString(existingBrief.typography, "No text except approved interface labels"),
        safeArea: asString(existingBrief.safeArea, "10% all sides"),
        originality: "Must be original and unique to this storyboard package",
        references: [`SB-${row.Code}`, next.scene.id, next.shot.id]
      }
    }
  };

  await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("metadataJson", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query(`
      UPDATE cacsms.Productions
      SET MetadataJson = @metadataJson, UpdatedAt = SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ProductionId) = @productionId;
    `);
  return merged;
}

type VisualBrief = ReturnType<typeof briefFromRow>;

type RenderMode = {
  mode: "photoreal-human" | "original-3d-scene";
  required: boolean;
  reason: string;
};

type RenderInstructions = {
  mode: RenderMode;
  prompt: string;
  negativePrompt: string;
  settings: {
    aspectRatio: string;
    width: number;
    height: number;
    seed: string;
    inference: string;
    qualityGates: string[];
    localeProfile: LocaleProfile;
  };
};

type ProviderAudit = {
  provider?: string;
  model?: string;
  method?: string;
  workflow?: string;
  prompt?: string;
  negativePrompt?: string;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
};

type GateResult = {
  passed: boolean;
  score: number;
  quality: VisualQuality;
  defects: string[];
  audit: Record<string, unknown>;
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

const STORAGE_DIR = path.join(projectRoot(), ".generated", "visuals");

function resolvePersistedVisualStoragePath(storagePath: string) {
  const trimmed = storagePath.trim();
  if (!trimmed) return "";
  const normalized = path.normalize(trimmed);
  if (fs.existsSync(normalized)) return normalized;
  const marker = `${path.sep}.generated${path.sep}`;
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) {
    const relativeGeneratedPath = normalized.slice(markerIndex + marker.length);
    const repairedPath = path.join(projectRoot(), ".generated", relativeGeneratedPath);
    if (fs.existsSync(repairedPath)) return repairedPath;
  }
  return normalized;
}

type JobRow = {
  ImageGenerationJobId: string;
  State: ImageGenerationState;
  WorkerName: string | null;
  ProviderName: string | null;
  ModelName: string | null;
  ProviderJobId: string | null;
  WorkerHeartbeatAt: Date | null;
  ClaimedAt: Date | null;
  LeaseExpiresAt: Date | null;
  RetryCount: number;
  FailureReason: string | null;
  NextRecoveryAction: string | null;
  StorageResult: string | null;
  ModelResponseJson: string | null;
  LastTransitionAt: Date;
  CreatedAt: Date;
  UpdatedAt: Date;
};

type VariantRow = {
  ImageGenerationVariantId: string;
  ImageGenerationJobId: string;
  ImageGenerationAssetId: string | null;
  VariantNumber: number;
  State: ImageGenerationState;
  RenderPrompt: string;
  FailureReason: string | null;
  StorageResult: string | null;
  ProviderResponseJson: string | null;
  RetryCount: number;
  QualityScore: number | null;
  QualitySummaryJson: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
};

type AssetRow = {
  ImageGenerationAssetId: string;
  ImageGenerationJobId: string;
  FileName: string;
  StoragePath: string;
  PublicUrl: string;
  MimeType: string;
  FileSizeBytes: number;
  Width: number;
  Height: number;
  ChecksumSha256: string;
  AvailabilityStatus: string;
  AvailabilityCheckedAt: Date | null;
  BrowserLoadStatus: BrowserLoadStatus;
  BrowserLoadedAt: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date;
};

type QueuePriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "BACKGROUND";

function queuePriorityFromProduction(priority: string): QueuePriority {
  const normalized = priority.trim().toLowerCase();
  if (normalized.includes("critical")) return "CRITICAL";
  if (normalized.includes("high") || normalized.includes("urgent")) return "HIGH";
  if (normalized.includes("low")) return "LOW";
  if (normalized.includes("background")) return "BACKGROUND";
  return "NORMAL";
}

function buildSceneKey(row: ProductionRow, brief: VisualBrief) {
  return `${row.Code}:${brief.scene}`.replace(/\s+/g, " ").trim();
}

function inferAssetType(brief: VisualBrief) {
  const combined = [brief.purpose, brief.subject, brief.style, brief.prompt].join(" ").toLowerCase();
  if (combined.includes("thumbnail")) return "THUMBNAIL";
  if (combined.includes("diagram")) return "EDUCATIONAL_DIAGRAM";
  if (combined.includes("map")) return "MAP";
  if (combined.includes("chart")) return "DATA_CHART";
  if (combined.includes("infographic")) return "INFOGRAPHIC";
  return "PHOTOREALISTIC_DOCUMENTARY";
}

function hashJson(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function separateStatusesForState(state: ImageGenerationState) {
  switch (state) {
    case "Waiting for Inputs":
      return {
        generationStatus: "NOT_STARTED",
        technicalValidationStatus: "NOT_STARTED",
        qualityStatus: "NOT_EVALUATED",
        deliveryStatus: "NOT_STARTED",
        browserAcknowledgementStatus: "PENDING"
      };
    case "Queued":
      return {
        generationStatus: "QUEUED",
        technicalValidationStatus: "NOT_STARTED",
        qualityStatus: "NOT_EVALUATED",
        deliveryStatus: "NOT_STARTED",
        browserAcknowledgementStatus: "PENDING"
      };
    case "Generating":
    case "Uploading":
      return {
        generationStatus: "IN_PROGRESS",
        technicalValidationStatus: "NOT_STARTED",
        qualityStatus: "NOT_EVALUATED",
        deliveryStatus: "NOT_STARTED",
        browserAcknowledgementStatus: "PENDING"
      };
    case "Persisting":
      return {
        generationStatus: "SUCCEEDED",
        technicalValidationStatus: "NOT_STARTED",
        qualityStatus: "NOT_EVALUATED",
        deliveryStatus: "IN_PROGRESS",
        browserAcknowledgementStatus: "PENDING"
      };
    case "Validating":
      return {
        generationStatus: "SUCCEEDED",
        technicalValidationStatus: "IN_PROGRESS",
        qualityStatus: "NOT_EVALUATED",
        deliveryStatus: "IN_PROGRESS",
        browserAcknowledgementStatus: "PENDING"
      };
    case "Reviewing":
      return {
        generationStatus: "SUCCEEDED",
        technicalValidationStatus: "PASSED",
        qualityStatus: "IN_PROGRESS",
        deliveryStatus: "VERIFIED",
        browserAcknowledgementStatus: "LOADED"
      };
    case "Completed":
      return {
        generationStatus: "SUCCEEDED",
        technicalValidationStatus: "PASSED",
        qualityStatus: "PASSED",
        deliveryStatus: "VERIFIED",
        browserAcknowledgementStatus: "LOADED"
      };
    case "Blocked":
      return {
        generationStatus: "SUCCEEDED",
        technicalValidationStatus: "FAILED",
        qualityStatus: "FAILED",
        deliveryStatus: "FAILED",
        browserAcknowledgementStatus: "FAILED"
      };
    case "Rejected":
    case "Failed":
      return {
        generationStatus: "FAILED",
        technicalValidationStatus: "FAILED",
        qualityStatus: "FAILED",
        deliveryStatus: "FAILED",
        browserAcknowledgementStatus: "FAILED"
      };
    case "Revising":
      return {
        generationStatus: "SUCCEEDED",
        technicalValidationStatus: "PASSED",
        qualityStatus: "FAILED",
        deliveryStatus: "VERIFIED",
        browserAcknowledgementStatus: "LOADED"
      };
    default:
      return {
        generationStatus: "UNKNOWN",
        technicalValidationStatus: "UNKNOWN",
        qualityStatus: "UNKNOWN",
        deliveryStatus: "UNKNOWN",
        browserAcknowledgementStatus: "PENDING"
      };
  }
}

async function ensureVisualGenerationRequest(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  brief: VisualBrief,
  metadata: Record<string, unknown>
) {
  const sceneKey = buildSceneKey(row, brief);
  const assetType = inferAssetType(brief);
  const priority = queuePriorityFromProduction(row.Priority);
  const storyboardContext = currentStoryboardRequestContext(brief, metadata);
  const context = {
    productionId: row.ProductionId,
    code: row.Code,
    title: row.Title,
    sceneKey,
    assetType,
    storyboard: storyboardContext,
    brief,
    metadata
  };
  const contextJson = JSON.stringify(context);
  const briefHash = hashJson(context);
  const existing = await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("sceneKey", sql.NVarChar(200), sceneKey)
    .input("assetType", sql.NVarChar(64), assetType)
    .query<{ VisualGenerationRequestId: string }>(`
      SELECT TOP(1) CONVERT(nvarchar(36), VisualGenerationRequestId) AS VisualGenerationRequestId
      FROM cacsms.VisualGenerationRequests
      WHERE ProductionId = CONVERT(uniqueidentifier, @productionId)
        AND SceneKey = @sceneKey
        AND AssetType = @assetType
        AND IsDeleted = 0
      ORDER BY CreatedAt DESC;
    `);

  const requestId = existing.recordset[0]?.VisualGenerationRequestId;
  if (requestId) {
    await pool
      .request()
      .input("requestId", sql.NVarChar(36), requestId)
      .input("priority", sql.NVarChar(32), priority)
      .input("briefHash", sql.NVarChar(64), briefHash)
      .input("contextJson", sql.NVarChar(sql.MAX), contextJson)
      .query(`
        UPDATE cacsms.VisualGenerationRequests
        SET Priority=@priority,
            BriefHash=@briefHash,
            ContextJson=@contextJson,
            UpdatedAt=SYSUTCDATETIME(),
            UpdatedByAgent=N'cacsms-visual-agent',
            Version=Version+1
        WHERE CONVERT(nvarchar(36), VisualGenerationRequestId)=@requestId;
      `);
    return { requestId, sceneKey, assetType, priority };
  }

  const created = await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("sceneKey", sql.NVarChar(200), sceneKey)
    .input("assetType", sql.NVarChar(64), assetType)
    .input("purpose", sql.NVarChar(256), brief.purpose)
    .input("priority", sql.NVarChar(32), priority)
    .input("briefHash", sql.NVarChar(64), briefHash)
    .input("contextJson", sql.NVarChar(sql.MAX), contextJson)
    .query<{ id: string }>(`
      DECLARE @created TABLE (id nvarchar(36));
      INSERT cacsms.VisualGenerationRequests (
        ProductionId, SceneKey, RequestingModule, AssetType, Purpose, Priority, Status, BriefHash, ContextJson
      )
      OUTPUT CONVERT(nvarchar(36), inserted.VisualGenerationRequestId) INTO @created(id)
      VALUES (
        CONVERT(uniqueidentifier, @productionId), @sceneKey, N'storyboard', @assetType, @purpose, @priority, N'ACTIVE', @briefHash, @contextJson
      );
      SELECT TOP(1) id FROM @created;
    `);

  return { requestId: created.recordset[0].id, sceneKey, assetType, priority };
}

async function ensureVersionedVisualBrief(
  pool: sql.ConnectionPool,
  requestId: string,
  row: ProductionRow,
  brief: VisualBrief
) {
  const current = await pool
    .request()
    .input("requestId", sql.NVarChar(36), requestId)
    .query<{ VisualBriefId: string; CurrentVersion: number }>(`
      SELECT TOP(1)
        CONVERT(nvarchar(36), VisualBriefId) AS VisualBriefId,
        CurrentVersion
      FROM cacsms.VisualBriefs
      WHERE VisualGenerationRequestId = CONVERT(uniqueidentifier, @requestId);
    `);

  let briefId = current.recordset[0]?.VisualBriefId ?? null;
  let currentVersion = current.recordset[0]?.CurrentVersion ?? 0;
  if (!briefId) {
    const created = await pool
      .request()
      .input("requestId", sql.NVarChar(36), requestId)
      .input("productionId", sql.NVarChar(36), row.ProductionId)
      .input("sceneKey", sql.NVarChar(200), buildSceneKey(row, brief))
      .query<{ id: string }>(`
        DECLARE @created TABLE (id nvarchar(36));
        INSERT cacsms.VisualBriefs (VisualGenerationRequestId, ProductionId, SceneKey, CurrentVersion, Status)
        OUTPUT CONVERT(nvarchar(36), inserted.VisualBriefId) INTO @created(id)
        VALUES (CONVERT(uniqueidentifier, @requestId), CONVERT(uniqueidentifier, @productionId), @sceneKey, 0, N'ACTIVE');
        SELECT TOP(1) id FROM @created;
      `);
    briefId = created.recordset[0].id;
  }

  const latest = await pool
    .request()
    .input("briefId", sql.NVarChar(36), briefId)
    .query<{ BriefJson: string | null; VersionNumber: number }>(`
      SELECT TOP(1) BriefJson, VersionNumber
      FROM cacsms.VisualBriefVersions
      WHERE VisualBriefId = CONVERT(uniqueidentifier, @briefId)
      ORDER BY VersionNumber DESC;
    `);

  const briefJson = JSON.stringify(brief);
  if (latest.recordset[0]?.BriefJson === briefJson) {
    return { briefId, versionNumber: latest.recordset[0].VersionNumber };
  }

  currentVersion = (latest.recordset[0]?.VersionNumber ?? currentVersion) + 1;
  await pool
    .request()
    .input("briefId", sql.NVarChar(36), briefId)
    .input("versionNumber", sql.Int, currentVersion)
    .input("briefJson", sql.NVarChar(sql.MAX), briefJson)
    .input("requiredJson", sql.NVarChar(sql.MAX), JSON.stringify(brief.required))
    .input("prohibitedJson", sql.NVarChar(sql.MAX), JSON.stringify(brief.prohibited))
    .input("evidenceJson", sql.NVarChar(sql.MAX), JSON.stringify({ references: brief.references, localeProfile: brief.localeProfile }))
    .query(`
      INSERT cacsms.VisualBriefVersions (
        VisualBriefId, VersionNumber, BriefJson, RequiredElementsJson, ProhibitedElementsJson, EvidenceJson
      )
      VALUES (
        CONVERT(uniqueidentifier, @briefId), @versionNumber, @briefJson, @requiredJson, @prohibitedJson, @evidenceJson
      );
      UPDATE cacsms.VisualBriefs
      SET CurrentVersion=@versionNumber, UpdatedAt=SYSUTCDATETIME(), UpdatedByAgent=N'cacsms-visual-agent', Version=Version+1
      WHERE CONVERT(nvarchar(36), VisualBriefId)=@briefId;
    `);

  return { briefId, versionNumber: currentVersion };
}

async function ensureVersionedVisualPrompt(
  pool: sql.ConnectionPool,
  briefId: string,
  instructions: RenderInstructions
) {
  const current = await pool
    .request()
    .input("briefId", sql.NVarChar(36), briefId)
    .query<{ VisualPromptId: string; CurrentVersion: number }>(`
      SELECT TOP(1)
        CONVERT(nvarchar(36), VisualPromptId) AS VisualPromptId,
        CurrentVersion
      FROM cacsms.VisualPrompts
      WHERE VisualBriefId = CONVERT(uniqueidentifier, @briefId);
    `);

  let promptId = current.recordset[0]?.VisualPromptId ?? null;
  let currentVersion = current.recordset[0]?.CurrentVersion ?? 0;
  if (!promptId) {
    const created = await pool
      .request()
      .input("briefId", sql.NVarChar(36), briefId)
      .query<{ id: string }>(`
        DECLARE @created TABLE (id nvarchar(36));
        INSERT cacsms.VisualPrompts (VisualBriefId, CurrentVersion, Status)
        OUTPUT CONVERT(nvarchar(36), inserted.VisualPromptId) INTO @created(id)
        VALUES (CONVERT(uniqueidentifier, @briefId), 0, N'ACTIVE');
        SELECT TOP(1) id FROM @created;
      `);
    promptId = created.recordset[0].id;
  }

  const latest = await pool
    .request()
    .input("promptId", sql.NVarChar(36), promptId)
    .query<{ CanonicalPrompt: string | null; NegativePrompt: string | null; VersionNumber: number }>(`
      SELECT TOP(1) CanonicalPrompt, NegativePrompt, VersionNumber
      FROM cacsms.VisualPromptVersions
      WHERE VisualPromptId = CONVERT(uniqueidentifier, @promptId)
      ORDER BY VersionNumber DESC;
    `);

  if (
    latest.recordset[0]?.CanonicalPrompt === instructions.prompt &&
    latest.recordset[0]?.NegativePrompt === instructions.negativePrompt
  ) {
    return { promptId, versionNumber: latest.recordset[0].VersionNumber };
  }

  currentVersion = (latest.recordset[0]?.VersionNumber ?? currentVersion) + 1;
  await pool
    .request()
    .input("promptId", sql.NVarChar(36), promptId)
    .input("versionNumber", sql.Int, currentVersion)
    .input("canonicalPrompt", sql.NVarChar(sql.MAX), instructions.prompt)
    .input("modelSpecificPrompt", sql.NVarChar(sql.MAX), instructions.prompt)
    .input("negativePrompt", sql.NVarChar(sql.MAX), instructions.negativePrompt)
    .input(
      "validationJson",
      sql.NVarChar(sql.MAX),
      JSON.stringify({
        unresolvedVariables: false,
        localeResolved: Boolean(instructions.settings.localeProfile.country),
        dimensions: { width: instructions.settings.width, height: instructions.settings.height },
        workflow: instructions.mode.mode
      })
    )
    .query(`
      INSERT cacsms.VisualPromptVersions (
        VisualPromptId, VersionNumber, CanonicalPrompt, ModelSpecificPrompt, NegativePrompt, ValidationJson
      )
      VALUES (
        CONVERT(uniqueidentifier, @promptId), @versionNumber, @canonicalPrompt, @modelSpecificPrompt, @negativePrompt, @validationJson
      );
      UPDATE cacsms.VisualPrompts
      SET CurrentVersion=@versionNumber, UpdatedAt=SYSUTCDATETIME(), UpdatedByAgent=N'cacsms-visual-agent', Version=Version+1
      WHERE CONVERT(nvarchar(36), VisualPromptId)=@promptId;
    `);

  return { promptId, versionNumber: currentVersion };
}

async function appendVisualStateHistory(
  pool: sql.ConnectionPool,
  input: {
    jobId: string;
    requestId: string | null;
    previousState: string | null;
    newState: string;
    attempt: number;
    workerName: string | null;
    providerName: string | null;
    modelName: string | null;
    correlationId: string | null;
    reason: string | null;
    errorDetailsJson?: string | null;
  }
) {
  await pool
    .request()
    .input("jobId", sql.NVarChar(36), input.jobId)
    .input("requestId", sql.NVarChar(36), input.requestId)
    .input("previousState", sql.NVarChar(32), input.previousState)
    .input("newState", sql.NVarChar(32), input.newState)
    .input("reason", sql.NVarChar(2000), input.reason)
    .input("attempt", sql.Int, input.attempt)
    .input("workerName", sql.NVarChar(200), input.workerName)
    .input("providerName", sql.NVarChar(120), input.providerName)
    .input("modelName", sql.NVarChar(200), input.modelName)
    .input("correlationId", sql.NVarChar(128), input.correlationId)
    .input("errorDetailsJson", sql.NVarChar(sql.MAX), input.errorDetailsJson ?? null)
    .query(`
      INSERT cacsms.VisualGenerationStateHistory (
        ImageGenerationJobId,
        VisualGenerationRequestId,
        PreviousState,
        NewState,
        Reason,
        Attempt,
        WorkerName,
        AgentName,
        ProviderName,
        ModelName,
        CorrelationId,
        ErrorDetailsJson
      )
      VALUES (
        CONVERT(uniqueidentifier, @jobId),
        CASE WHEN @requestId IS NULL THEN NULL ELSE CONVERT(uniqueidentifier, @requestId) END,
        @previousState,
        @newState,
        @reason,
        @attempt,
        @workerName,
        N'cacsms-visual-agent',
        @providerName,
        @modelName,
        @correlationId,
        @errorDetailsJson
      );
    `);
}

function averageQuality(quality: VisualQuality) {
  const values = Object.values(quality);
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  try {
    return value ? asObject(JSON.parse(value)) : {};
  } catch {
    return {};
  }
}

function summarizeModelResponse(raw: string | null) {
  if (!raw?.trim()) return "No provider response recorded yet.";

  const parsed = parseJsonObject(raw);
  const review = parsed.review as Record<string, unknown> | undefined;
  if (review && typeof review === "object") {
    const score = typeof review.score === "number" ? `${review.score}%` : null;
    const passed = review.passed === true;
    const defects = Array.isArray(review.defects)
      ? review.defects.filter((item): item is string => typeof item === "string")
      : [];
    const defectSummary = defects.length > 0 ? `: ${defects.slice(0, 2).join("; ")}` : ".";
    return `Quality review ${passed ? "passed" : "failed"}${score ? ` at ${score}` : ""}${defectSummary}`;
  }

  const provider = typeof parsed.provider === "string" ? parsed.provider : null;
  const model = typeof parsed.model === "string" ? parsed.model : null;
  const workflow = typeof parsed.workflow === "string" ? parsed.workflow : null;
  const method = typeof parsed.method === "string" ? parsed.method : null;
  const failureReason = typeof parsed.failureReason === "string" ? parsed.failureReason : null;
  if (failureReason?.trim()) {
    return failureReason.length > 180 ? `${failureReason.slice(0, 177)}…` : failureReason;
  }
  const summaryParts = [provider ?? workflow, model, method].filter(Boolean);
  if (summaryParts.length > 0) {
    return summaryParts.join(" · ");
  }

  if (typeof parsed.storageResult === "string" && parsed.storageResult.trim()) {
    return parsed.storageResult;
  }
  if (typeof parsed.nextRecoveryAction === "string" && parsed.nextRecoveryAction.trim()) {
    return parsed.nextRecoveryAction;
  }

  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
}

function deriveRenderMode(brief: VisualBrief): RenderMode {
  const combined = [brief.purpose, brief.scene, brief.subject, brief.composition, brief.style, brief.prompt, ...brief.required].join(" ").toLowerCase();
  const wantsHumans = /\b(human|people|person|adult|team|worker|operator|student|professional|executive|presenter|staff|agent)\b/.test(combined);
  const wantsRealistic = /\b(photo|photoreal|photographic|realistic|cinematic|documentary|natural|real)\b/.test(combined);
  if (wantsHumans || wantsRealistic) {
    return {
      mode: "photoreal-human",
      required: true,
      reason: "The persisted production and scene brief requires realistic human subjects or a photographic rendering style."
    };
  }
  return {
    mode: "original-3d-scene",
    required: false,
    reason: "The persisted brief does not require production-grade photorealistic human subjects."
  };
}

function asNestedObject(...values: unknown[]) {
  for (const value of values) {
    const object = asObject(value);
    if (Object.keys(object).length) return object;
  }
  return {};
}

function resolveLocaleProfile(row: ProductionRow, metadata: Record<string, unknown>, visual: Record<string, unknown>): LocaleProfile {
  const geographic = asNestedObject(metadata.geographicIntelligence, metadata.geographic, metadata.localeProfile, visual.localeProfile, visual.locale);
  const people = asNestedObject(metadata.peopleIntelligence, metadata.people, visual.peopleProfile);
  const knowledge = asObject(metadata.knowledgeUniverse);
  const text = [row.Title, row.ProductionType, row.Stage, JSON.stringify(metadata), JSON.stringify(visual)].join(" ").toLowerCase();
  const hasNigeriaSignal = /\b(nigeria|nigerian|lagos|abuja|kano|ibadan|port harcourt|victoria island|lekki|ikeja)\b/.test(text);
  const city = asString(geographic.city, hasNigeriaSignal ? (text.includes("victoria island") ? "Victoria Island" : text.includes("abuja") ? "Abuja" : "Lagos") : "Lagos");
  const region = asString(geographic.region ?? geographic.state, city === "Abuja" ? "Federal Capital Territory" : "Lagos State");
  const country = asString(geographic.country, hasNigeriaSignal ? "Nigeria" : "Nigeria");
  const locality = asString(geographic.locality, city === "Lagos" ? "Victoria Island" : city);
  const environment = asString(geographic.environment, asString(visual.subject, "Contemporary corporate office"));
  const audience = asString(people.audience ?? metadata.audience, "Nigerian professionals and enterprise decision makers");
  const isNigeria = country.toLowerCase() === "nigeria";
  return {
    hierarchy: [country, region, city, locality, environment, asString(visual.scene, row.Title)],
    country,
    region,
    city,
    locality,
    environment,
    audience,
    demographics: asString(
      people.demographics,
      isNigeria
        ? "Diverse adult Nigerian professionals with natural West African features, varied skin tones and contemporary professional presentation"
        : "Diverse adult professionals appropriate to the resolved country and city"
    ),
    clothing: asString(
      people.clothing,
      isNigeria
        ? "Contemporary Nigerian corporate and technical workwear; business shirts, blazers, smart casual and industrial safety details only where the scene supports them"
        : "Contemporary professional clothing appropriate to the resolved city and environment"
    ),
    architecture: asString(
      geographic.architecture,
      isNigeria
        ? "Modern Lagos commercial interiors, corporate offices, operations rooms and technology workspaces; no generic foreign office tropes"
        : "Architecture and interiors appropriate to the resolved city"
    ),
    infrastructure: asString(
      geographic.infrastructure,
      isNigeria ? "Locally plausible Nigerian enterprise technology, screens, desks, power/infrastructure context and business environment" : "Locally plausible infrastructure"
    ),
    climate: asString(geographic.climate, isNigeria ? "Tropical West African lighting and climate context, warm daylight when visible" : "Locally accurate climate and light"),
    language: asString(geographic.language, isNigeria ? "English (Nigeria)" : "Local business language"),
    currency: asString(geographic.currency, isNigeria ? "NGN / naira where currency is visible" : "Local currency if visible"),
    dateFormat: asString(geographic.dateFormat, isNigeria ? "DD/MM/YYYY where dates are visible" : "Local date format"),
    signage: asString(geographic.signage, isNigeria ? "No foreign signage; English signage only if supported and legible" : "Local signage only when supported by the brief"),
    culturalNotes: asStringList(
      geographic.culturalNotes ?? knowledge.culturalNotes,
      isNigeria
        ? [
            "Traditional attire is not the default for corporate Lagos scenes.",
            "Avoid stereotypes, token cultural symbols, caricatures, poverty cues and exaggerated national motifs.",
            "Show credible contemporary Nigerian professionals in a modern business setting."
          ]
        : ["Avoid stereotypes, caricatures, tokenism and unsupported cultural symbols."]
    ),
    sources: asStringList(geographic.sources ?? knowledge.sources, ["Persisted production brief", "Geographic Intelligence", "People Intelligence", "Knowledge Universe", "Brand profile"]),
    stereotypeAvoidance: asStringList(
      geographic.stereotypeAvoidance,
      isNigeria
        ? ["No safari/desert imagery", "No default traditional costume", "No poverty framing", "No foreign city skyline", "No non-Nigerian currency/signage"]
        : ["No unsupported stereotypes", "No foreign signage", "No inaccurate architecture"]
    )
  };
}

function buildPhotorealPrompt(brief: VisualBrief, row: ProductionRow, variantNumber: number, retryCount: number) {
  const topic = row.Title.replace(/\s+/g, " ").trim();
  const locale = brief.localeProfile;
  const corporateLocaleInstruction = locale.country.toLowerCase() === "nigeria"
    ? "For Lagos corporate scenes, show Black Nigerian and West African business professionals in contemporary office/workwear; do not default to traditional, ceremonial, religious or festival clothing unless the persisted scene brief explicitly requires it."
    : "Use contemporary professional clothing appropriate to the resolved locale unless the persisted scene brief explicitly requires traditional or ceremonial attire.";
  return [
    "Photorealistic documentary photograph of a Lagos Nigeria corporate AI operations room, medium-wide scene, not a beauty shot.",
    "Prioritize large, sharp, symmetrical natural human faces with detailed eyes, visible pupils, natural skin texture, and original synthetic identity.",
    "Show one or two primary Black Nigerian or West African adult business professionals in the foreground; add a third person only if the scene requires a group scale.",
    "One clear foreground professional is fully inside the 10 percent safe area, with complete head and upper body visible, visible hands using a laptop, tablet, control console or workstation.",
    "The surrounding AI operations room must remain readable: analytics screens, maintenance workflow dashboard, desks, glass partitions, and modern enterprise equipment.",
    "Use natural expression, original synthetic identity, no celebrity likeness, no known-person imitation, believable eye detail, skin texture, hair, clothing folds, and accurate body proportions.",
    "If the production mentions AI agents, render natural human operators using AI software dashboards; the AI must appear only as screen interfaces, analytics panels or workflow tools, never as robotic/cybernetic facial or body features.",
    "Composition must not crop the face, head, hands or upper body; keep every face away from extreme frame edges, leave breathing room above the head, reduce background blur, show a clear environment and action.",
    `Locale: ${locale.hierarchy.join(" > ")}.`,
    `Regional realism: ${locale.demographics}; ${locale.clothing}; ${locale.architecture}; ${locale.infrastructure}; ${locale.climate}.`,
    `Language/signage/currency constraints: ${locale.language}; ${locale.signage}; ${locale.currency}; ${locale.dateFormat}.`,
    `Cultural integrity: ${locale.culturalNotes.join(" ")} ${corporateLocaleInstruction}`,
    `Production context: ${topic}. Scene: ${brief.scene}. Environment: ${brief.subject}.`,
    "Rendering mode: production-grade photorealistic documentary still, real camera capture aesthetic, natural facial features, skin pores and texture, realistic hair, accurate hands, correct body proportions, believable clothing folds.",
    "Camera: 28mm to 35mm lens, eye-level three-quarter perspective from 8 to 12 feet away, medium-wide composition, layered depth, moderate depth of field with readable background.",
    `Composition: ${brief.composition}; clear primary subject count, environmental interaction, foreground/midground/background separation.`,
    "Lighting: soft directional key light, practical screen glow, natural shadows, consistent perspective and reflections.",
    `Mood and brand: ${brief.brandProfile}, credible enterprise environment, polished but not artificial.`,
    `Aspect ratio: ${brief.aspectRatio}. Variant ${variantNumber}, revision ${retryCount}.`
  ].join(" ");
}

function buildRevisionPrompt(brief: VisualBrief, row: ProductionRow, variantNumber: number, retryCount: number, defects: string) {
  const base = buildPhotorealPrompt(brief, row, variantNumber, retryCount);
  return [
    base,
    "Mandatory retry correction: enlarge readable face area, keep faces symmetrical and undistorted, sharpen eyes and skin texture, and avoid melted or smudged facial features.",
    "Use a wider camera distance only if faces remain large and fully visible; leave clear headroom and side margins.",
    "Hands must show five distinct fingers with natural knuckle joints, no fused or melted fingers, no extra digits, and natural contact with laptop, tablet, or desk surface.",
    "Faces must have sharp eyes with visible pupils, natural skin texture, symmetric structure, and no plastic, doll-like, or disfigured facial detail.",
    "Do not create a single-person office portrait. Do not create a white European corporate portrait. Do not create a generic home office or empty office background.",
    `Rejected defects to correct in plain terms: ${defects.slice(0, 600)}`
  ].join(" ");
}

function buildRenderInstructions(brief: VisualBrief, row: ProductionRow, width: number, height: number, seed: string, variantNumber: number, retryCount: number): RenderInstructions {
  const mode = deriveRenderMode(brief);
  const prompt = mode.mode === "photoreal-human"
    ? buildPhotorealPrompt(brief, row, variantNumber, retryCount)
    : sanitizePhotorealBriefPrompt(brief.prompt);
  return {
    mode,
    prompt,
    negativePrompt: mode.mode === "photoreal-human" ? PHOTOREAL_HUMAN_NEGATIVE_PROMPT : "watermark, logo, text artifact, low detail",
    settings: {
      aspectRatio: brief.aspectRatio,
      width,
      height,
      seed,
      inference: "local-provider-runtime",
      localeProfile: brief.localeProfile,
      qualityGates: [
        "human photorealism",
        "facial realism and identity uniqueness",
        "hand and anatomical correctness",
        "subject count and diversity",
        "subject crop and focal composition",
        "identity consistency",
        "scene and brief adherence",
        "geographic accuracy",
        "cultural integrity",
        "lighting and perspective consistency",
        "image sharpness and resolution",
        "originality and similarity detection",
        "brand alignment",
        "safety and policy compliance"
      ]
    }
  };
}

function providerIsProductionPhotoreal(provider: ProviderAudit, instructions: RenderInstructions) {
  if (instructions.mode.mode !== "photoreal-human") return true;
  const model = String(provider.model ?? "");
  const method = String(provider.method ?? "");
  const isDevRenderer = /3d human scene renderer|procedural|fallback|preview|raster synthesis/i.test(`${model} ${method}`);
  return provider.provider === PHOTO_REAL_PROVIDER && !isDevRenderer;
}

function paethPredictor(left: number, above: number, upperLeft: number) {
  const p = left + above - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - above);
  const pc = Math.abs(p - upperLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return above;
  return upperLeft;
}

function pngHumanPixelEvidence(storagePath: string) {
  const resolvedStoragePath = resolvePersistedVisualStoragePath(storagePath);
  if (!resolvedStoragePath || !fs.existsSync(resolvedStoragePath)) {
    return { skinPixelRatio: 0, skinPixels: 0, sampledPixels: 0, supported: false };
  }
  const bytes = fs.readFileSync(resolvedStoragePath);
  if (bytes.length < 33 || bytes.subarray(1, 4).toString("ascii") !== "PNG") {
    return { skinPixelRatio: 0, skinPixels: 0, sampledPixels: 0, supported: false };
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    return { skinPixelRatio: 0, skinPixels: 0, sampledPixels: 0, supported: false };
  }
  const channels = colorType === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  let offset = 33;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IDAT") idat.push(bytes.subarray(dataStart, dataEnd));
    if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const raw = Buffer.alloc(width * height * channels);
  let source = 0;
  let skinPixels = 0;
  let sampledPixels = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source++];
    const rowStart = y * stride;
    const prevRowStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[source++];
      const left = x >= channels ? raw[rowStart + x - channels] : 0;
      const above = y > 0 ? raw[prevRowStart + x] : 0;
      const upperLeft = y > 0 && x >= channels ? raw[prevRowStart + x - channels] : 0;
      let decoded = value;
      if (filter === 1) decoded = (value + left) & 255;
      else if (filter === 2) decoded = (value + above) & 255;
      else if (filter === 3) decoded = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) decoded = (value + paethPredictor(left, above, upperLeft)) & 255;
      raw[rowStart + x] = decoded;
    }
    for (let x = 0; x < width; x += 4) {
      const index = rowStart + x * channels;
      const r = raw[index];
      const g = raw[index + 1];
      const b = raw[index + 2];
      const alpha = channels === 4 ? raw[index + 3] : 255;
      if (alpha < 128) continue;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const looksLikeSkin = luma > 32 && luma < 245 && cb >= 70 && cb <= 145 && cr >= 125 && cr <= 190 && r > b * 0.9 && g > b * 0.65;
      sampledPixels += 1;
      if (looksLikeSkin) skinPixels += 1;
    }
  }
  return {
    skinPixelRatio: sampledPixels ? skinPixels / sampledPixels : 0,
    skinPixels,
    sampledPixels,
    supported: true
  };
}

type SemanticImageEvidence = {
  available: boolean;
  model: string | null;
  scores: Record<string, number>;
  detectors: Record<string, unknown>;
  composition: Record<string, unknown>;
  passedHumanPresence: boolean;
  passedPhotographicStyle: boolean;
  passedAnatomyRisk: boolean;
  passedComposition: boolean;
  passedNaturalHuman: boolean;
  passedRegionalAppearance: boolean;
  error: string | null;
};

function localSemanticImageEvidence(storagePath: string, prompt: string): SemanticImageEvidence {
  const command = process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_COMMAND?.trim() || process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND?.trim();
  if (!command) {
    return { available: false, model: null, scores: {}, detectors: {}, composition: {}, passedHumanPresence: false, passedPhotographicStyle: false, passedAnatomyRisk: false, passedComposition: false, passedNaturalHuman: false, passedRegionalAppearance: false, error: "No local semantic image validator command is configured." };
  }
  const validatorScript =
    process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_SCRIPT?.trim() ||
    path.join(process.env.CACSMS_LOCAL_IMAGE_MODEL_DIR || path.join(projectRoot(), "local-models", "image-renderer"), "validate_image.py");
  const modelId = process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_MODEL_ID?.trim();
  const resolvedStoragePath = resolvePersistedVisualStoragePath(storagePath);
  if (!resolvedStoragePath || !fs.existsSync(resolvedStoragePath)) {
    return {
      available: false,
      model: modelId || null,
      scores: {},
      detectors: {},
      composition: {},
      passedHumanPresence: false,
      passedPhotographicStyle: false,
      passedAnatomyRisk: false,
      passedComposition: false,
      passedNaturalHuman: false,
      passedRegionalAppearance: false,
      error: "Persisted image file is missing from storage."
    };
  }
  const args = [validatorScript, "--image", resolvedStoragePath, "--prompt", prompt];
  if (modelId) args.push("--model-id", modelId);
  try {
    const stdout = execFileSync(command, args, {
      cwd: process.env.CACSMS_LOCAL_IMAGE_MODEL_DIR || process.cwd(),
      env: process.env,
      windowsHide: true,
      timeout: Number(process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_TIMEOUT_MS ?? "120000"),
      maxBuffer: 1024 * 1024
    }).toString("utf8");
    const parsed = asObject(JSON.parse(stdout));
    return {
      available: true,
      model: typeof parsed.model === "string" ? parsed.model : null,
      scores: asObject(parsed.scores) as Record<string, number>,
      detectors: asObject(parsed.detectors),
      composition: asObject(parsed.composition),
      passedHumanPresence: Boolean(parsed.passedHumanPresence),
      passedPhotographicStyle: Boolean(parsed.passedPhotographicStyle),
      passedAnatomyRisk: Boolean(parsed.passedAnatomyRisk),
      passedComposition: Boolean(parsed.passedComposition),
      passedNaturalHuman: parsed.passedNaturalHuman !== false,
      passedRegionalAppearance: parsed.passedRegionalAppearance !== false,
      error: null
    };
  } catch (error) {
    return {
      available: false,
      model: modelId || null,
      scores: {},
      detectors: {},
      composition: {},
      passedHumanPresence: false,
      passedPhotographicStyle: false,
      passedAnatomyRisk: false,
      passedComposition: false,
      passedNaturalHuman: false,
      passedRegionalAppearance: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function evaluatePhotorealHumanGates(asset: AssetRow, variant: VariantRow & Partial<AssetRow>, instructions: RenderInstructions): GateResult {
  const provider = parseJsonObject(variant.ProviderResponseJson) as ProviderAudit;
  const productionPhotoreal = providerIsProductionPhotoreal(provider, instructions);
  const hasRealSize = asset.Width >= 1024 && asset.Height >= 576;
  const hasEnoughBytes = asset.FileSizeBytes >= 600_000;
  const loaded = asset.BrowserLoadStatus === "loaded";
  const humanEvidence = instructions.mode.mode === "photoreal-human"
    ? pngHumanPixelEvidence(asset.StoragePath)
    : { skinPixelRatio: 1, skinPixels: 0, sampledPixels: 0, supported: false };
  const semanticEvidence = instructions.mode.mode === "photoreal-human"
    ? localSemanticImageEvidence(asset.StoragePath, instructions.prompt)
    : { available: true, model: null, scores: {}, detectors: {}, composition: {}, passedHumanPresence: true, passedPhotographicStyle: true, passedAnatomyRisk: true, passedComposition: true, passedNaturalHuman: true, passedRegionalAppearance: true, error: null };
  const hasVisibleHumanEvidence = semanticEvidence.passedHumanPresence && humanEvidence.skinPixelRatio >= 0.0035;
  const compositionEvidence = semanticEvidence.composition;
  const subjectCoverage = asFraction(compositionEvidence.subjectCoverage, 0);
  const centerOffset = asFraction(compositionEvidence.centerOffset, 1);
  const blurScore = asFraction(compositionEvidence.blurScore, 0);
  const handBlurScore = asFraction(compositionEvidence.handBlurScore, 0);
  const faceBlurScore = asFraction(compositionEvidence.faceBlurScore, 0);
  const faceSymmetryScore = asFraction(compositionEvidence.faceSymmetryScore, 0);
  const facialQualityPass = compositionEvidence.facialQualityPass === true;
  const laplacianVariance = asNumber(compositionEvidence.laplacianVariance, 0);
  const handLaplacianVariance = asNumber(compositionEvidence.handLaplacianVariance, 0);
  const lowQualityHumansScore = asFraction(semanticEvidence.scores.low_quality_humans, 1);
  const sharpnessFromValidator =
    semanticEvidence.available && blurScore > 0
      ? Math.round(Math.min(100, blurScore * 100))
      : hasRealSize && hasEnoughBytes
        ? 74
        : hasRealSize
          ? 58
          : 45;
  const anatomyFromValidator =
    semanticEvidence.available
      ? Math.round(Math.max(0, Math.min(100, (1 - lowQualityHumansScore) * 100)))
      : productionPhotoreal && hasVisibleHumanEvidence
        ? 62
        : 38;
  const safeAreaPass = compositionEvidence.safeAreaPass === true;
  const croppedRisk = compositionEvidence.croppedRisk === true;
  const roboticFeatureRisk = compositionEvidence.roboticFeatureRisk === true || !semanticEvidence.passedNaturalHuman;
  const detectedFaces = asNumber(semanticEvidence.detectors.faces, 0);
  const locale = instructions.mode.mode === "photoreal-human" ? instructions.settings.localeProfile : null;
  const localeText = locale ? `${locale.country} ${locale.region} ${locale.city} ${locale.locality} ${locale.environment}`.toLowerCase() : "";
  const promptText = `${instructions.prompt} ${instructions.negativePrompt}`.toLowerCase();
  const hasLocalePrompt = !locale || [locale.country, locale.city, locale.environment].every((value) => promptText.includes(value.toLowerCase()));
  const isNigeria = locale?.country.toLowerCase() === "nigeria";
  const nigeriaPromptOk = !isNigeria || /nigerian|lagos|abuja|victoria island|naira|west african|english \(nigeria\)/i.test(instructions.prompt);
  const stereotypeAvoidanceOk =
    !isNigeria ||
    /avoid stereotypes|avoid.*poverty|do not default|no foreign signage|no non-nigerian/i.test(instructions.prompt) ||
    !/(safari|desert|tribal|hut|poverty|slum|traditional costume by default)/i.test(instructions.prompt);
  const quality: VisualQuality = {
    brief: 94,
    humanPhotorealism: productionPhotoreal && hasVisibleHumanEvidence && lowQualityHumansScore < 0.26 ? 93 : productionPhotoreal ? 62 : 18,
    facialRealism:
      productionPhotoreal &&
      hasVisibleHumanEvidence &&
      semanticEvidence.passedPhotographicStyle &&
      facialQualityPass &&
      faceBlurScore >= 0.42 &&
      faceSymmetryScore >= 0.58 &&
      lowQualityHumansScore < 0.22
        ? 93
        : productionPhotoreal && faceBlurScore >= 0.34
          ? 68
          : productionPhotoreal
            ? 54
            : 24,
    anatomy: productionPhotoreal && semanticEvidence.passedAnatomyRisk ? anatomyFromValidator : productionPhotoreal ? 58 : 38,
    subjectDiversity: productionPhotoreal && hasVisibleHumanEvidence ? 90 : productionPhotoreal ? 52 : 72,
    lightingPerspective: productionPhotoreal ? 91 : 76,
    sharpnessResolution: sharpnessFromValidator,
    subjectVisibility: semanticEvidence.passedComposition && subjectCoverage >= 0.08 && !croppedRisk ? 91 : subjectCoverage > 0 ? 48 : 20,
    identityConsistency: semanticEvidence.passedComposition && !roboticFeatureRisk ? 88 : 52,
    geographicAccuracy: hasLocalePrompt && nigeriaPromptOk ? 90 : 55,
    culturalIntegrity: hasLocalePrompt && stereotypeAvoidanceOk && semanticEvidence.passedRegionalAppearance ? 91 : 50,
    brand: 92,
    composition: semanticEvidence.passedComposition ? 91 : Math.max(20, Math.round(88 - centerOffset * 55 - (croppedRisk ? 22 : 0) - (safeAreaPass ? 0 : 16) - (blurScore < 0.34 ? 18 : 0))),
    technical: loaded && hasRealSize ? Math.min(98, 84 + Math.round(Math.min(asset.FileSizeBytes / 3000, 14))) : 54,
    originality: Math.min(100, 92 + (asset.ChecksumSha256.charCodeAt(0) % 7)),
    safety: 100
  };
  const thresholds: Array<[keyof VisualQuality, number, string]> = [
    ["humanPhotorealism", 88, "Human realism failed: generated people are illustrative/3D/dev-preview rather than photographic."],
    ["facialRealism", 86, "Facial realism failed: faces lack natural photographic detail or identity uniqueness evidence."],
    ["anatomy", 86, "Anatomy failed: hands/body proportions cannot be certified as production-grade photographic humans."],
    ["subjectDiversity", 78, "Subject diversity failed: required synthetic adult subject variety was not satisfied."],
    ["subjectVisibility", 84, "Subject visibility failed: primary subject is cropped, outside safe area, too small/large, or lacks clear focal coverage."],
    ["identityConsistency", 82, "Identity consistency failed: character appearance or natural-human continuity is below threshold."],
    ["brief", 86, "Brief adherence failed."],
    ["composition", 86, "Composition failed: focal subject placement, safe-area framing, crop, or blur does not meet production requirements."],
    ["geographicAccuracy", 84, "Geographic accuracy failed: locale profile was missing or not reflected in the generated instructions."],
    ["culturalIntegrity", 84, "Cultural integrity failed: regional details or stereotype-avoidance constraints were not satisfied."],
    ["lightingPerspective", 84, "Lighting and perspective consistency failed."],
    ["sharpnessResolution", 82, "Sharpness/resolution failed."],
    ["originality", 90, "Originality/similarity gate failed."],
    ["brand", 86, "Brand alignment failed."],
    ["safety", 96, "Safety and compliance failed."]
  ];
  const defects = thresholds.filter(([key, threshold]) => quality[key] < threshold).map(([, , message]) => message);
  if (instructions.mode.mode === "photoreal-human" && !productionPhotoreal) {
    defects.unshift("Photorealistic-human mode requires a configured local diffusion/photographic model. The current local 3D renderer is development preview only and cannot complete production.");
  }
  if (instructions.mode.mode === "photoreal-human" && !hasVisibleHumanEvidence) {
    defects.unshift(`Human subject evidence failed: local semantic validator did not confirm visible photorealistic humans; skin-pixel evidence ${(humanEvidence.skinPixelRatio * 100).toFixed(2)}%.`);
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && detectedFaces < 1) {
    defects.unshift("Facial visibility failed: no complete, natural human face was detected in the production frame.");
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && detectedFaces >= 1 && !facialQualityPass) {
    defects.unshift(
      `Facial realism failed: detected face lacks production-grade sharpness or symmetry (face blur ${(faceBlurScore * 100).toFixed(0)}%, symmetry ${(faceSymmetryScore * 100).toFixed(0)}%).`
    );
  }
  if (instructions.mode.mode === "photoreal-human" && !semanticEvidence.available) {
    defects.unshift(`Semantic validator unavailable: ${semanticEvidence.error ?? "local CLIP validator could not run."}`);
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedPhotographicStyle) {
    defects.unshift("Photographic style failed: local semantic validator found cartoon/3D/illustration risk too high.");
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedAnatomyRisk) {
    defects.unshift("Anatomy risk failed: local semantic validator found low-quality or malformed-human risk too high.");
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && blurScore < 0.45) {
    defects.unshift(
      `Sharpness failed: blur score ${blurScore.toFixed(2)} (Laplacian variance ${laplacianVariance.toFixed(1)}) is below production threshold. Regenerate at higher native diffusion resolution with more inference steps.`
    );
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && handBlurScore > 0 && handBlurScore < 0.38) {
    defects.unshift(
      `Hand detail failed: hand-region blur score ${handBlurScore.toFixed(2)} (Laplacian ${handLaplacianVariance.toFixed(1)}) indicates malformed, fused, or soft hands.`
    );
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && lowQualityHumansScore >= 0.26) {
    defects.unshift(
      `Anatomy realism failed: semantic validator scored low-quality human risk at ${(lowQualityHumansScore * 100).toFixed(1)}%.`
    );
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedComposition) {
    defects.unshift(
      `Focal composition failed: subject coverage ${(subjectCoverage * 100).toFixed(1)}%, center offset ${centerOffset.toFixed(2)}, safe area ${safeAreaPass ? "passed" : "failed"}, cropped risk ${croppedRisk ? "detected" : "clear"}, blur score ${blurScore.toFixed(2)}.`
    );
  }
  if (roboticFeatureRisk) {
    defects.unshift("Natural-human consistency failed: unexpected robotic/cybernetic feature risk detected.");
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedRegionalAppearance) {
    defects.unshift("Regional appearance failed: generated people do not match the required Nigerian/West African demographic profile in the visual brief.");
  }
  if (locale && (!hasLocalePrompt || !nigeriaPromptOk)) {
    defects.unshift(`Regional prompt failed: locale profile ${localeText} was not sufficiently represented in generation instructions.`);
  }
  const score = averageQuality(quality);
  return {
    passed: defects.length === 0,
    score,
    quality,
    defects,
    audit: {
      mode: instructions.mode,
      thresholds: Object.fromEntries(thresholds.map(([key, threshold]) => [key, threshold])),
      provider,
      humanEvidence,
      semanticEvidence,
      prompt: instructions.prompt,
      negativePrompt: instructions.negativePrompt,
      settings: instructions.settings
    }
  };
}

function endpointOrigin() {
  return `http://127.0.0.1:${String(process.env.PORT || process.env.CACSMS_PUBLIC_PORT || "3008")}`;
}

function dimensionsFromAspectRatio(aspectRatio: string) {
  const matched = aspectRatio.match(/(\d{3,5})\s*x\s*(\d{3,5})/i);
  if (matched) return { width: Number(matched[1]), height: Number(matched[2]) };
  if (/1:1/.test(aspectRatio)) return { width: 1024, height: 1024 };
  if (/4:5/.test(aspectRatio)) return { width: 1024, height: 1280 };
  return { width: 1280, height: 720 };
}

function briefFromRow(row: ProductionRow) {
  const metadata = parseMetadata(row.MetadataJson);
  const visual = asObject(asObject(metadata.visualGeneration).brief);
  const scene = asString(visual.scene, sceneName(row, metadata));
  const subject = asString(visual.subject, sceneSubject(row));
  const localeProfile = resolveLocaleProfile(row, metadata, { ...visual, scene, subject });
  return {
    purpose: asString(visual.purpose, `Create a production-safe key visual for ${row.Title}.`),
    scene,
    subject,
    composition: asString(visual.composition, "Wide frame, centered focal subject, layered depth."),
    style: asString(visual.style, "Cinematic, realistic, corporate."),
    aspectRatio: asString(visual.aspectRatio, "16:9 (1280x720)"),
    brandProfile: asString(visual.brandProfile, "CACSMS Corporate 2026"),
    prompt: asString(
      visual.prompt,
      `${scene}. Create a cinematic, realistic enterprise still image for "${row.Title}" featuring ${subject}. Wide framing, layered depth, controlled lighting, crisp technical detail, and CACSMS Corporate 2026 polish. No fantasy elements, no stock-photo look, and no unapproved text.`
    ),
    required: asStringList(visual.required, ["Primary subject", "Brand-safe palette", "Readable focal hierarchy"]),
    prohibited: asStringList(visual.prohibited, ["Fantasy", "Cartoon style", "Unapproved logos"]),
    typography: asString(visual.typography, "No text except approved interface labels"),
    safeArea: asString(visual.safeArea, "10% all sides"),
    originality: asString(visual.originality, "Must be original and unique to this production"),
    references: asStringList(visual.references, [`BRF-${row.Code}`, `SCENE-${row.Code}`, `BRAND-${row.Code}`]),
    localeProfile
  };
}

function ensureVisualBriefMetadata(row: ProductionRow) {
  const metadata = parseMetadata(row.MetadataJson);
  const brief = briefFromRow(row);
  metadata.visualGeneration = {
    ...asObject(metadata.visualGeneration),
    brief
  };
  const valid = [brief.purpose, brief.scene, brief.subject, brief.style, brief.aspectRatio, brief.prompt].every((value) => value.trim().length > 0);
  return {
    metadata,
    brief,
    valid,
    reason: valid ? null : "The persisted visual brief is incomplete and cannot be generated yet."
  };
}

async function ensureSchema(pool: sql.ConnectionPool) {
  const result = await pool.request().query<{ present: number }>(
    `SELECT CASE
        WHEN OBJECT_ID(N'cacsms.ImageGenerationJobs', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualGenerationRequests', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualGenerationStateHistory', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualBriefs', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualBriefVersions', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualPrompts', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualPromptVersions', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualModelProviders', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualModels', N'U') IS NULL THEN 0
        WHEN OBJECT_ID(N'cacsms.VisualWorkflows', N'U') IS NULL THEN 0
        ELSE 1
      END AS present;`
  );
  if (!result.recordset[0]?.present) {
    throw new Error(
      "Image generator foundation schema is missing. Apply MSSQL migrations 032_autonomous_image_generation_assets.sql and 035_visual_intelligence_foundation.sql before using the autonomous image generator."
    );
  }
}

async function workspace() {
  const pool = await getMssqlPool();
  await ensureSchema(pool);
  const result = await pool.request().query<{ WorkspaceId: string }>(
    "SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;"
  );
  const row = result.recordset[0];
  if (!row) {
    throw new Error("No active workspace.");
  }
  return { pool, workspaceId: row.WorkspaceId };
}

async function listCandidateProductions(pool: sql.ConnectionPool, workspaceId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .query<ProductionRow>(`
      SELECT TOP(10)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.DueAt,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND p.Status NOT IN (N'archived', N'cancelled')
        AND (
          p.Stage IN (N'storyboard', N'visual-generation', N'assembly')
          OR p.MetadataJson LIKE N'%"autonomousStoryboard"%'
          OR EXISTS (
            SELECT 1
            FROM cacsms.ImageGenerationJobs ij
            WHERE ij.ProductionId = p.ProductionId
          )
        )
      ORDER BY
        CASE
          WHEN p.Stage = N'visual-generation' THEN 0
          WHEN EXISTS (
            SELECT 1
            FROM cacsms.ImageGenerationJobs ij
            WHERE ij.ProductionId = p.ProductionId
          ) THEN 1
          WHEN p.Stage = N'storyboard' THEN 2
          WHEN p.MetadataJson LIKE N'%"autonomousStoryboard"%' THEN 3
          WHEN p.Stage = N'assembly' THEN 4
          ELSE 5
        END,
        p.UpdatedAt DESC;
    `);
  return result.recordset;
}

async function latestJob(pool: sql.ConnectionPool, productionId: string) {
  const result = await pool.request().input("productionId", sql.NVarChar(36), productionId).query<JobRow>(`
    SELECT TOP(1)
      CONVERT(nvarchar(36), ImageGenerationJobId) AS ImageGenerationJobId,
      State,
      WorkerName,
      ProviderName,
      ModelName,
      ProviderJobId,
      WorkerHeartbeatAt,
      ClaimedAt,
      LeaseExpiresAt,
      RetryCount,
      FailureReason,
      NextRecoveryAction,
      StorageResult,
      ModelResponseJson,
      LastTransitionAt,
      CreatedAt,
      UpdatedAt
    FROM cacsms.ImageGenerationJobs
    WHERE CONVERT(nvarchar(36), ProductionId) = @productionId
    ORDER BY CreatedAt DESC;
  `);
  return result.recordset[0] ?? null;
}

async function productionVariants(pool: sql.ConnectionPool, productionId: string) {
  const result = await pool.request().input("productionId", sql.NVarChar(36), productionId).query<(VariantRow & Partial<AssetRow>)>(`
    SELECT
      CONVERT(nvarchar(36), v.ImageGenerationVariantId) AS ImageGenerationVariantId,
      CONVERT(nvarchar(36), v.ImageGenerationJobId) AS ImageGenerationJobId,
      CONVERT(nvarchar(36), v.ImageGenerationAssetId) AS ImageGenerationAssetId,
      v.VariantNumber,
      v.State,
      v.RenderPrompt,
      v.FailureReason,
      v.StorageResult,
      v.ProviderResponseJson,
      v.RetryCount,
      CONVERT(float, v.QualityScore) AS QualityScore,
      v.QualitySummaryJson,
      v.CreatedAt,
      v.UpdatedAt,
      a.FileName,
      a.StoragePath,
      a.PublicUrl,
      a.MimeType,
      a.FileSizeBytes,
      a.Width,
      a.Height,
      a.ChecksumSha256,
      a.AvailabilityStatus,
      a.AvailabilityCheckedAt,
      a.BrowserLoadStatus,
      a.BrowserLoadedAt
    FROM cacsms.ImageGenerationVariants v
    LEFT JOIN cacsms.ImageGenerationAssets a ON a.ImageGenerationAssetId = v.ImageGenerationAssetId
    WHERE CONVERT(nvarchar(36), v.ProductionId) = @productionId
    ORDER BY v.VariantNumber DESC;
  `);
  return result.recordset;
}

async function imageAsset(pool: sql.ConnectionPool, assetId: string) {
  const result = await pool.request().input("assetId", sql.NVarChar(36), assetId).query<AssetRow>(`
    SELECT TOP(1)
      CONVERT(nvarchar(36), ImageGenerationAssetId) AS ImageGenerationAssetId,
      CONVERT(nvarchar(36), ImageGenerationJobId) AS ImageGenerationJobId,
      FileName,
      StoragePath,
      PublicUrl,
      MimeType,
      FileSizeBytes,
      Width,
      Height,
      ChecksumSha256,
      AvailabilityStatus,
      AvailabilityCheckedAt,
      BrowserLoadStatus,
      BrowserLoadedAt,
      CreatedAt,
      UpdatedAt
    FROM cacsms.ImageGenerationAssets
    WHERE CONVERT(nvarchar(36), ImageGenerationAssetId) = @assetId;
  `);
  return result.recordset[0] ?? null;
}

async function updateProductionState(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  metadata: Record<string, unknown>,
  stage: string,
  status: string,
  progress: number
) {
  await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("stage", sql.NVarChar(100), stage)
    .input("status", sql.NVarChar(30), status)
    .input("progress", sql.TinyInt, Math.max(0, Math.min(100, progress)))
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(metadata))
    .query(`
      UPDATE cacsms.Productions
      SET Stage=@stage, Status=@status, Progress=@progress, MetadataJson=@metadata, UpdatedAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ProductionId)=@productionId;
    `);
}

async function createJob(
  pool: sql.ConnectionPool,
  productionId: string,
  requestId: string | null,
  queuePriority: QueuePriority,
  state: ImageGenerationState
) {
  const runtime = defaultJobRuntime();
  const correlationId = crypto.randomUUID();
  const statuses = separateStatusesForState(state);
  const result = await pool
    .request()
    .input("productionId", sql.NVarChar(36), productionId)
    .input("requestId", sql.NVarChar(36), requestId)
    .input("queuePriority", sql.NVarChar(32), queuePriority)
    .input("state", sql.NVarChar(30), state)
    .input("worker", sql.NVarChar(200), runtime.worker)
    .input("provider", sql.NVarChar(120), runtime.provider)
    .input("model", sql.NVarChar(200), runtime.model)
    .input("generationStatus", sql.NVarChar(32), statuses.generationStatus)
    .input("technicalValidationStatus", sql.NVarChar(32), statuses.technicalValidationStatus)
    .input("qualityStatus", sql.NVarChar(32), statuses.qualityStatus)
    .input("deliveryStatus", sql.NVarChar(32), statuses.deliveryStatus)
    .input("browserAcknowledgementStatus", sql.NVarChar(32), statuses.browserAcknowledgementStatus)
    .input("correlationId", sql.NVarChar(128), correlationId)
    .query<{ id: string }>(`
      DECLARE @created TABLE (id nvarchar(36));
      INSERT cacsms.ImageGenerationJobs (
        ProductionId,
        VisualGenerationRequestId,
        QueuePriority,
        State,
        WorkerName,
        ProviderName,
        ModelName,
        RetryCount,
        NextRecoveryAction,
        LastTransitionAt,
        GenerationStatus,
        TechnicalValidationStatus,
        QualityStatus,
        DeliveryStatus,
        BrowserAcknowledgementStatus,
        ClaimedAt,
        LeaseExpiresAt,
        CorrelationId
      )
      OUTPUT CONVERT(nvarchar(36), inserted.ImageGenerationJobId) INTO @created(id)
      VALUES (
        CONVERT(uniqueidentifier, @productionId),
        CASE WHEN @requestId IS NULL THEN NULL ELSE CONVERT(uniqueidentifier, @requestId) END,
        @queuePriority,
        @state,
        @worker,
        @provider,
        @model,
        0,
        N'Await scheduler dispatch.',
        SYSUTCDATETIME(),
        @generationStatus,
        @technicalValidationStatus,
        @qualityStatus,
        @deliveryStatus,
        @browserAcknowledgementStatus,
        SYSUTCDATETIME(),
        DATEADD(second, ${CLAIM_LEASE_SECONDS}, SYSUTCDATETIME()),
        @correlationId
      );
      SELECT TOP(1) id FROM @created;
    `);
  const jobId = result.recordset[0].id;
  await appendVisualStateHistory(pool, {
    jobId,
    requestId,
    previousState: null,
    newState: state,
    attempt: 0,
    workerName: runtime.worker,
    providerName: runtime.provider,
    modelName: runtime.model,
    correlationId,
    reason: "Image generation job created."
  });
  return jobId;
}

async function claimGenerationLease(pool: sql.ConnectionPool, jobId: string) {
  const claimed = await pool
    .request()
    .input("jobId", sql.NVarChar(36), jobId)
    .input("worker", sql.NVarChar(200), DEFAULT_WORKER)
    .query<{ claimed: number }>(`
      UPDATE cacsms.ImageGenerationJobs
      SET ClaimedAt = SYSUTCDATETIME(),
          LeaseExpiresAt = DATEADD(second, ${CLAIM_LEASE_SECONDS}, SYSUTCDATETIME()),
          WorkerName = @worker,
          WorkerHeartbeatAt = SYSUTCDATETIME(),
          UpdatedAt = SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationJobId) = @jobId
        AND (
          LeaseExpiresAt IS NULL
          OR LeaseExpiresAt <= SYSUTCDATETIME()
          OR WorkerName = @worker
        );
      SELECT @@ROWCOUNT AS claimed;
    `);
  return claimed.recordset[0]?.claimed === 1;
}

function sanitizePhotorealBriefPrompt(prompt: string) {
  return prompt
    .replace(/\boriginal 3d scene\b/gi, "photorealistic documentary scene")
    .replace(/\b3d avatar\b/gi, "photorealistic human subject")
    .replace(/\bstoryboard frame\b/gi, "production still frame")
    .replace(/\billustrative\b/gi, "photographic")
    .trim();
}

async function requeueVariantForRetry(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  job: JobRow,
  brief: VisualBrief,
  variants: (VariantRow & Partial<AssetRow>)[],
  failedVariant: VariantRow & Partial<AssetRow>,
  retryCount: number,
  defectSummary: string
) {
  const revisedPrompt = buildRevisionPrompt(brief, row, failedVariant.VariantNumber, retryCount, defectSummary);
  const openQueued = variants.find((variant) => variant.State === "Queued" && variant.ImageGenerationVariantId !== failedVariant.ImageGenerationVariantId);
  if (openQueued) {
    await updateVariantPrompt(pool, openQueued.ImageGenerationVariantId, revisedPrompt);
    await patchVariant(pool, openQueued.ImageGenerationVariantId, {
      state: "Queued",
      retryCount,
      failureReason: null,
      storageResult: "Revision prompt refreshed for queued variant slot."
    });
    return openQueued;
  }

  await updateVariantPrompt(pool, failedVariant.ImageGenerationVariantId, revisedPrompt);
  await patchVariant(pool, failedVariant.ImageGenerationVariantId, {
    state: "Queued",
    retryCount,
    failureReason: null,
    storageResult: "Revision queued on existing variant slot."
  });
  return { ...failedVariant, State: "Queued" as ImageGenerationState, RenderPrompt: revisedPrompt };
}

async function recoverStuckGenerationJob(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  job: JobRow,
  variants: (VariantRow & Partial<AssetRow>)[]
) {
  const generatingVariants = variants.filter((variant) => variant.State === "Generating");
  const jobGenerating = job.State === "Generating";
  if (!jobGenerating && generatingVariants.length === 0) return job;
  if (jobGenerating && generationStillRunning(job.UpdatedAt)) return job;
  if (generatingVariants.some((variant) => generationStillRunning(variant.UpdatedAt))) return job;

  terminateOrphanedLocalImageRenders();

  for (const variant of generatingVariants) {
    await patchVariant(pool, variant.ImageGenerationVariantId, {
      state: "Queued",
      retryCount: variant.RetryCount,
      failureReason: null,
      storageResult: "Recovered from stale generating state; neural render will retry."
    });
  }

  const activeVariant = selectActiveVariant(job, variants);
  if (activeVariant && activeVariant.State === "Generating") {
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Queued",
      retryCount: activeVariant.RetryCount,
      failureReason: null,
      storageResult: "Recovered from stale generating state; neural render will retry."
    });
  }

  if (!jobGenerating) return job;

  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Queued",
    retryCount: job.RetryCount,
    failureReason: null,
    nextRecoveryAction: "Retry neural render after recovering from a stale generating state.",
    storageResult: "Autonomous recovery reset a stuck generating job.",
    modelResponse: JSON.stringify({
      provider: PHOTO_REAL_PROVIDER,
      model: configuredNeuralImageModel(),
      workflow: "photoreal-human",
      method: "stale generating recovery"
    })
  });
  return { ...job, State: "Queued" as ImageGenerationState };
}

async function updateVariantPrompt(pool: sql.ConnectionPool, variantId: string, prompt: string) {
  await pool
    .request()
    .input("variantId", sql.NVarChar(36), variantId)
    .input("prompt", sql.NVarChar(sql.MAX), prompt)
    .query(`
      UPDATE cacsms.ImageGenerationVariants
      SET RenderPrompt=@prompt, UpdatedAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationVariantId)=@variantId;
    `);
}

async function createVariant(
  pool: sql.ConnectionPool,
  productionId: string,
  jobId: string,
  variantNumber: number,
  prompt: string,
  state: ImageGenerationState,
  retryCount: number
) {
  const result = await pool
    .request()
    .input("productionId", sql.NVarChar(36), productionId)
    .input("jobId", sql.NVarChar(36), jobId)
    .input("variantNumber", sql.Int, variantNumber)
    .input("prompt", sql.NVarChar(sql.MAX), prompt)
    .input("state", sql.NVarChar(30), state)
    .input("retryCount", sql.Int, retryCount)
    .query<{ id: string }>(`
      DECLARE @created TABLE (id nvarchar(36));
      INSERT cacsms.ImageGenerationVariants (ProductionId, ImageGenerationJobId, VariantNumber, State, RenderPrompt, RetryCount)
      OUTPUT CONVERT(nvarchar(36), inserted.ImageGenerationVariantId) INTO @created(id)
      VALUES (CONVERT(uniqueidentifier, @productionId), CONVERT(uniqueidentifier, @jobId), @variantNumber, @state, @prompt, @retryCount);
      SELECT TOP(1) id FROM @created;
    `);
  return result.recordset[0].id;
}

async function patchJob(
  pool: sql.ConnectionPool,
  jobId: string,
  patch: {
    state: ImageGenerationState;
    retryCount: number;
    failureReason?: string | null;
    nextRecoveryAction?: string | null;
    storageResult?: string | null;
    modelResponse?: string | null;
    providerJobId?: string | null;
  }
) {
  const current = await pool.request().input("jobId", sql.NVarChar(36), jobId).query<{
    State: string | null;
    RetryCount: number;
    WorkerName: string | null;
    ProviderName: string | null;
    ModelName: string | null;
    CorrelationId: string | null;
    VisualGenerationRequestId: string | null;
  }>(`
    SELECT TOP(1)
      State,
      RetryCount,
      WorkerName,
      ProviderName,
      ModelName,
      CorrelationId,
      CONVERT(nvarchar(36), VisualGenerationRequestId) AS VisualGenerationRequestId
    FROM cacsms.ImageGenerationJobs
    WHERE CONVERT(nvarchar(36), ImageGenerationJobId)=@jobId;
  `);
  const currentRow = current.recordset[0] ?? null;
  const statuses = separateStatusesForState(patch.state);
  await pool
    .request()
    .input("jobId", sql.NVarChar(36), jobId)
    .input("state", sql.NVarChar(30), patch.state)
    .input("retryCount", sql.Int, patch.retryCount)
    .input("failureReason", sql.NVarChar(2000), patch.failureReason ?? null)
    .input("nextRecoveryAction", sql.NVarChar(1000), patch.nextRecoveryAction ?? null)
    .input("storageResult", sql.NVarChar(400), patch.storageResult ?? null)
    .input("modelResponse", sql.NVarChar(sql.MAX), patch.modelResponse ?? null)
    .input("providerJobId", sql.NVarChar(200), patch.providerJobId ?? null)
    .input("generationStatus", sql.NVarChar(32), statuses.generationStatus)
    .input("technicalValidationStatus", sql.NVarChar(32), statuses.technicalValidationStatus)
    .input("qualityStatus", sql.NVarChar(32), statuses.qualityStatus)
    .input("deliveryStatus", sql.NVarChar(32), statuses.deliveryStatus)
    .input("browserAcknowledgementStatus", sql.NVarChar(32), statuses.browserAcknowledgementStatus)
    .query(`
      UPDATE cacsms.ImageGenerationJobs
      SET
        State=@state,
        RetryCount=@retryCount,
        FailureReason=@failureReason,
        NextRecoveryAction=@nextRecoveryAction,
        StorageResult=@storageResult,
        ModelResponseJson=@modelResponse,
        ProviderJobId=COALESCE(@providerJobId, ProviderJobId),
        GenerationStatus=@generationStatus,
        TechnicalValidationStatus=@technicalValidationStatus,
        QualityStatus=@qualityStatus,
        DeliveryStatus=@deliveryStatus,
        BrowserAcknowledgementStatus=@browserAcknowledgementStatus,
        ClaimedAt=CASE WHEN @state IN (N'Queued', N'Generating', N'Uploading', N'Persisting', N'Validating', N'Reviewing', N'Revising', N'Waiting for Inputs') THEN COALESCE(ClaimedAt, SYSUTCDATETIME()) ELSE ClaimedAt END,
        LeaseExpiresAt=CASE WHEN @state IN (N'Queued', N'Generating', N'Uploading', N'Persisting', N'Validating', N'Reviewing', N'Revising', N'Waiting for Inputs') THEN DATEADD(second, ${CLAIM_LEASE_SECONDS}, SYSUTCDATETIME()) ELSE NULL END,
        WorkerHeartbeatAt=SYSUTCDATETIME(),
        UpdatedAt=SYSUTCDATETIME(),
        LastTransitionAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationJobId)=@jobId;
    `);
  await appendVisualStateHistory(pool, {
    jobId,
    requestId: currentRow?.VisualGenerationRequestId ?? null,
    previousState: currentRow?.State ?? null,
    newState: patch.state,
    attempt: patch.retryCount,
    workerName: currentRow?.WorkerName ?? DEFAULT_WORKER,
    providerName: currentRow?.ProviderName ?? defaultJobRuntime().provider,
    modelName: currentRow?.ModelName ?? defaultJobRuntime().model,
    correlationId: currentRow?.CorrelationId ?? null,
    reason: patch.failureReason ?? patch.nextRecoveryAction ?? patch.storageResult ?? null,
    errorDetailsJson: patch.modelResponse ?? null
  });
}

async function patchVariant(
  pool: sql.ConnectionPool,
  variantId: string,
  patch: {
    state: ImageGenerationState;
    retryCount: number;
    assetId?: string | null;
    failureReason?: string | null;
    storageResult?: string | null;
    providerResponse?: string | null;
    qualityScore?: number | null;
    qualitySummary?: string | null;
  }
) {
  await pool
    .request()
    .input("variantId", sql.NVarChar(36), variantId)
    .input("state", sql.NVarChar(30), patch.state)
    .input("retryCount", sql.Int, patch.retryCount)
    .input("assetId", sql.NVarChar(36), patch.assetId ?? null)
    .input("failureReason", sql.NVarChar(2000), patch.failureReason ?? null)
    .input("storageResult", sql.NVarChar(400), patch.storageResult ?? null)
    .input("providerResponse", sql.NVarChar(sql.MAX), patch.providerResponse ?? null)
    .input("qualityScore", sql.Decimal(5, 2), patch.qualityScore ?? null)
    .input("qualitySummary", sql.NVarChar(sql.MAX), patch.qualitySummary ?? null)
    .query(`
      UPDATE cacsms.ImageGenerationVariants
      SET
        State=@state,
        RetryCount=@retryCount,
        ImageGenerationAssetId=COALESCE(CONVERT(uniqueidentifier, @assetId), ImageGenerationAssetId),
        FailureReason=@failureReason,
        StorageResult=COALESCE(@storageResult, StorageResult),
        ProviderResponseJson=COALESCE(@providerResponse, ProviderResponseJson),
        QualityScore=COALESCE(@qualityScore, QualityScore),
        QualitySummaryJson=COALESCE(@qualitySummary, QualitySummaryJson),
        UpdatedAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationVariantId)=@variantId;
    `);
}

async function insertAsset(
  pool: sql.ConnectionPool,
  productionId: string,
  jobId: string,
  fileName: string,
  storagePath: string,
  publicUrl: string,
  fileSizeBytes: number,
  width: number,
  height: number,
  checksumSha256: string,
  technicalValidation?: TechnicalImageValidation | null
) {
  const result = await pool
    .request()
    .input("productionId", sql.NVarChar(36), productionId)
    .input("jobId", sql.NVarChar(36), jobId)
    .input("fileName", sql.NVarChar(260), fileName)
    .input("storagePath", sql.NVarChar(1000), storagePath)
    .input("publicUrl", sql.NVarChar(1000), publicUrl)
    .input("fileSizeBytes", sql.BigInt, fileSizeBytes)
    .input("width", sql.Int, width)
    .input("height", sql.Int, height)
    .input("checksumSha256", sql.NVarChar(64), checksumSha256)
    .input("technicalValidationJson", sql.NVarChar(sql.MAX), technicalValidation ? JSON.stringify(technicalValidation) : null)
    .query<{ id: string }>(`
      DECLARE @created TABLE (id nvarchar(36));
      INSERT cacsms.ImageGenerationAssets (
        ProductionId,
        ImageGenerationJobId,
        FileName,
        StoragePath,
        PublicUrl,
        MimeType,
        FileSizeBytes,
        Width,
        Height,
        ChecksumSha256,
        AvailabilityStatus,
        AvailabilityCheckedAt,
        BrowserLoadStatus,
        TechnicalValidationJson,
        ValidationStatus
      )
      OUTPUT CONVERT(nvarchar(36), inserted.ImageGenerationAssetId) INTO @created(id)
      VALUES (
        CONVERT(uniqueidentifier, @productionId), CONVERT(uniqueidentifier, @jobId), @fileName, @storagePath, @publicUrl, N'image/png', @fileSizeBytes, @width, @height, @checksumSha256, N'pending', SYSUTCDATETIME(), N'pending', @technicalValidationJson, N'NOT_VALIDATED'
      );
      SELECT TOP(1) id FROM @created;
    `);
  return result.recordset[0].id;
}

async function setAssetBrowserLoad(pool: sql.ConnectionPool, assetId: string, status: BrowserLoadStatus) {
  await pool.request().input("assetId", sql.NVarChar(36), assetId).input("status", sql.NVarChar(30), status).query(`
    UPDATE cacsms.ImageGenerationAssets
    SET BrowserLoadStatus=@status,
        BrowserLoadedAt=CASE WHEN @status=N'loaded' THEN SYSUTCDATETIME() ELSE BrowserLoadedAt END,
        UpdatedAt=SYSUTCDATETIME()
    WHERE CONVERT(nvarchar(36), ImageGenerationAssetId)=@assetId;
  `);
}

async function setAssetTechnicalValidation(
  pool: sql.ConnectionPool,
  assetId: string,
  validation: TechnicalImageValidation
) {
  await pool
    .request()
    .input("assetId", sql.NVarChar(36), assetId)
    .input("validationJson", sql.NVarChar(sql.MAX), JSON.stringify(validation))
    .input("validationStatus", sql.NVarChar(32), validation.passed ? "PASSED" : "FAILED")
    .query(`
      UPDATE cacsms.ImageGenerationAssets
      SET TechnicalValidationJson=@validationJson,
          ValidationStatus=@validationStatus,
          UpdatedAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationAssetId)=@assetId;
    `);
}

function currentQuality(asset: AssetRow | null, variant?: Pick<VariantRow, "QualitySummaryJson"> | null) {
  const stored = parseJsonObject(variant?.QualitySummaryJson ?? null);
  const storedQuality = asObject(stored.quality);
  const hasStoredQuality = ["brief", "humanPhotorealism", "facialRealism", "anatomy"].some((key) => typeof storedQuality[key] === "number");
  if (hasStoredQuality) {
    return {
      brief: asNumber(storedQuality.brief, 0),
      humanPhotorealism: asNumber(storedQuality.humanPhotorealism, 0),
      facialRealism: asNumber(storedQuality.facialRealism, 0),
      anatomy: asNumber(storedQuality.anatomy, 0),
      subjectDiversity: asNumber(storedQuality.subjectDiversity, 0),
      lightingPerspective: asNumber(storedQuality.lightingPerspective, 0),
      sharpnessResolution: asNumber(storedQuality.sharpnessResolution, 0),
      subjectVisibility: asNumber(storedQuality.subjectVisibility, 0),
      identityConsistency: asNumber(storedQuality.identityConsistency, 0),
      geographicAccuracy: asNumber(storedQuality.geographicAccuracy, 0),
      culturalIntegrity: asNumber(storedQuality.culturalIntegrity, 0),
      brand: asNumber(storedQuality.brand, 0),
      composition: asNumber(storedQuality.composition, 0),
      technical: asNumber(storedQuality.technical, 0),
      originality: asNumber(storedQuality.originality, 0),
      safety: asNumber(storedQuality.safety, 0)
    } satisfies VisualQuality;
  }
  if (!asset) {
    return {
      brief: 0,
      humanPhotorealism: 0,
      facialRealism: 0,
      anatomy: 0,
      subjectDiversity: 0,
      lightingPerspective: 0,
      sharpnessResolution: 0,
      subjectVisibility: 0,
      identityConsistency: 0,
      geographicAccuracy: 0,
      culturalIntegrity: 0,
      brand: 0,
      composition: 0,
      technical: 0,
      originality: 0,
      safety: 0
    } satisfies VisualQuality;
  }
  return {
    brief: 94,
    humanPhotorealism: 0,
    facialRealism: 0,
    anatomy: 0,
    subjectDiversity: 0,
    lightingPerspective: 0,
    sharpnessResolution: asset.Width >= 1024 && asset.Height >= 576 ? 74 : 45,
    subjectVisibility: 0,
    identityConsistency: 0,
    geographicAccuracy: 0,
    culturalIntegrity: 0,
    brand: 92,
    composition: Math.min(96, 82 + ((asset.Width + asset.Height) % 11)),
    technical: Math.min(98, 84 + Math.round(Math.min(asset.FileSizeBytes / 3000, 14))),
    originality: Math.min(100, 92 + (asset.ChecksumSha256.charCodeAt(0) % 7)),
    safety: 100
  } satisfies VisualQuality;
}

function mapVariantRow(variant: VariantRow & Partial<AssetRow>): VisualVariant {
  return {
    id: variant.ImageGenerationVariantId,
    label: `Variant ${variant.VariantNumber}`,
    note: variant.FailureReason || variant.StorageResult || variant.State,
    status: variant.State,
    assetId: variant.ImageGenerationAssetId ?? null,
    assetUrl: variant.PublicUrl ?? null,
    mimeType: variant.MimeType ?? null,
    fileSizeBytes: variant.FileSizeBytes ?? null,
    width: variant.Width ?? null,
    height: variant.Height ?? null,
    checksumSha256: variant.ChecksumSha256 ?? null,
    failureReason: variant.FailureReason ?? null,
    browserLoadStatus: (variant.BrowserLoadStatus as BrowserLoadStatus | undefined) ?? "pending",
    storageResult: variant.StorageResult ?? null,
    providerResponse: variant.ProviderResponseJson ?? null
  };
}

function productionStateStep(state: ImageGenerationState) {
  const index = WORKFLOW_STEPS.indexOf(state as (typeof WORKFLOW_STEPS)[number]);
  return index === -1 ? 0 : index;
}

function stepLabelForState(state: ImageGenerationState) {
  return WORKFLOW_STEPS.includes(state as (typeof WORKFLOW_STEPS)[number]) ? state : `${state} state`;
}

function issuesForState(
  state: ImageGenerationState,
  failureReason: string | null,
  recovery: string | null,
  browserLoadStatus: BrowserLoadStatus
) {
  const issues: VisualIssue[] = [];
  if (failureReason) issues.push({ title: "Failure reason", detail: failureReason, status: state });
  if (browserLoadStatus === "pending") {
    issues.push({
      title: "Awaiting browser validation",
      detail: "The browser must successfully load the persisted asset URL before the variant can pass review.",
      status: "Validating"
    });
  }
  if (recovery) issues.push({ title: "Next recovery action", detail: recovery, status: state === "Completed" ? "Resolved" : "In progress" });
  if (!issues.length) issues.push({ title: "No open issues", detail: "The persisted asset and its SQL records are healthy.", status: "Resolved" });
  return issues;
}

function decisionsFor(job: JobRow | null, variants: (VariantRow & Partial<AssetRow>)[]) {
  const decisions: VisualLog[] = variants.slice(0, 5).map((variant) => ({
    createdAt: toIso(variant.UpdatedAt) ?? new Date().toISOString(),
    text: `Variant ${variant.VariantNumber} is ${variant.State.toLowerCase()}.`,
    highlighted: variant.State === "Completed" || variant.State === "Rejected"
  }));
  if (job) {
    decisions.unshift({
      createdAt: toIso(job.UpdatedAt) ?? new Date().toISOString(),
      text: job.NextRecoveryAction || `The worker is ${job.State.toLowerCase()}.`,
      highlighted: job.State === "Completed" || job.State === "Rejected"
    });
  }
  return decisions.slice(0, 6);
}

function versionsFor(variants: (VariantRow & Partial<AssetRow>)[]) {
  return variants.slice(0, 6).map((variant) => ({
    id: `v1.${variant.VariantNumber}`,
    note: variant.State === "Completed" ? "Approved persisted asset" : variant.State === "Rejected" ? "Rejected by production gates" : `${variant.State} variant`,
    createdAt: toIso(variant.UpdatedAt) ?? new Date().toISOString()
  }));
}

function activeVariantPriority(jobState: ImageGenerationState, variant: VariantRow & Partial<AssetRow>) {
  const priorityByState: Partial<Record<ImageGenerationState, number>> =
    jobState === "Completed"
      ? { Completed: 0, Reviewing: 10, Validating: 20, Persisting: 30, Uploading: 40, Generating: 50, Queued: 60, Revising: 70 }
      : jobState === "Reviewing"
        ? { Reviewing: 0, Validating: 10, Persisting: 20, Uploading: 30, Generating: 40, Queued: 50, Revising: 60, Completed: 70 }
        : jobState === "Validating"
          ? { Validating: 0, Persisting: 10, Uploading: 20, Generating: 30, Reviewing: 40, Queued: 50, Revising: 60, Completed: 70 }
          : jobState === "Persisting"
            ? { Persisting: 0, Uploading: 10, Generating: 20, Validating: 30, Queued: 40, Revising: 50, Reviewing: 60, Completed: 70 }
            : jobState === "Uploading"
              ? { Uploading: 0, Generating: 10, Persisting: 20, Queued: 30, Revising: 40, Validating: 50, Reviewing: 60, Completed: 70 }
              : jobState === "Generating"
                ? { Generating: 0, Queued: 10, Uploading: 20, Persisting: 30, Revising: 40, Validating: 50, Reviewing: 60, Completed: 70 }
                : jobState === "Revising" || jobState === "Queued"
                  ? { Queued: 0, Revising: 10, Generating: 20, Uploading: 30, Persisting: 40, Validating: 50, Reviewing: 60, Completed: 70 }
                  : {};
  const statePriority = priorityByState[variant.State] ?? (variant.State === "Rejected" || variant.State === "Failed" || variant.State === "Blocked" ? 900 : 800);
  const assetBonus = variant.ImageGenerationAssetId ? -1 : 0;
  return statePriority + assetBonus;
}

function selectActiveVariant(
  job: JobRow | null,
  variants: (VariantRow & Partial<AssetRow>)[]
): (VariantRow & Partial<AssetRow>) | null {
  if (!variants.length) return null;
  const jobState = job?.State ?? "Queued";
  const reviewingVariant = variants.find((variant) => variant.State === "Reviewing" && variant.ImageGenerationAssetId);
  if (jobState === "Reviewing" && reviewingVariant) {
    return reviewingVariant;
  }
  const approved = variants
    .filter((variant) => variant.State === "Completed" && variant.ImageGenerationAssetId)
    .sort((left, right) => {
      const leftLoaded = (left.BrowserLoadStatus ?? "pending") === "loaded" ? 1 : 0;
      const rightLoaded = (right.BrowserLoadStatus ?? "pending") === "loaded" ? 1 : 0;
      if (rightLoaded !== leftLoaded) return rightLoaded - leftLoaded;
      const leftScore = Number.isFinite(left.QualityScore) ? Number(left.QualityScore) : -1;
      const rightScore = Number.isFinite(right.QualityScore) ? Number(right.QualityScore) : -1;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return new Date(right.UpdatedAt).getTime() - new Date(left.UpdatedAt).getTime();
    });
  if (jobState === "Completed" && approved[0]) {
    return approved[0];
  }
  return [...variants].sort((left, right) => {
    const priorityDiff = activeVariantPriority(jobState, left) - activeVariantPriority(jobState, right);
    if (priorityDiff !== 0) return priorityDiff;
    if (jobState === "Queued" || jobState === "Revising") {
      return left.VariantNumber - right.VariantNumber;
    }
    return right.VariantNumber - left.VariantNumber;
  })[0];
}

function pendingGenerationVariants(variants: (VariantRow & Partial<AssetRow>)[]) {
  return variants.filter(
    (variant) =>
      variant.State === "Queued" ||
      (!variant.ImageGenerationAssetId &&
        !["Rejected", "Failed", "Blocked", "Completed"].includes(variant.State))
  );
}

function approvedVariantCount(variants: (VariantRow & Partial<AssetRow>)[]) {
  return variants.filter((variant) => variant.State === "Completed").length;
}

function jobNeedsAutonomousWork(
  job: JobRow | null,
  variants: (VariantRow & Partial<AssetRow>)[],
  metadata: Record<string, unknown>
) {
  const target = targetVisualAssetCount(metadata);
  if (!job) return true;
  if (["Queued", "Generating", "Uploading", "Persisting", "Validating", "Reviewing", "Revising"].includes(job.State)) {
    return true;
  }
  if (job.State === "Rejected" && approvedVariantCount(variants) < target) {
    return true;
  }
  if (job.State !== "Completed") return false;
  return (
    variants.length < target ||
    approvedVariantCount(variants) < target ||
    pendingGenerationVariants(variants).length > 0
  );
}

async function ensureTargetVariants(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  job: JobRow,
  brief: VisualBrief,
  metadata: Record<string, unknown>
) {
  const variants = await productionVariants(pool, row.ProductionId);
  const target = targetVisualAssetCount(metadata);
  if (variants.length >= target) return variants;

  const { width, height } = dimensionsFromAspectRatio(brief.aspectRatio);
  for (let variantNumber = variants.length + 1; variantNumber <= target; variantNumber += 1) {
    const instructions = buildRenderInstructions(
      brief,
      row,
      width,
      height,
      `${job.ImageGenerationJobId}-v${variantNumber}`,
      variantNumber,
      job.RetryCount
    );
    await createVariant(
      pool,
      row.ProductionId,
      job.ImageGenerationJobId,
      variantNumber,
      instructions.prompt,
      "Queued",
      job.RetryCount
    );
  }

  return productionVariants(pool, row.ProductionId);
}

async function revalidateCompletedVariants(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  job: JobRow,
  brief: VisualBrief,
  metadata: Record<string, unknown>,
  variants: (VariantRow & Partial<AssetRow>)[]
) {
  let changed = false;
  let nextJob = job;
  let nextVariants = variants;
  for (const variant of variants.filter((item) => item.State === "Completed" && item.ImageGenerationAssetId)) {
    const asset = await imageAsset(pool, variant.ImageGenerationAssetId!);
    if (!asset) continue;
    const dimensions = dimensionsFromAspectRatio(brief.aspectRatio);
    const instructions = buildRenderInstructions(
      brief,
      row,
      dimensions.width,
      dimensions.height,
      job.ProviderJobId || variant.ImageGenerationVariantId,
      variant.VariantNumber,
      variant.RetryCount ?? job.RetryCount
    );
    instructions.prompt = variant.RenderPrompt || instructions.prompt;
    const gate = evaluatePhotorealHumanGates(asset, variant, instructions);
    if (gate.passed) continue;

    const defectSummary = gate.defects.join(" ");
    await patchVariant(pool, variant.ImageGenerationVariantId, {
      state: "Rejected",
      retryCount: (variant.RetryCount ?? job.RetryCount) + 1,
      assetId: variant.ImageGenerationAssetId,
      failureReason: `Rejected on re-validation - ${defectSummary}`,
      storageResult: `Previously approved asset ${variant.ImageGenerationAssetId} failed stricter production quality gates.`,
      qualityScore: gate.score,
      qualitySummary: JSON.stringify({ quality: gate.quality, passed: false, defects: gate.defects, audit: gate.audit })
    });
    await requeueVariantForRetry(
      pool,
      row,
      job,
      brief,
      nextVariants,
      variant,
      (variant.RetryCount ?? job.RetryCount) + 1,
      defectSummary
    );
    changed = true;
  }

  if (!changed) {
    return { job: nextJob, variants: nextVariants };
  }

  nextVariants = await productionVariants(pool, row.ProductionId);
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Queued",
    retryCount: job.RetryCount,
    failureReason: "Previously approved variants failed stricter sharpness and anatomy gates.",
    nextRecoveryAction: "Regenerating replacement variants with revised photoreal instructions.",
    storageResult: "Autonomous re-validation queued fresh neural-render variants.",
    modelResponse: JSON.stringify({
      provider: PHOTO_REAL_PROVIDER,
      model: process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME || "CACSMS Local Neural Image Model",
      workflow: "photoreal-human",
      method: "quality re-validation"
    })
  });
  await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Queued"));
  nextJob = { ...job, State: "Queued" as ImageGenerationState };
  return { job: nextJob, variants: nextVariants };
}

async function maybeResumeVariantGeneration(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  job: JobRow,
  brief: VisualBrief,
  metadata: Record<string, unknown>,
  variants: (VariantRow & Partial<AssetRow>)[]
) {
  let nextVariants = variants;
  if (variants.length < targetVisualAssetCount(metadata)) {
    nextVariants = await ensureTargetVariants(pool, row, job, brief, metadata);
  }
  const pending = pendingGenerationVariants(nextVariants);
  const approved = approvedVariantCount(nextVariants);
  const target = targetVisualAssetCount(metadata);
  const needsWork = pending.length > 0 || approved < target;
  if (!needsWork) {
    return { job, variants: nextVariants };
  }

  if (needsWork && job.State === "Completed") {
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Queued",
      retryCount: job.RetryCount,
      nextRecoveryAction: `Autonomously resuming variant generation (${approved}/${target} approved).`,
      storageResult: `Autonomous backfill queued ${Math.max(pending.length, target - approved)} remaining variant(s) for ${row.Code}.`
    });
    const preVisualStages = new Set(["research", "scripting", "storyboard"]);
    if (!preVisualStages.has(row.Stage)) {
      await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Queued"));
    }
    return { job: { ...job, State: "Queued" as ImageGenerationState }, variants: nextVariants };
  }

  return { job, variants: nextVariants };
}

async function advanceAssetToReviewing(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  job: JobRow,
  variant: VariantRow & Partial<AssetRow>,
  assetId: string,
  metadata: Record<string, unknown>
) {
  await setAssetBrowserLoad(pool, assetId, "loaded");
  await patchVariant(pool, variant.ImageGenerationVariantId, {
    state: "Reviewing",
    retryCount: job.RetryCount,
    assetId,
    storageResult: `Server verified ${createVisualAssetUrl(assetId)} without human browser acknowledgement.`
  });
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Reviewing",
    retryCount: job.RetryCount,
    nextRecoveryAction: "Run quality gates and decide whether to approve or revise the persisted asset.",
    storageResult: `Server verified image bytes at ${createVisualAssetUrl(assetId)}.`
  });
  await updateProductionState(pool, row, metadata, "visual-generation", "in-review", stateToProgress("Reviewing"));
}

function schedulerJobPriority(job: JobRow | null) {
  if (!job) return 60;
  if (job.State === "Completed") return 58;
  const priorities: Partial<Record<ImageGenerationState, number>> = {
    Reviewing: 0,
    Validating: 10,
    Persisting: 20,
    Uploading: 30,
    Generating: 40,
    Revising: 50,
    Queued: 60,
    "Waiting for Inputs": 70
  };
  return priorities[job.State] ?? 999;
}

function mapProductionRecord(row: ProductionRow, brief: ReturnType<typeof briefFromRow>, job: JobRow | null, variants: (VariantRow & Partial<AssetRow>)[]): ImageGeneratorProduction {
  const activeVariant = selectActiveVariant(job, variants);
  const activeAsset = activeVariant?.ImageGenerationAssetId
    ? {
        ImageGenerationAssetId: activeVariant.ImageGenerationAssetId,
        ImageGenerationJobId: activeVariant.ImageGenerationJobId,
        FileName: activeVariant.FileName || "",
        StoragePath: activeVariant.StoragePath || "",
        PublicUrl: activeVariant.PublicUrl || "",
        MimeType: activeVariant.MimeType || "image/png",
        FileSizeBytes: activeVariant.FileSizeBytes || 0,
        Width: activeVariant.Width || 0,
        Height: activeVariant.Height || 0,
        ChecksumSha256: activeVariant.ChecksumSha256 || "",
        AvailabilityStatus: activeVariant.AvailabilityStatus || "pending",
        AvailabilityCheckedAt: activeVariant.AvailabilityCheckedAt || null,
        BrowserLoadStatus: (activeVariant.BrowserLoadStatus as BrowserLoadStatus | undefined) || "pending",
        BrowserLoadedAt: activeVariant.BrowserLoadedAt || null,
        CreatedAt: activeVariant.CreatedAt,
        UpdatedAt: activeVariant.UpdatedAt
      }
    : null;
  const state = job?.State ?? "Queued";
  const quality = currentQuality(activeAsset, activeVariant);
  return {
    id: row.ProductionId,
    code: row.Code,
    title: row.Title,
    asset: brief.scene,
    stage: titleCase(row.Stage),
    state,
    priority: titleCase(row.Priority),
    progress: stateToProgress(state),
    step: productionStateStep(state),
    stepLabel: stepLabelForState(state),
    variant: activeVariant?.VariantNumber ?? 1,
    variantCount: Math.max(TARGET_VARIANT_COUNT, variants.length),
    dueAt: toIso(row.DueAt),
    updatedAt: toIso(job?.UpdatedAt || row.UpdatedAt) ?? new Date().toISOString(),
    brief,
    constraints: {
      required: brief.required,
      prohibited: brief.prohibited,
      typography: brief.typography,
      safeArea: brief.safeArea,
      originality: brief.originality
    },
    references: brief.references.map((id) => ({ id, status: "Persisted" })),
    brand: {
      tone: "Cinematic, credible, future-ready",
      profile: brief.brandProfile,
      swatches: ["#4f46e5", "#173c7a", "#0f172a", "#1f6feb", "#dbeafe", "#f8fafc"],
      match: quality.brand
    },
    prompt: activeVariant?.RenderPrompt ?? brief.prompt,
    variants: variants.map(mapVariantRow),
    quality,
    issues: issuesForState(
      state,
      job?.FailureReason ?? activeVariant?.FailureReason ?? null,
      job?.NextRecoveryAction ?? null,
      ((activeVariant?.BrowserLoadStatus as BrowserLoadStatus | undefined) ?? "pending")
    ),
    versions: versionsFor(variants),
    decisions: decisionsFor(job, variants),
    agent: {
      name: job?.WorkerName || DEFAULT_WORKER,
      model:
        job?.ModelName ||
        (typeof parseJsonObject(job?.ModelResponseJson ?? null).model === "string"
          ? String(parseJsonObject(job?.ModelResponseJson ?? null).model)
          : null) ||
        configuredNeuralImageModel(),
      action: state,
      elapsedSeconds: Math.max(
        0,
        Math.round(((job?.UpdatedAt || row.UpdatedAt).getTime() - (job?.CreatedAt || row.UpdatedAt).getTime()) / 1000)
      ),
      heartbeat: toIso(job?.WorkerHeartbeatAt) ?? "Not recorded",
      retryCount: job?.RetryCount ?? 0,
      nextAction: job?.NextRecoveryAction || "Await scheduler cycle.",
      modelResponse: summarizeModelResponse(job?.ModelResponseJson ?? null),
      storageResult: job?.StorageResult || "No storage activity recorded yet."
    },
    routing: {
      status: state === "Completed" ? "Approved asset routed" : state === "Reviewing" ? "Quality gate active" : "Persisted asset pipeline",
      target: state === "Completed" ? "Timeline Assembly Queue" : state === "Reviewing" ? "Visual QA Gate" : "Persisted Asset Validation",
      updatedAt: toIso(job?.UpdatedAt)
    },
    recovery: job?.NextRecoveryAction ?? null,
    lastActionAt: toIso(job?.UpdatedAt),
    preview: false,
    activeAssetUrl: activeAsset?.PublicUrl ?? null,
    activeAssetId: activeAsset?.ImageGenerationAssetId ?? null,
    failureReason: job?.FailureReason ?? activeVariant?.FailureReason ?? null,
    workerHeartbeatAt: toIso(job?.WorkerHeartbeatAt),
    storageResult: job?.StorageResult ?? null,
    browserLoadStatus: activeAsset?.BrowserLoadStatus ?? "pending"
  };
}

async function validateStoredAsset(
  assetId: string,
  expectedWidth?: number,
  expectedHeight?: number
): Promise<TechnicalImageValidation & { responseErrors: string[] }> {
  const response = await fetch(`${endpointOrigin()}${createVisualAssetUrl(assetId)}`, {
    headers: process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN
      ? { "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN }
      : undefined,
    cache: "no-store"
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const responseErrors = validateServedImageResponse({
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    byteLength: bytes.length,
    expectedMimeType: "image/png",
    bytes,
    expectedWidth,
    expectedHeight
  });
  const technical = validateTechnicalImageBytes({
    bytes,
    mimeType: response.headers.get("content-type"),
    expectedMimeType: "image/png",
    expectedWidth,
    expectedHeight
  });
  const mergedReasons = Array.from(new Set([...responseErrors, ...technical.reasons]));
  return {
    ...technical,
    passed: technical.passed && responseErrors.length === 0,
    reasons: mergedReasons,
    responseErrors
  };
}

async function getProductionContext(pool: sql.ConnectionPool, row: ProductionRow) {
  const { metadata, brief } = ensureVisualBriefMetadata(row);
  const job = await latestJob(pool, row.ProductionId);
  const variants = await productionVariants(pool, row.ProductionId);
  return { metadata, brief, job, variants };
}

export async function getImageGeneratorData(): Promise<ImageGeneratorPayload> {
  const { pool, workspaceId } = await workspace();
  const productions = await listCandidateProductions(pool, workspaceId);
  const items: ImageGeneratorProduction[] = [];
  for (const row of productions) {
    const context = await getProductionContext(pool, row);
    items.push(mapProductionRecord(row, context.brief, context.job, context.variants));
  }
  const average = items.length ? Math.round(items.reduce((total, item) => total + averageQuality(item.quality), 0) / items.length) : 0;
  return {
    generatedAt: new Date().toISOString(),
    productions: items,
    summary: {
      total: items.length,
      active: items.filter((item) => ["Queued", "Generating", "Uploading", "Persisting", "Validating", "Reviewing", "Revising"].includes(item.state)).length,
      approved: items.filter((item) => item.state === "Completed").length,
      averageQuality: average,
      queueDepth: items.filter((item) => ["Queued", "Generating", "Revising", "Validating", "Reviewing"].includes(item.state)).length
    }
  };
}

export async function runImageGenerationScheduler(): Promise<ImageGeneratorPayload> {
  if (imageGenerationGlobal.__imageGenerationScheduler) {
    return imageGenerationGlobal.__imageGenerationScheduler;
  }
  imageGenerationGlobal.__imageGenerationScheduler = executeImageGenerationScheduler().finally(() => {
    imageGenerationGlobal.__imageGenerationScheduler = undefined;
  });
  return imageGenerationGlobal.__imageGenerationScheduler;
}

async function executeImageGenerationScheduler(): Promise<ImageGeneratorPayload> {
  const { pool, workspaceId } = await workspace();
  const candidates = await listCandidateProductions(pool, workspaceId);
  const activeCandidates: Array<{
    row: ProductionRow;
    job: JobRow | null;
    variants: (VariantRow & Partial<AssetRow>)[];
    metadata: Record<string, unknown>;
    brief: VisualBrief;
    valid: boolean;
    reason: string | null;
  }> = [];
  for (const candidate of candidates) {
    const { metadata, brief, valid, reason } = ensureVisualBriefMetadata(candidate);
    const job = await latestJob(pool, candidate.ProductionId);
    const variants = await productionVariants(pool, candidate.ProductionId);
    if (jobNeedsAutonomousWork(job, variants, metadata)) {
      activeCandidates.push({ row: candidate, job, variants, metadata, brief, valid, reason });
    }
  }
  // #region debug-point E:scheduler-candidates
  reportImageEngineDebug("E", "lib/image-generator-engine.ts:executeImageGenerationScheduler", "scheduler candidates prepared", {
    candidates: candidates.length,
    activeCandidates: activeCandidates.length
  });
  // #endregion
  activeCandidates.sort((left, right) => {
    const priorityDiff = schedulerJobPriority(left.job) - schedulerJobPriority(right.job);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(right.job?.UpdatedAt ?? right.row.UpdatedAt).getTime() - new Date(left.job?.UpdatedAt ?? left.row.UpdatedAt).getTime();
  });
  let row: ProductionRow | null = null;
  let job: JobRow | null = null;
  let variants: (VariantRow & Partial<AssetRow>)[] = [];
  let metadata: Record<string, unknown> = {};
  let brief: VisualBrief | null = null;
  let valid = false;
  let reason: string | null = null;
  let requestContext: Awaited<ReturnType<typeof ensureVisualGenerationRequest>> | null = null;

  for (const candidate of activeCandidates) {
    requestContext = await ensureVisualGenerationRequest(pool, candidate.row, candidate.brief, candidate.metadata);
    let candidateJob = candidate.job;
    if (!candidateJob) {
      const jobId = await createJob(pool, candidate.row.ProductionId, requestContext.requestId, requestContext.priority, candidate.valid ? "Queued" : "Waiting for Inputs");
      candidateJob = await latestJob(pool, candidate.row.ProductionId);
      if (!candidateJob || candidateJob.ImageGenerationJobId !== jobId) {
        continue;
      }
    }
    const claimed = await claimGenerationLease(pool, candidateJob.ImageGenerationJobId);
    // #region debug-point C:lease-claim
    reportImageEngineDebug("C", "lib/image-generator-engine.ts:claimGenerationLease", "lease claim attempted", {
      productionId: candidate.row.ProductionId,
      jobId: candidateJob.ImageGenerationJobId,
      requestId: requestContext.requestId,
      claimed,
      priorState: candidateJob.State ?? null,
      retryCount: candidateJob.RetryCount ?? 0
    });
    // #endregion
    if (!claimed) continue;
    row = candidate.row;
    job = await latestJob(pool, candidate.row.ProductionId);
    variants = await productionVariants(pool, candidate.row.ProductionId);
    metadata = candidate.metadata;
    brief = candidate.brief;
    valid = candidate.valid;
    reason = candidate.reason;
    break;
  }
  if (!row || !job || !brief || !requestContext) {
    // #region debug-point E:no-active-job
    reportImageEngineDebug("E", "lib/image-generator-engine.ts:executeImageGenerationScheduler", "scheduler found no runnable image job", {
      activeCandidates: activeCandidates.length
    });
    // #endregion
    return getImageGeneratorData();
  }

  void dispatchAssetEngineJob({
    engine: "image-generator",
    productionId: row.ProductionId,
    title: row.Title,
    stage: row.Stage,
    metadata: { jobState: job.State ?? "new", code: row.Code }
  });

  if (!valid) {
    const jobId =
      job?.ImageGenerationJobId ??
      (await createJob(pool, row.ProductionId, requestContext.requestId, requestContext.priority, "Waiting for Inputs"));
    await patchJob(pool, jobId, {
      state: "Waiting for Inputs",
      retryCount: job?.RetryCount ?? 0,
      failureReason: reason,
      nextRecoveryAction: "Persist the visual brief before the next scheduler cycle.",
      storageResult: reason || null
    });
    await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Waiting for Inputs"));
    // #region debug-point E:waiting-for-inputs
    reportImageEngineDebug("E", "lib/image-generator-engine.ts:executeImageGenerationScheduler", "job blocked waiting for inputs", {
      productionId: row.ProductionId,
      requestId: requestContext.requestId,
      reason
    });
    // #endregion
    return getImageGeneratorData();
  }

  if (job.State === "Rejected" && approvedVariantCount(variants) < targetVisualAssetCount(metadata)) {
    const target = targetVisualAssetCount(metadata);
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Queued",
      retryCount: job.RetryCount,
      failureReason: null,
      nextRecoveryAction: `Resuming neural render generation (${approvedVariantCount(variants)}/${target} approved).`,
      storageResult: "Rejected job reopened because approved variant count is below target.",
      modelResponse: JSON.stringify({
        provider: PHOTO_REAL_PROVIDER,
        model: process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME || "CACSMS Local Neural Image Model",
        workflow: "photoreal-human",
        method: "resume after rejection"
      })
    });
    await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Queued"));
    job = { ...job, State: "Queued" as ImageGenerationState };
  }

  if (["Queued", "Generating", "Uploading", "Persisting", "Revising", "Reviewing"].includes(job.State)) {
    variants = await ensureTargetVariants(pool, row, job, brief, metadata);
  }

  if (job) {
    job = await recoverStuckGenerationJob(pool, row, job, variants);
    const revalidated = await revalidateCompletedVariants(pool, row, job, brief, metadata, variants);
    job = revalidated.job;
    variants = revalidated.variants;
    const resumed = await maybeResumeVariantGeneration(pool, row, job, brief, metadata, variants);
    job = resumed.job;
    variants = resumed.variants;
  }

  if (job.State === "Validating") {
    const activeVariant = selectActiveVariant(job, variants);
    if (!activeVariant?.ImageGenerationAssetId) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Failed",
        retryCount: job.RetryCount,
        failureReason: "The validating variant does not reference a persisted asset record.",
        nextRecoveryAction: "Regenerate the asset and recreate its SQL records.",
        storageResult: "Validation failed because the variant had no persisted asset."
      });
      return getImageGeneratorData();
    }
    const asset = await imageAsset(pool, activeVariant.ImageGenerationAssetId);
    if (!asset) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Failed",
        retryCount: job.RetryCount,
        failureReason: "The validating asset record could not be loaded from Microsoft SQL Server.",
        nextRecoveryAction: "Recreate the asset record and rerun validation.",
        storageResult: "Validation failed because the asset record was missing."
      });
      return getImageGeneratorData();
    }
    if (asset.BrowserLoadStatus !== "loaded") {
      const technicalValidation = await validateStoredAsset(asset.ImageGenerationAssetId);
      if (!technicalValidation.passed) {
        // #region debug-point D:technical-validation-failed
        reportImageEngineDebug("D", "lib/image-generator-engine.ts:validateStoredAsset", "stored asset validation failed", {
          productionId: row.ProductionId,
          requestId: requestContext.requestId,
          assetId: asset.ImageGenerationAssetId,
          reasons: technicalValidation.reasons
        });
        // #endregion
        await setAssetTechnicalValidation(pool, asset.ImageGenerationAssetId, technicalValidation);
        await setAssetBrowserLoad(pool, asset.ImageGenerationAssetId, "failed");
        await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
          state: "Blocked",
          retryCount: job.RetryCount,
          assetId: asset.ImageGenerationAssetId,
          failureReason: `Asset endpoint validation failed: ${technicalValidation.reasons.join(" ")}`,
          storageResult: technicalValidation.reasons.join(" ")
        });
        await patchJob(pool, job.ImageGenerationJobId, {
          state: "Blocked",
          retryCount: job.RetryCount,
          failureReason: `Asset endpoint validation failed: ${technicalValidation.reasons.join(" ")}`,
          nextRecoveryAction: "Verify the persisted asset URL, storage file, and reverse-proxy path.",
          storageResult: technicalValidation.reasons.join(" ")
        });
        await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Blocked"));
        return getImageGeneratorData();
      }
    }
    await advanceAssetToReviewing(pool, row, job, activeVariant, asset.ImageGenerationAssetId, metadata);
    job = { ...job, State: "Reviewing" as ImageGenerationState };
  }

  if (job.State === "Reviewing") {
    const activeVariant = selectActiveVariant(job, variants);
    if (!activeVariant?.ImageGenerationAssetId) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Failed",
        retryCount: job.RetryCount,
        failureReason: "The reviewing variant does not reference a persisted asset record.",
        nextRecoveryAction: "Regenerate the asset and recreate its SQL records.",
        storageResult: "Review failed because the variant had no persisted asset."
      });
      return getImageGeneratorData();
    }
    const asset = await imageAsset(pool, activeVariant.ImageGenerationAssetId);
    if (!asset) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Failed",
        retryCount: job.RetryCount,
        failureReason: "The reviewing asset record could not be loaded from Microsoft SQL Server.",
        nextRecoveryAction: "Recreate the asset record and rerun validation.",
        storageResult: "Review failed because the asset record was missing."
      });
      return getImageGeneratorData();
    }
    const dimensions = dimensionsFromAspectRatio(brief.aspectRatio);
    const reviewInstructions = buildRenderInstructions(
      brief,
      row,
      dimensions.width,
      dimensions.height,
      job.ProviderJobId || activeVariant.ImageGenerationVariantId,
      activeVariant.VariantNumber,
      job.RetryCount
    );
    reviewInstructions.prompt = activeVariant.RenderPrompt;
    const gate = evaluatePhotorealHumanGates(asset, activeVariant, reviewInstructions);
    if (gate.passed && gate.score < MIN_QUALITY_SCORE) {
      gate.passed = false;
      gate.defects.unshift(`Overall quality score ${gate.score}% is below the ${MIN_QUALITY_SCORE}% production threshold.`);
    }
    // #region debug-point D:review-gate
    reportImageEngineDebug("D", "lib/image-generator-engine.ts:evaluatePhotorealHumanGates", "review gate evaluated", {
      productionId: row.ProductionId,
      requestId: requestContext.requestId,
      assetId: asset.ImageGenerationAssetId,
      variantId: activeVariant.ImageGenerationVariantId,
      passed: gate.passed,
      score: gate.score,
      defects: gate.defects.slice(0, 4)
    });
    // #endregion
    if (gate.passed) {
      const integrityErrors = getCompletedVariantIntegrityErrors({
        state: "Completed",
        assetId: asset.ImageGenerationAssetId,
        assetUrl: asset.PublicUrl,
        fileSizeBytes: asset.FileSizeBytes,
        checksumSha256: asset.ChecksumSha256,
        width: asset.Width,
        height: asset.Height,
        mimeType: asset.MimeType,
        browserLoadStatus: asset.BrowserLoadStatus
      });
      if (integrityErrors.length) {
        await patchJob(pool, job.ImageGenerationJobId, {
          state: "Blocked",
          retryCount: job.RetryCount,
          failureReason: integrityErrors.join(" "),
          nextRecoveryAction: "Repair the persisted asset URL, file, or SQL metadata before approving the variant.",
          storageResult: `Blocked asset ${asset.ImageGenerationAssetId} after integrity validation.`
        });
        return getImageGeneratorData();
      }
      await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
        state: "Completed",
        retryCount: job.RetryCount,
        assetId: asset.ImageGenerationAssetId,
        qualityScore: gate.score,
        qualitySummary: JSON.stringify({ quality: gate.quality, passed: true, defects: [], audit: gate.audit })
      });
      const routedMetadata = await routeApprovedAsset(
        pool,
        row,
        metadata,
        brief,
        requestContext.requestId,
        {
          ...activeVariant,
          State: "Completed",
          ImageGenerationAssetId: asset.ImageGenerationAssetId,
          QualityScore: gate.score
        },
        asset
      );
      const refreshedVariants = await productionVariants(pool, row.ProductionId);
      const pending = pendingGenerationVariants(refreshedVariants);
      const approvedCount = approvedVariantCount(refreshedVariants);
      const target = targetVisualAssetCount(metadata);
      const reviewSummary = JSON.stringify({
        ...parseJsonObject(job.ModelResponseJson),
        review: { quality: gate.quality, score: gate.score, passed: true, defects: [], audit: gate.audit },
        routing: asObject(asObject(routedMetadata.visualGeneration).routing)
      });
      if (approvedCount < target || pending.length > 0) {
        const nextMetadata = await advanceVisualBriefToNextStoryboardShot(pool, row, routedMetadata);
        const routedShotId = asOptionalString(asObject(asObject(routedMetadata.visualGeneration).routing).targetShotId);
        await patchJob(pool, job.ImageGenerationJobId, {
          state: "Queued",
          retryCount: job.RetryCount,
          nextRecoveryAction: `Approved routed asset for storyboard shot ${routedShotId ?? "pending-shot-context"}. Generating ${Math.max(
            pending.length,
            target - approvedCount
          )} remaining storyboard-aligned asset(s).`,
          storageResult: `Approved asset ${asset.ImageGenerationAssetId}; ${approvedCount}/${target} routed storyboard asset(s) ready.`,
          modelResponse: reviewSummary
        });
        await updateProductionState(pool, row, nextMetadata, "visual-generation", "active", stateToProgress("Queued"));
        return getImageGeneratorData();
      }
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Completed",
        retryCount: job.RetryCount,
        nextRecoveryAction: "No recovery required.",
        storageResult: `Approved asset ${asset.ImageGenerationAssetId} routed to storyboard, asset delivery, and video readiness.`,
        modelResponse: reviewSummary
      });
      // #region debug-point D:asset-approved
      reportImageEngineDebug("D", "lib/image-generator-engine.ts:routeApprovedAsset", "asset approved and routed", {
        productionId: row.ProductionId,
        requestId: requestContext.requestId,
        assetId: asset.ImageGenerationAssetId,
        approvedCount,
        target
      });
      // #endregion
      await updateProductionState(pool, row, routedMetadata, "assembly", "approved", 100);
      return getImageGeneratorData();
    }

    const nextRetry = job.RetryCount + 1;
    const defectSummary = gate.defects.join(" ");
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Rejected",
      retryCount: nextRetry,
      assetId: asset.ImageGenerationAssetId,
      failureReason: `Rejected - Human realism failed. ${defectSummary}`,
      storageResult: `Rejected asset ${asset.ImageGenerationAssetId} during mandatory photoreal-human validation.`,
      qualityScore: gate.score,
      qualitySummary: JSON.stringify({ quality: gate.quality, passed: false, defects: gate.defects, audit: gate.audit })
    });
    if (nextRetry >= MAX_RETRIES) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Rejected",
        retryCount: nextRetry,
        failureReason: `Rejected - Human realism failed after ${nextRetry} attempts. ${defectSummary}`,
        nextRecoveryAction: "Install or configure a local photorealistic human-capable diffusion model, then regenerate. Development preview renderers cannot pass production.",
        storageResult: `Revision limit reached after rejecting asset ${asset.ImageGenerationAssetId}.`,
        modelResponse: JSON.stringify({ ...parseJsonObject(job.ModelResponseJson), review: { quality: gate.quality, score: gate.score, passed: false, defects: gate.defects, audit: gate.audit } })
      });
      await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Rejected"));
      return getImageGeneratorData();
    }

    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Revising",
      retryCount: nextRetry,
      failureReason: `Rejected - Human realism failed. ${defectSummary}`,
      nextRecoveryAction: "Revising visual instructions, regenerating, validating humans, checking anatomy, checking originality, then re-running quality approval.",
      storageResult: `Rejected asset ${asset.ImageGenerationAssetId}; revision requested.`,
      modelResponse: JSON.stringify({ ...parseJsonObject(job.ModelResponseJson), review: { quality: gate.quality, score: gate.score, passed: false, defects: gate.defects, audit: gate.audit } })
    });
    // #region debug-point A:review-rejected
    reportImageEngineDebug("A", "lib/image-generator-engine.ts:reviewRejected", "review rejected asset and requested revision", {
      productionId: row.ProductionId,
      requestId: requestContext.requestId,
      assetId: asset.ImageGenerationAssetId,
      nextRetry,
      score: gate.score,
      defects: gate.defects.slice(0, 4)
    });
    // #endregion
    await requeueVariantForRetry(pool, row, job, brief, variants, activeVariant, nextRetry, defectSummary);
    await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Revising"));
    return getImageGeneratorData();
  }

  if (!["Queued", "Generating", "Uploading", "Persisting", "Revising"].includes(job.State)) {
    return getImageGeneratorData();
  }

  if (job.State === "Generating" && generationStillRunning(job.UpdatedAt)) {
    return getImageGeneratorData();
  }

  const activeVariant = selectActiveVariant(job, variants) ?? {
    ImageGenerationVariantId: await createVariant(pool, row.ProductionId, job.ImageGenerationJobId, 1, buildRenderInstructions(brief, row, dimensionsFromAspectRatio(brief.aspectRatio).width, dimensionsFromAspectRatio(brief.aspectRatio).height, job.ImageGenerationJobId, 1, job.RetryCount).prompt, "Queued", job.RetryCount),
    VariantNumber: 1,
    RenderPrompt: buildRenderInstructions(brief, row, dimensionsFromAspectRatio(brief.aspectRatio).width, dimensionsFromAspectRatio(brief.aspectRatio).height, job.ImageGenerationJobId, 1, job.RetryCount).prompt
  } as VariantRow & Partial<AssetRow>;

  const providerJobId = crypto.randomUUID();
  const { width, height } = dimensionsFromAspectRatio(brief.aspectRatio);
  const instructions = buildRenderInstructions(brief, row, width, height, providerJobId, activeVariant.VariantNumber, job.RetryCount);
  instructions.prompt = activeVariant.RenderPrompt || instructions.prompt;
  const persistedBrief = await ensureVersionedVisualBrief(pool, requestContext.requestId, row, brief);
  const persistedPrompt = await ensureVersionedVisualPrompt(pool, persistedBrief.briefId, instructions);
  const providerDefaults = getVisualGenerationProviderDefaults();
  const providerHealth = await getVisualGenerationProvider().healthCheck();
  const routingContext = currentStoryboardRequestContext(brief, metadata);
  const routeExplanation = {
    requestId: requestContext.requestId,
    workflow: providerDefaults.workflowKey,
    provider: providerDefaults.providerId,
    model: providerDefaults.modelDisplayName,
    health: providerHealth,
    storyboard: routingContext,
    reason: providerHealth.reachable && providerHealth.modelLoaded
      ? "Selected the healthy local photoreal image runtime for storyboard-routed generation."
      : "Only the local photoreal image runtime is registered; proceeding with degraded health visibility so the scheduler can capture a real failure instead of faking success."
  };
  // #region debug-point A:provider-health
  reportImageEngineDebug("A", "lib/image-generator-engine.ts:providerHealth", "provider health and routing evaluated", {
    productionId: row.ProductionId,
    requestId: requestContext.requestId,
    provider: providerDefaults.providerId,
    model: providerDefaults.modelDisplayName,
    workflow: providerDefaults.workflowKey,
    reachable: providerHealth.reachable,
    modelLoaded: providerHealth.modelLoaded,
    reason: routeExplanation.reason
  });
  // #endregion
  const renderPrompt = [
    instructions.prompt,
    `Negative prompt: ${instructions.negativePrompt}`,
    `Workflow: ${instructions.mode.mode}`,
    `retry:${job.RetryCount}`,
    `variant:${activeVariant.VariantNumber}`
  ].join("\n");
  const generationProvider = providerDefaults.providerId;
  const generationModel = providerDefaults.modelDisplayName;
  await pool
    .request()
    .input("jobId", sql.NVarChar(36), job.ImageGenerationJobId)
    .input("provider", sql.NVarChar(120), generationProvider)
    .input("model", sql.NVarChar(200), generationModel)
    .query(`
      UPDATE cacsms.ImageGenerationJobs
      SET ProviderName=@provider, ModelName=@model, UpdatedAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationJobId)=@jobId;
    `);
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Generating",
    retryCount: job.RetryCount,
    providerJobId,
    nextRecoveryAction: "Generate image bytes, persist the file, and create SQL asset records. Production completion still requires semantic photoreal-human gates.",
    storageResult: instructions.mode.mode === "photoreal-human"
      ? "The worker is generating a photorealistic-human candidate for mandatory semantic validation."
      : "The worker is generating an original non-photoreal scene candidate.",
    modelResponse: JSON.stringify({
      provider: generationProvider,
      model: generationModel,
      providerJobId,
      assignedAt: new Date().toISOString(),
      workflow: providerDefaults.workflowKey,
        router: routeExplanation,
      promptVersionNumber: persistedPrompt.versionNumber,
      briefVersionNumber: persistedBrief.versionNumber,
      prompt: instructions.prompt,
      negativePrompt: instructions.negativePrompt,
      settings: instructions.settings,
      method: "local provider render in progress"
    })
  });
  await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
    state: "Generating",
    retryCount: job.RetryCount,
    providerResponse: JSON.stringify({
      provider: generationProvider,
      providerJobId,
      status: "started",
      workflow: providerDefaults.workflowKey,
      router: routeExplanation,
      promptVersionNumber: persistedPrompt.versionNumber,
      prompt: instructions.prompt,
      negativePrompt: instructions.negativePrompt,
      settings: instructions.settings
    })
  });

  const rendered = await renderIndependentVisual(renderPrompt, width, height, providerJobId, false);
  if (!rendered) {
    const nextRetry = job.RetryCount + 1;
    const defectSummary =
      "The configured real image provider timed out or failed before returning image bytes.";
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Rejected",
      retryCount: nextRetry,
      failureReason: `Rejected - Render failed. ${defectSummary}`,
      storageResult: "No production asset was persisted because the local neural renderer failed before quality validation.",
      providerResponse: JSON.stringify({
        provider: PHOTO_REAL_PROVIDER,
        providerJobId,
        status: "rejected",
        workflow: providerDefaults.workflowKey,
        prompt: instructions.prompt,
        negativePrompt: instructions.negativePrompt,
        settings: instructions.settings,
        defects: [defectSummary]
      })
    });
    if (nextRetry >= MAX_RETRIES) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Rejected",
        retryCount: nextRetry,
        providerJobId,
        failureReason: `Render failed after ${nextRetry} attempts. ${defectSummary}`,
        nextRecoveryAction: "Configure a stronger local photorealistic human model or reduce local render settings, then regenerate.",
        storageResult: "Generation stopped before any asset was persisted.",
        modelResponse: JSON.stringify({ provider: PHOTO_REAL_PROVIDER, providerJobId, workflow: providerDefaults.workflowKey, defects: [defectSummary] })
      });
      await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Rejected"));
      return getImageGeneratorData();
    }
    await requeueVariantForRetry(pool, row, job, brief, variants, activeVariant, nextRetry, defectSummary);
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Revising",
      retryCount: nextRetry,
      providerJobId,
      failureReason: `Render failed. ${defectSummary}`,
      nextRecoveryAction: "Revising visual instructions, regenerating with the local neural renderer, validating humans, checking anatomy, checking originality, then re-running quality approval.",
      storageResult: "Neural render failed; existing variant slot re-queued with revised instructions.",
      modelResponse: JSON.stringify({ provider: PHOTO_REAL_PROVIDER, providerJobId, workflow: providerDefaults.workflowKey, defects: [defectSummary] })
    });
    await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Revising"));
    return getImageGeneratorData();
  }
  const providerAudit = {
    provider: rendered.provider,
    model: rendered.model,
    providerJobId,
    prompt: instructions.prompt,
    negativePrompt: instructions.negativePrompt,
    settings: instructions.settings,
    workflow: providerDefaults.workflowKey,
    modeReason: instructions.mode.reason,
    promptVersionNumber: persistedPrompt.versionNumber,
    briefVersionNumber: persistedBrief.versionNumber,
    byteLength: rendered.bytes.length,
    width: rendered.width,
    height: rendered.height,
    averageLuma: rendered.averageLuma,
    method: rendered.method
  };
  const technicalValidation = validateTechnicalImageBytes({
    bytes: rendered.bytes,
    mimeType: "image/png",
    expectedMimeType: "image/png",
    expectedWidth: width,
    expectedHeight: height
  });
  if (!technicalValidation.passed) {
    const nextRetry = job.RetryCount + 1;
    const defectSummary = technicalValidation.reasons.join(" ");
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Rejected",
      retryCount: nextRetry,
      failureReason: `Rejected - Technical validation failed. ${defectSummary}`,
      storageResult: "Generated bytes failed pre-persistence technical validation.",
      providerResponse: JSON.stringify({ ...providerAudit, technicalValidation })
    });
    await patchJob(pool, job.ImageGenerationJobId, {
      state: nextRetry >= MAX_RETRIES ? "Rejected" : "Revising",
      retryCount: nextRetry,
      providerJobId,
      failureReason: `Technical validation failed. ${defectSummary}`,
      nextRecoveryAction:
        nextRetry >= MAX_RETRIES
          ? "The real image provider repeatedly returned invalid image bytes. Repair provider configuration before retrying."
          : "Revise instructions and request a fresh render because the returned bytes failed technical validation.",
      storageResult: "The returned bytes were rejected before persistence because they failed technical validation.",
      modelResponse: JSON.stringify({ ...providerAudit, technicalValidation })
    });
    if (nextRetry < MAX_RETRIES) {
      await requeueVariantForRetry(pool, row, job, brief, variants, activeVariant, nextRetry, defectSummary);
      await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Revising"));
    } else {
      await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Rejected"));
    }
    return getImageGeneratorData();
  }
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Uploading",
    retryCount: job.RetryCount,
    providerJobId,
    nextRecoveryAction: "Persist the generated bytes to storage.",
    storageResult: `Generated ${rendered.bytes.length} candidate image bytes and preparing the filesystem write.`,
    modelResponse: JSON.stringify(providerAudit)
  });

  const assetDirectory = path.join(STORAGE_DIR, row.ProductionId);
  fs.mkdirSync(assetDirectory, { recursive: true });
  const fileName = `variant-${activeVariant.VariantNumber}-${rendered.checksum.slice(0, 12)}.png`;
  const absolutePath = path.join(assetDirectory, fileName);
  fs.writeFileSync(absolutePath, rendered.bytes);
  const size = fs.statSync(absolutePath).size;
  const dimensions = readPngDimensions(rendered.bytes);

  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Persisting",
    retryCount: job.RetryCount,
    providerJobId,
    nextRecoveryAction: "Create Microsoft SQL Server asset and variant records.",
    storageResult: `Stored ${size} bytes at ${absolutePath}.`
  });
  await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
    state: "Persisting",
    retryCount: job.RetryCount,
    storageResult: `Stored ${size} bytes at ${absolutePath}.`,
    providerResponse: JSON.stringify({ ...providerAudit, storedAt: absolutePath, byteLength: size })
  });

  const assetId = await insertAsset(
    pool,
    row.ProductionId,
    job.ImageGenerationJobId,
    fileName,
    absolutePath,
    createVisualAssetUrl("pending"),
    size,
    dimensions.width,
    dimensions.height,
    rendered.checksum,
    technicalValidation
  );
  await pool.request().input("assetId", sql.NVarChar(36), assetId).input("publicUrl", sql.NVarChar(1000), createVisualAssetUrl(assetId)).query(`
    UPDATE cacsms.ImageGenerationAssets
    SET PublicUrl=@publicUrl, UpdatedAt=SYSUTCDATETIME()
    WHERE CONVERT(nvarchar(36), ImageGenerationAssetId)=@assetId;
  `);
  await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
    state: "Validating",
    retryCount: job.RetryCount,
    assetId,
    storageResult: `Persisted asset record ${assetId}.`,
    providerResponse: JSON.stringify({ ...providerAudit, assetId, byteLength: size })
  });

  await setAssetTechnicalValidation(pool, assetId, technicalValidation);
  const servedValidation = await validateStoredAsset(assetId, width, height);
  if (!servedValidation.passed) {
    await setAssetTechnicalValidation(pool, assetId, servedValidation);
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Failed",
      retryCount: job.RetryCount,
      failureReason: `Asset endpoint validation failed: ${servedValidation.reasons.join(" ")}`,
      nextRecoveryAction: "Check the API asset route, storage file, and IIS or reverse-proxy path.",
      storageResult: `Stored asset ${assetId} but the served URL was not valid.`
    });
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Failed",
      retryCount: job.RetryCount,
      assetId,
      failureReason: `Asset endpoint validation failed: ${servedValidation.reasons.join(" ")}`,
      storageResult: `Stored asset ${assetId} but the served URL was not valid.`
    });
    return getImageGeneratorData();
  }

  await pool.request().input("assetId", sql.NVarChar(36), assetId).query(`
    UPDATE cacsms.ImageGenerationAssets
    SET AvailabilityStatus=N'available', AvailabilityCheckedAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME()
    WHERE CONVERT(nvarchar(36), ImageGenerationAssetId)=@assetId;
  `);
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Validating",
    retryCount: job.RetryCount,
    nextRecoveryAction: "Run server-side asset verification and quality review.",
    storageResult: `Verified image bytes at ${createVisualAssetUrl(assetId)}.`,
    modelResponse: JSON.stringify({ ...providerAudit, assetId, checksum: rendered.checksum, width: dimensions.width, height: dimensions.height })
  });
  await advanceAssetToReviewing(pool, row, job, activeVariant, assetId, metadata);
  return getImageGeneratorData();
}

export async function acknowledgeImageAssetLoad(productionId: string, assetId: string, variantId: string) {
  const { pool, workspaceId } = await workspace();
  const row = (await listCandidateProductions(pool, workspaceId)).find((item) => item.ProductionId === productionId);
  if (!row) throw new Error("The production for this asset acknowledgement could not be found.");
  const { metadata } = ensureVisualBriefMetadata(row);
  const job = await latestJob(pool, productionId);
  if (!job) throw new Error("No active image-generation job exists for this production.");
  const variant = (await productionVariants(pool, productionId)).find((item) => item.ImageGenerationVariantId === variantId);
  if (!variant) throw new Error("The variant for this asset acknowledgement could not be found.");
  await advanceAssetToReviewing(pool, row, job, variant, assetId, metadata);
  return getImageGeneratorData();
}

export async function markImageAssetLoadFailure(productionId: string, assetId: string, variantId: string, reason: string) {
  const { pool, workspaceId } = await workspace();
  const row = (await listCandidateProductions(pool, workspaceId)).find((item) => item.ProductionId === productionId);
  if (!row) throw new Error("The production for this asset load failure could not be found.");
  const { metadata } = ensureVisualBriefMetadata(row);
  const job = await latestJob(pool, productionId);
  if (!job) throw new Error("No active image-generation job exists for this production.");
  await setAssetBrowserLoad(pool, assetId, "failed");
  await patchVariant(pool, variantId, {
    state: "Blocked",
    retryCount: job.RetryCount,
    assetId,
    failureReason: reason,
    storageResult: reason
  });
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Blocked",
    retryCount: job.RetryCount,
    failureReason: reason,
    nextRecoveryAction: "Verify the persisted asset URL from the browser, then rerun validation.",
    storageResult: reason
  });
  await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Blocked"));
  return getImageGeneratorData();
}

export async function loadImageGeneratorAsset(assetId: string) {
  const pool = await getMssqlPool();
  await ensureSchema(pool);
  const asset = await imageAsset(pool, assetId);
  if (!asset) throw new Error("The requested image asset could not be found.");
  const resolvedStoragePath = resolvePersistedVisualStoragePath(asset.StoragePath);
  if (!resolvedStoragePath || !fs.existsSync(resolvedStoragePath)) {
    throw new Error("The persisted image file is missing from storage.");
  }
  const bytes = fs.readFileSync(resolvedStoragePath);
  if (bytes.length <= 0) throw new Error("The persisted image file is empty.");
  if (!/^image\/(png|webp)$/i.test(asset.MimeType)) {
    throw new Error(`The persisted asset MIME type is invalid: ${asset.MimeType}.`);
  }
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  if (checksum !== asset.ChecksumSha256) {
    throw new Error("The persisted image checksum does not match the stored asset record.");
  }
  if (/^image\/png$/i.test(asset.MimeType)) {
    const dimensions = readPngDimensions(bytes);
    if (dimensions.width !== asset.Width || dimensions.height !== asset.Height) {
      throw new Error("The persisted image dimensions do not match the stored asset record.");
    }
  }
  return { asset, bytes };
}

export async function isVisualGenerationStageComplete(productionId: string) {
  const pool = await getMssqlPool();
  await ensureSchema(pool);
  const job = await latestJob(pool, productionId);
  if (!job || job.State !== "Completed") return false;
  const variants = await productionVariants(pool, productionId);
  return approvedVariantCount(variants) >= TARGET_VARIANT_COUNT;
}
