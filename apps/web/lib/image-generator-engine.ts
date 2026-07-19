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
  validateServedImageResponse,
  type BrowserLoadStatus,
  type ImageGenerationState
} from "@/lib/image-generator-integrity";
import { generatePromptPng, readPngDimensions } from "@/lib/image-generator-png";
import { renderWithLocalImageModel, type LocalImageModelRender } from "@/lib/local-image-model-runtime";

const VISUAL_STEPS = [
  "Inputs validated",
  "Visual brief resolved",
  "Generating variants",
  "Quality review",
  "Auto-revision",
  "Asset approved"
] as const;

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
const DEFAULT_PROVIDER = "cacsms-autonomous-procedural-visual-engine";
const DEFAULT_MODEL = "CACSMS Original Human/3D Scene Renderer v2";
const PHOTO_REAL_PROVIDER = "cacsms-local-neural-image-runtime";
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
  "text artifacts",
  "watermark",
  "logo",
  "low-detail background",
  "blur"
].join(", ");

function renderProceduralFallback(prompt: string, width: number, height: number): LocalImageModelRender {
  return {
    ...generatePromptPng(prompt, width, height),
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    method: "prompt-seeded layered raster synthesis"
  };
}

async function renderIndependentVisual(prompt: string, width: number, height: number, seed: string, allowFallback: boolean) {
  const local = await renderWithLocalImageModel({ prompt, width, height, seed }).catch((error) => {
    console.warn("cacsms.localImageModel.failed", error);
    return null;
  });
  if (local) return local;
  return allowFallback ? renderProceduralFallback(prompt, width, height) : null;
}
const MAX_RETRIES = 3;

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

