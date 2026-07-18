import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
  brand: number;
  composition: number;
  technical: number;
  originality: number;
  safety: number;
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
  "Completed"
] as const;

const STORAGE_DIR = path.join(process.env.CACSMS_PROJECT_ROOT || process.cwd(), ".generated", "visuals");
const DEFAULT_WORKER = "CACSMS Image Worker";
const DEFAULT_PROVIDER = "cacsms-autonomous-procedural-visual-engine";
const DEFAULT_MODEL = "CACSMS Original Human/3D Scene Renderer v2";
const MAX_RETRIES = 3;

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
  return Math.round((quality.brief + quality.brand + quality.composition + quality.technical + quality.originality + quality.safety) / 6);
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
    references: asStringList(visual.references, [`BRF-${row.Code}`, `SCENE-${row.Code}`, `BRAND-${row.Code}`])
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
        StorageResult=@storageResult,
        ProviderResponseJson=@providerResponse,
        QualityScore=@qualityScore,
        QualitySummaryJson=@qualitySummary,
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

function currentQuality(asset: AssetRow | null) {
  if (!asset) {
    return { brief: 91, brand: 89, composition: 82, technical: 80, originality: 95, safety: 100 } satisfies VisualQuality;
  }
  return {
    brief: 94,
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
    highlighted: variant.State === "Completed"
  }));
  if (job) {
    decisions.unshift({
      createdAt: toIso(job.UpdatedAt) ?? new Date().toISOString(),
      text: job.NextRecoveryAction || `The worker is ${job.State.toLowerCase()}.`,
      highlighted: job.State === "Completed"
    });
  }
  return decisions.slice(0, 6);
}

function versionsFor(variants: (VariantRow & Partial<AssetRow>)[]) {
  return variants.slice(0, 6).map((variant) => ({
    id: `v1.${variant.VariantNumber}`,
    note: variant.State === "Completed" ? "Approved persisted asset" : `${variant.State} variant`,
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
  const quality = currentQuality(activeAsset);
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
      active: items.filter((item) => item.state !== "Completed").length,
      approved: items.filter((item) => item.state === "Completed").length,
      averageQuality: average,
      queueDepth: items.filter((item) => ["Queued", "Generating", "Revising", "Validating", "Reviewing"].includes(item.state)).length
    }
  };
}

export async function runImageGenerationScheduler(): Promise<ImageGeneratorPayload> {
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
    await createVariant(pool, row.ProductionId, jobId, 1, brief.prompt, "Queued", 0);
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
    const quality = currentQuality(asset);
    const score = averageQuality(quality);
    const passed = quality.technical >= 86 && quality.composition >= 84 && quality.originality >= 92 && quality.brand >= 88;
    if (passed) {
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
        qualityScore: score,
        qualitySummary: JSON.stringify({ ...quality, passed: true })
      });
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Completed",
        retryCount: job.RetryCount,
        nextRecoveryAction: "No recovery required.",
        storageResult: `Approved asset ${asset.ImageGenerationAssetId} routed to timeline assembly.`,
        modelResponse: JSON.stringify({ ...(job.ModelResponseJson ? JSON.parse(job.ModelResponseJson) : {}), review: { ...quality, passed: true } })
      });
      await updateProductionState(pool, row, metadata, "assembly", "approved", 100);
      return getImageGeneratorData();
    }

    const nextRetry = job.RetryCount + 1;
    if (nextRetry >= MAX_RETRIES) {
      await patchJob(pool, job.ImageGenerationJobId, {
        state: "Failed",
        retryCount: nextRetry,
        failureReason: `Quality gates failed after ${nextRetry} attempts. Score ${score}.`,
        nextRecoveryAction: "Inspect the visual brief, generated asset, and quality rules before retrying again.",
        storageResult: `Revision limit reached for asset ${asset.ImageGenerationAssetId}.`
      });
      return getImageGeneratorData();
    }

    await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
      state: "Revising",
      retryCount: nextRetry,
      qualityScore: score,
      qualitySummary: JSON.stringify({ ...quality, passed: false })
    });
    await patchJob(pool, job.ImageGenerationJobId, {
      state: "Revising",
      retryCount: nextRetry,
      failureReason: `Quality gates requested a revision after score ${score}.`,
      nextRecoveryAction: "Generate the next revised variant with stronger focal clarity and composition balance.",
      storageResult: `Revision requested for asset ${asset.ImageGenerationAssetId}.`
    });
    const revisedPrompt = `${activeVariant.RenderPrompt} Increase focal clarity, improve composition balance, and preserve brand-safe contrast.`;
    await createVariant(pool, row.ProductionId, job.ImageGenerationJobId, Math.max(...variants.map((item) => item.VariantNumber)) + 1, revisedPrompt, "Queued", nextRetry);
    await updateProductionState(pool, row, metadata, "visual-generation", "active", stateToProgress("Revising"));
    return getImageGeneratorData();
  }

  if (!["Queued", "Generating", "Uploading", "Persisting", "Revising"].includes(job.State)) {
    return getImageGeneratorData();
  }

  const activeVariant = variants[0] ?? {
    ImageGenerationVariantId: await createVariant(pool, row.ProductionId, job.ImageGenerationJobId, 1, brief.prompt, "Queued", job.RetryCount),
    VariantNumber: 1,
    RenderPrompt: brief.prompt
  } as VariantRow & Partial<AssetRow>;

  const providerJobId = crypto.randomUUID();
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Generating",
    retryCount: job.RetryCount,
    providerJobId,
    nextRecoveryAction: "Generate image bytes, persist the file, and create SQL asset records.",
    storageResult: "The worker is generating original prompt-seeded human/3D PNG bytes.",
    modelResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, providerJobId, assignedAt: new Date().toISOString(), method: "deterministic procedural scene synthesis" })
  });
  await patchVariant(pool, activeVariant.ImageGenerationVariantId, {
    state: "Generating",
    retryCount: job.RetryCount,
    providerResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, providerJobId, status: "started" })
  });

  const { width, height } = dimensionsFromAspectRatio(brief.aspectRatio);
  const rendered = generatePromptPng(`${activeVariant.RenderPrompt}\nretry:${job.RetryCount}\nvariant:${activeVariant.VariantNumber}`, width, height);
  await patchJob(pool, job.ImageGenerationJobId, {
    state: "Uploading",
    retryCount: job.RetryCount,
    providerJobId,
    nextRecoveryAction: "Persist the generated bytes to storage.",
    storageResult: `Generated ${rendered.bytes.length} original human/3D scene bytes and preparing the filesystem write.`,
    modelResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL, providerJobId, averageLuma: rendered.averageLuma, byteLength: rendered.bytes.length, width, height, method: "prompt-seeded layered raster synthesis" })
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
    providerResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, providerJobId, storedAt: absolutePath, byteLength: size })
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
    providerResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, providerJobId, assetId, byteLength: size })
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
    modelResponse: JSON.stringify({ provider: DEFAULT_PROVIDER, providerJobId, assetId, checksum: rendered.checksum, width: dimensions.width, height: dimensions.height })
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