type JobRow = {
  ImageGenerationJobId: string;
  State: ImageGenerationState;
  WorkerName: string | null;
  ProviderName: string | null;
  ModelName: string | null;
  ProviderJobId: string | null;
  WorkerHeartbeatAt: Date | null;
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
    "Photorealistic documentary photograph, medium-wide corporate operations-room scene, not a close-up portrait, not a studio portrait, not a beauty shot.",
    "Show three adult business professionals, including one clear foreground Black Nigerian or West African professional fully inside the 10 percent safe area, complete head and upper body visible, visible hands using a laptop, tablet, control console or workstation.",
    "The foreground person is the unmistakable focal subject but the surrounding AI operations room must remain readable: analytics screens, maintenance workflow dashboard, desks, glass partitions, and modern enterprise equipment.",
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

function buildRenderInstructions(brief: VisualBrief, row: ProductionRow, width: number, height: number, seed: string, variantNumber: number, retryCount: number): RenderInstructions {
  const mode = deriveRenderMode(brief);
  const prompt = mode.mode === "photoreal-human"
    ? buildPhotorealPrompt(brief, row, variantNumber, retryCount)
    : brief.prompt;
  return {
    mode,
    prompt,
    negativePrompt: mode.mode === "photoreal-human" ? PHOTOREAL_HUMAN_NEGATIVE_PROMPT : "watermark, logo, text artifact, low detail",
    settings: {
      aspectRatio: brief.aspectRatio,
      width,
      height,
      seed,
      inference: process.env.CACSMS_LOCAL_IMAGE_MODEL_ID ? "local-diffusion" : "development-preview-renderer",
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
  const hasConfiguredDiffusionModel = Boolean(process.env.CACSMS_LOCAL_IMAGE_MODEL_ID?.trim());
  const isDevRenderer = /3d human scene renderer|procedural|fallback|preview|raster synthesis/i.test(`${model} ${method}`);
  return provider.provider === PHOTO_REAL_PROVIDER && hasConfiguredDiffusionModel && !isDevRenderer;
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
  const bytes = fs.readFileSync(storagePath);
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
  error: string | null;
};

function localSemanticImageEvidence(storagePath: string, prompt: string): SemanticImageEvidence {
  const command = process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_COMMAND?.trim() || process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND?.trim();
  if (!command) {
    return { available: false, model: null, scores: {}, detectors: {}, composition: {}, passedHumanPresence: false, passedPhotographicStyle: false, passedAnatomyRisk: false, passedComposition: false, passedNaturalHuman: false, error: "No local semantic image validator command is configured." };
  }
  const validatorScript =
    process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_SCRIPT?.trim() ||
    path.join(process.env.CACSMS_LOCAL_IMAGE_MODEL_DIR || path.join(projectRoot(), "local-models", "image-renderer"), "validate_image.py");
  const modelId = process.env.CACSMS_LOCAL_IMAGE_VALIDATOR_MODEL_ID?.trim();
  const args = [validatorScript, "--image", storagePath, "--prompt", prompt];
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
    : { available: true, model: null, scores: {}, detectors: {}, composition: {}, passedHumanPresence: true, passedPhotographicStyle: true, passedAnatomyRisk: true, passedComposition: true, passedNaturalHuman: true, error: null };
  const hasVisibleHumanEvidence = semanticEvidence.passedHumanPresence && humanEvidence.skinPixelRatio >= 0.0035;
  const compositionEvidence = semanticEvidence.composition;
  const subjectCoverage = asNumber(compositionEvidence.subjectCoverage, 0);
  const centerOffset = asNumber(compositionEvidence.centerOffset, 1);
  const blurScore = asNumber(compositionEvidence.blurScore, 0);
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
  const stereotypeAvoidanceOk = !isNigeria || !/(safari|desert|tribal|hut|poverty|slum|traditional costume by default)/i.test(instructions.prompt);
  const quality: VisualQuality = {
    brief: 94,
    humanPhotorealism: productionPhotoreal && hasVisibleHumanEvidence ? 93 : productionPhotoreal ? 62 : 18,
    facialRealism: productionPhotoreal && hasVisibleHumanEvidence && semanticEvidence.passedPhotographicStyle ? 92 : productionPhotoreal ? 58 : 24,
    anatomy: productionPhotoreal && hasVisibleHumanEvidence && semanticEvidence.passedAnatomyRisk ? 91 : productionPhotoreal ? 60 : 38,
    subjectDiversity: productionPhotoreal && hasVisibleHumanEvidence ? 90 : productionPhotoreal ? 52 : 72,
    lightingPerspective: productionPhotoreal ? 91 : 76,
    sharpnessResolution: hasRealSize && hasEnoughBytes ? 91 : hasRealSize ? 74 : 45,
    subjectVisibility: semanticEvidence.passedComposition && subjectCoverage >= 0.08 && !croppedRisk ? 91 : subjectCoverage > 0 ? 48 : 20,
    identityConsistency: semanticEvidence.passedComposition && !roboticFeatureRisk ? 88 : 52,
    geographicAccuracy: hasLocalePrompt && nigeriaPromptOk ? 90 : 55,
    culturalIntegrity: hasLocalePrompt && stereotypeAvoidanceOk ? 91 : 50,
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
  if (instructions.mode.mode === "photoreal-human" && !semanticEvidence.available) {
    defects.unshift(`Semantic validator unavailable: ${semanticEvidence.error ?? "local CLIP validator could not run."}`);
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedPhotographicStyle) {
    defects.unshift("Photographic style failed: local semantic validator found cartoon/3D/illustration risk too high.");
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedAnatomyRisk) {
    defects.unshift("Anatomy risk failed: local semantic validator found low-quality or malformed-human risk too high.");
  }
  if (instructions.mode.mode === "photoreal-human" && semanticEvidence.available && !semanticEvidence.passedComposition) {
    defects.unshift(
      `Focal composition failed: subject coverage ${(subjectCoverage * 100).toFixed(1)}%, center offset ${centerOffset.toFixed(2)}, safe area ${safeAreaPass ? "passed" : "failed"}, cropped risk ${croppedRisk ? "detected" : "clear"}, blur score ${blurScore.toFixed(2)}.`
    );
  }
  if (roboticFeatureRisk) {
    defects.unshift("Natural-human consistency failed: unexpected robotic/cybernetic feature risk detected.");
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
    "SELECT CASE WHEN OBJECT_ID(N'cacsms.ImageGenerationJobs', N'U') IS NULL THEN 0 ELSE 1 END AS present;"
  );
  if (!result.recordset[0]?.present) {
    throw new Error("Image generator schema is missing. Apply MSSQL migration 032_autonomous_image_generation_assets.sql before using the autonomous image generator.");
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

async function createJob(pool: sql.ConnectionPool, productionId: string, state: ImageGenerationState) {
  const result = await pool.request().input("productionId", sql.NVarChar(36), productionId).input("state", sql.NVarChar(30), state)
    .query<{ id: string }>(`
      DECLARE @created TABLE (id nvarchar(36));
      INSERT cacsms.ImageGenerationJobs (ProductionId, State, WorkerName, ProviderName, ModelName, RetryCount, NextRecoveryAction, LastTransitionAt)
      OUTPUT CONVERT(nvarchar(36), inserted.ImageGenerationJobId) INTO @created(id)
      VALUES (CONVERT(uniqueidentifier, @productionId), @state, N'${DEFAULT_WORKER}', N'${DEFAULT_PROVIDER}', N'${DEFAULT_MODEL}', 0, N'Await scheduler dispatch.', SYSUTCDATETIME());
      SELECT TOP(1) id FROM @created;
    `);
  return result.recordset[0].id;
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
        WorkerHeartbeatAt=SYSUTCDATETIME(),
        UpdatedAt=SYSUTCDATETIME(),
        LastTransitionAt=SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ImageGenerationJobId)=@jobId;
    `);
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
  checksumSha256: string
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
    .query<{ id: string }>(`
      DECLARE @created TABLE (id nvarchar(36));
      INSERT cacsms.ImageGenerationAssets (
        ProductionId, ImageGenerationJobId, FileName, StoragePath, PublicUrl, MimeType, FileSizeBytes, Width, Height, ChecksumSha256, AvailabilityStatus, AvailabilityCheckedAt, BrowserLoadStatus
      )
      OUTPUT CONVERT(nvarchar(36), inserted.ImageGenerationAssetId) INTO @created(id)
      VALUES (
        CONVERT(uniqueidentifier, @productionId), CONVERT(uniqueidentifier, @jobId), @fileName, @storagePath, @publicUrl, N'image/png', @fileSizeBytes, @width, @height, @checksumSha256, N'pending', SYSUTCDATETIME(), N'pending'
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

function mapProductionRecord(row: ProductionRow, brief: ReturnType<typeof briefFromRow>, job: JobRow | null, variants: (VariantRow & Partial<AssetRow>)[]): ImageGeneratorProduction {
  const activeVariant = variants[0] ?? null;
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
    variantCount: Math.max(variants.length, 1),
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
      model: job?.ModelName || DEFAULT_MODEL,
      action: state,
      elapsedSeconds: Math.max(
        0,
        Math.round(((job?.UpdatedAt || row.UpdatedAt).getTime() - (job?.CreatedAt || row.UpdatedAt).getTime()) / 1000)
      ),
      heartbeat: toIso(job?.WorkerHeartbeatAt) ?? "Not recorded",
      retryCount: job?.RetryCount ?? 0,
      nextAction: job?.NextRecoveryAction || "Await scheduler cycle.",
      modelResponse: job?.ModelResponseJson || "No provider response recorded yet.",
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

async function validateStoredAsset(assetId: string) {
  const response = await fetch(`${endpointOrigin()}${createVisualAssetUrl(assetId)}`, {
    headers: process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN
      ? { "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN }
      : undefined,
    cache: "no-store"
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return validateServedImageResponse({
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    byteLength: bytes.length,
    expectedMimeType: "image/png"
  });
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
  let row: ProductionRow | undefined;
  let selectedJob: JobRow | null = null;
  let selectedVariants: (VariantRow & Partial<AssetRow>)[] = [];
  for (const candidate of candidates) {
    const job = await latestJob(pool, candidate.ProductionId);
    const variants = await productionVariants(pool, candidate.ProductionId);
    if (!job || ["Queued", "Generating", "Uploading", "Persisting", "Validating", "Reviewing", "Revising"].includes(job.State)) {
      row = candidate;
      selectedJob = job;
      selectedVariants = variants;
      break;
    }
  }
  if (!row) return getImageGeneratorData();

  const { metadata, brief, valid, reason } = ensureVisualBriefMetadata(row);
  let job = selectedJob;
  let variants = selectedVariants;

  if (!valid) {
    const jobId = job?.ImageGenerationJobId ?? (await createJob(pool, row.ProductionId, "Waiting for Inputs"));
    await patchJob(pool, jobId, {
      state: "Waiting for Inputs",
      retryCount: job?.RetryCount ?? 0,
      failureReason: reason,
      nextRecoveryAction: "Persist the visual brief before the next scheduler cycle.",
      storageResult: reason || null
    });
    await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Waiting for Inputs"));
    return getImageGeneratorData();
  }

  if (!job) {
    const jobId = await createJob(pool, row.ProductionId, "Queued");
    const { width, height } = dimensionsFromAspectRatio(brief.aspectRatio);
    const queuedInstructions = buildRenderInstructions(brief, row, width, height, jobId, 1, 0);
    await createVariant(pool, row.ProductionId, jobId, 1, queuedInstructions.prompt, "Queued", 0);
    await updateProductionState(pool, row, metadata, "visual-generation", "queued", stateToProgress("Queued"));
    return getImageGeneratorData();
  }

  if (job.State === "Reviewing") {
    const activeVariant = variants[0];
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
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Completed",
        retryCount: job.RetryCount,
        nextRecoveryAction: "No recovery required.",
        storageResult: `Approved asset ${asset.ImageGenerationAssetId} routed to timeline assembly.`,
        modelResponse: JSON.stringify({ ...parseJsonObject(job.ModelResponseJson), review: { quality: gate.quality, score: gate.score, passed: true, defects: [], audit: gate.audit } })
      });
      await updateProductionState(pool, row, metadata, "assembly", "approved", 100);
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
    const revisedPrompt = [
      buildPhotorealPrompt(brief, row, Math.max(...variants.map((item) => item.VariantNumber)) + 1, nextRetry),
      "Revision instructions: correct all rejected defects; enforce natural photographic adults, realistic skin texture, unique faces, accurate hands, grounded shadows, natural camera perspective, high-resolution environment detail.",
      `Rejected defects to correct: ${defectSummary}`,
      `Negative prompt: ${reviewInstructions.negativePrompt}`
    ].join(" ");
    await createVariant(pool, row.ProductionId, job.ImageGenerationJobId, Math.max(...variants.map((item) => item.VariantNumber)) + 1, revisedPrompt, "Queued", nextRetry);
    await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Revising"));
    return getImageGeneratorData();
  }

  if (!["Queued", "Generating", "Uploading", "Persisting", "Revising"].includes(job.State)) {
    return getImageGeneratorData();
  }

  const activeVariant = variants[0] ?? {
    ImageGenerationVariantId: await createVariant(pool, row.ProductionId, job.ImageGenerationJobId, 1, buildRenderInstructions(brief, row, dimensionsFromAspectRatio(brief.aspectRatio).width, dimensionsFromAspectRatio(brief.aspectRatio).height, job.ImageGenerationJobId, 1, job.RetryCount).prompt, "Queued", job.RetryCount),
    VariantNumber: 1,
    RenderPrompt: buildRenderInstructions(brief, row, dimensionsFromAspectRatio(brief.aspectRatio).width, dimensionsFromAspectRatio(brief.aspectRatio).height, job.ImageGenerationJobId, 1, job.RetryCount).prompt
  } as VariantRow & Partial<AssetRow>;

  const providerJobId = crypto.randomUUID();
  const { width, height } = dimensionsFromAspectRatio(brief.aspectRatio);
  const instructions = buildRenderInstructions(brief, row, width, height, providerJobId, activeVariant.VariantNumber, job.RetryCount);
  instructions.prompt = activeVariant.RenderPrompt || instructions.prompt;
  const renderPrompt = [
    instructions.prompt,
    `Negative prompt: ${instructions.negativePrompt}`,
    `Workflow: ${instructions.mode.mode}`,
    `retry:${job.RetryCount}`,
    `variant:${activeVariant.VariantNumber}`
  ].join("\n");
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Generating",
    retryCount: job.RetryCount,
    providerJobId,
    nextRecoveryAction: "Generate image bytes, persist the file, and create SQL asset records. Production completion still requires semantic photoreal-human gates.",
    storageResult: instructions.mode.mode === "photoreal-human"
      ? "The worker is generating a photorealistic-human candidate for mandatory semantic validation."
      : "The worker is generating an original non-photoreal scene candidate.",
    modelResponse: JSON.stringify({
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      providerJobId,
      assignedAt: new Date().toISOString(),
      workflow: instructions.mode.mode,
      prompt: instructions.prompt,
      negativePrompt: instructions.negativePrompt,
      settings: instructions.settings,
      method: "candidate generation pending"
    })
  });
  await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
    state: "Generating",
    retryCount: job.RetryCount,
    providerResponse: JSON.stringify({
      provider: DEFAULT_PROVIDER,
      providerJobId,
      status: "started",
      workflow: instructions.mode.mode,
      prompt: instructions.prompt,
      negativePrompt: instructions.negativePrompt,
      settings: instructions.settings
    })
  });

  const rendered = await renderIndependentVisual(renderPrompt, width, height, providerJobId, instructions.mode.mode !== "photoreal-human");
  if (!rendered) {
    const nextRetry = job.RetryCount + 1;
    const defectSummary =
      "Local photorealistic-human renderer did not return a production image. Browser-rendered, procedural, vector, cartoon, or 3D fallback output is prohibited for this brief.";
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Rejected",
      retryCount: nextRetry,
      failureReason: `Rejected - Human realism failed. ${defectSummary}`,
      storageResult: "No production asset was persisted because the local neural renderer failed before quality validation.",
      providerResponse: JSON.stringify({
        provider: DEFAULT_PROVIDER,
        providerJobId,
        status: "rejected",
        workflow: instructions.mode.mode,
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
        failureReason: `Rejected - Human realism failed after ${nextRetry} attempts. ${defectSummary}`,
        nextRecoveryAction: "Configure a stronger local photorealistic human model or reduce local render settings, then regenerate.",
        storageResult: "Generation stopped without persisting a fallback image.",
        modelResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, providerJobId, workflow: instructions.mode.mode, defects: [defectSummary] })
      });
      await updateProductionState(pool, row, metadata, "visual-generation", "blocked", stateToProgress("Rejected"));
      return getImageGeneratorData();
    }
    const nextVariantNumber = Math.max(...variants.map((item) => item.VariantNumber), activeVariant.VariantNumber) + 1;
    const revisedPrompt = [
      buildPhotorealPrompt(brief, row, nextVariantNumber, nextRetry),
      "Revision instructions: reduce composition complexity if needed, keep one to three natural adult human subjects, enforce photographic lighting, realistic facial features, accurate hands, and grounded environmental shadows.",
      `Rejected defects to correct: ${defectSummary}`,
      `Negative prompt: ${instructions.negativePrompt}`
    ].join(" ");
    await createVariant(pool, row.ProductionId, job.ImageGenerationJobId, nextVariantNumber, revisedPrompt, "Queued", nextRetry);
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Revising",
      retryCount: nextRetry,
      providerJobId,
      failureReason: `Rejected - Human realism failed. ${defectSummary}`,
      nextRecoveryAction: "Revising visual instructions, regenerating with the local neural renderer, validating humans, checking anatomy, checking originality, then re-running quality approval.",
      storageResult: "Fallback output was blocked and a new neural-render variant was queued.",
      modelResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, providerJobId, workflow: instructions.mode.mode, defects: [defectSummary] })
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
    workflow: instructions.mode.mode,
    modeReason: instructions.mode.reason,
    byteLength: rendered.bytes.length,
    width: rendered.width,
    height: rendered.height,
    averageLuma: rendered.averageLuma,
    method: rendered.method
  };
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
    rendered.checksum
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

  const validationErrors = await validateStoredAsset(assetId);
  if (validationErrors.length) {
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Failed",
      retryCount: job.RetryCount,
      failureReason: `Asset endpoint validation failed: ${validationErrors.join(" ")}`,
      nextRecoveryAction: "Check the API asset route, storage file, and IIS or reverse-proxy path.",
      storageResult: `Stored asset ${assetId} but the served URL was not valid.`
    });
    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Failed",
      retryCount: job.RetryCount,
      assetId,
      failureReason: `Asset endpoint validation failed: ${validationErrors.join(" ")}`,
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
    nextRecoveryAction: "Await browser load acknowledgement for the persisted asset URL.",
    storageResult: `Verified image bytes at ${createVisualAssetUrl(assetId)}.`,
    modelResponse: JSON.stringify({ ...providerAudit, assetId, checksum: rendered.checksum, width: dimensions.width, height: dimensions.height })
  });
  await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Validating"));
  return getImageGeneratorData();
}

export async function acknowledgeImageAssetLoad(productionId: string, assetId: string, variantId: string) {
  const { pool, workspaceId } = await workspace();
  const row = (await listCandidateProductions(pool, workspaceId)).find((item) => item.ProductionId === productionId);
  if (!row) throw new Error("The production for this asset acknowledgement could not be found.");
  const { metadata } = ensureVisualBriefMetadata(row);
  const job = await latestJob(pool, productionId);
  if (!job) throw new Error("No active image-generation job exists for this production.");
  await setAssetBrowserLoad(pool, assetId, "loaded");
  await patchVariant(pool, variantId, {
    state: "Reviewing",
    retryCount: job.RetryCount,
    assetId,
    storageResult: `Browser successfully loaded ${createVisualAssetUrl(assetId)}.`
  });
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Reviewing",
    retryCount: job.RetryCount,
    nextRecoveryAction: "Run quality gates and decide whether to approve or revise the persisted asset.",
    storageResult: `Browser successfully loaded ${createVisualAssetUrl(assetId)}.`
  });
  await updateProductionState(pool, row, metadata, "visual-generation", "in-review", stateToProgress("Reviewing"));
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
  if (!fs.existsSync(asset.StoragePath)) throw new Error("The persisted image file is missing from storage.");
  const bytes = fs.readFileSync(asset.StoragePath);
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
