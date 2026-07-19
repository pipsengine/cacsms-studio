import crypto from "node:crypto";
import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import { dispatchAssetEngineBatch } from "@/lib/worker-dispatch";
import {
  buildPhotorealStoryboardPrompt,
  persistLocalStoryboardFrame,
  readLocalStoryboardFrame,
  renderStoryboardPhotorealFrame
} from "@/lib/local-storyboard-frame-renderer";

const STORYBOARD_STEPS = [
  "Script validated",
  "Scenes decomposed",
  "Planning shots",
  "Continuity review",
  "Auto-revision",
  "Production ready"
] as const;

const STORYBOARD_MODEL = "CACSMS Storyboard Planning Engine v1";
const QUALITY_THRESHOLD = 85;
const MAX_SCENES = 12;
const MAX_DECISIONS = 10;
const SHOT_BLUEPRINT = [
  { title: "Establishing Wide", framing: "Static wide", camera: "Lock-off", asset: "Hero frame" },
  { title: "Medium Push-in", framing: "Dolly in", camera: "Push-in", asset: "Performance insert" },
  { title: "Data Wall Insert", framing: "Insert close-up", camera: "Subtle push-in", asset: "Interface overlay" },
  { title: "Over-shoulder", framing: "Over shoulder", camera: "Shoulder follow", asset: "Workflow support frame" },
  { title: "Hero Close-up", framing: "Close-up", camera: "Portrait lock", asset: "Expression frame" },
  { title: "Transition", framing: "Bridge frame", camera: "Match cut", asset: "Transition frame" }
] as const;
const STRUCTURE_LABELS = ["Hook", "Context", "Escalation", "Resolution", "CTA"] as const;

type ProductionRow = {
  ProductionId: string;
  Code: string;
  Title: string;
  ProductionType: string;
  Stage: string;
  Status: string;
  Priority: string;
  Progress: number;
  UpdatedAt: Date;
  MetadataJson: string | null;
};

type ScriptRunRow = {
  id: string;
  status: string;
  currentAction: string | null;
  currentAgentName: string | null;
  modelName: string | null;
  retryCount: number;
  qualityScore: number;
  blockerCode: string | null;
  blockerMessage: string | null;
  nextAction: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
};

type ScriptVersionRow = {
  id: string;
  label: string;
  content: string;
  wordCount: number;
  qualityScore: number;
  createdAt: string;
};

type ScriptSectionRow = {
  id: string;
  title: string;
  sequenceNo: number;
  status: string;
  wordCount: number;
  citationCount: number;
  content: string | null;
};

type ScriptSourceRow = {
  id: string;
  sourceTitle: string;
  sourceStatus: string;
  confidence: number;
  evidenceText: string;
  createdAt: string;
};

type ScriptCheckRow = {
  checkType: "factual" | "editorial" | "brand" | "safety" | "compliance";
  status: "passed" | "failed" | "warning";
  score: number;
  notes: string | null;
  createdAt: string;
};

type ScriptDecisionRow = {
  step: string;
  action: string;
  outcome: string;
  reason: string | null;
  createdAt: string;
};

type StoryboardStructureSegment = {
  label: string;
  percent: number;
  durationSeconds: number;
};

export type StoryboardShot = {
  id: string;
  number: number;
  title: string;
  framing: string;
  camera: string;
  durationSeconds: number;
  summary: string;
  visualFocus: string;
  narration: string;
  continuityStatus: string;
  status: string;
  assetExpectation: string;
  previewAssetId?: string | null;
  previewUrl?: string | null;
  previewFileName?: string | null;
  previewChecksumSha256?: string | null;
  previewRenderMode?: "photoreal-human" | "original-3d-scene" | null;
  previewSource?: "local" | "image-generator" | null;
};

export type StoryboardScene = {
  id: string;
  number: number;
  title: string;
  summary: string;
  narration: string;
  durationSeconds: number;
  status: string;
  coverageLabel: string;
  continuityStatus: string;
  assetCount: number;
  shots: StoryboardShot[];
};

export type StoryboardIssue = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  status: string;
  autoFix: string | null;
  resolved: boolean;
};

export type StoryboardVersion = {
  id: string;
  label: string;
  status: string;
  createdAt: string;
  sourceVersionLabel: string;
};

export type StoryboardDecision = {
  createdAt: string;
  text: string;
  highlighted?: boolean;
};

export type StoryboardAgent = {
  name: string;
  model: string;
  action: string;
  elapsedSeconds: number;
  heartbeat: string;
  retryCount: number;
  confidence: string;
  nextAction: string;
  compute: string;
};

export type StoryboardRouting = {
  status: string;
  visualStudio: string;
  sceneSequencer: string;
  approved: boolean;
  updatedAt: string | null;
};

export type StoryboardAdapter = {
  apiEndpoint: string;
  eventStreamEndpoint: string;
  mode: "polling" | "sse";
  live: boolean;
  lastSync: string;
  detail: string;
};

export type StoryboardProduction = {
  id: string;
  code: string;
  title: string;
  chapter: string;
  stage: string;
  priority: string;
  state: string;
  step: number;
  progress: number;
  updatedAt: string;
  durationSeconds: number;
  sceneCount: number;
  shotCount: number;
  versionLabel: string;
  brief: {
    objective: string;
    audience: string;
    duration: string;
    format: string;
    aspectRatio: string;
    visualStyle: string;
    brand: string;
  };
  structure: StoryboardStructureSegment[];
  sources: Array<{ id: string; label: string; status: string }>;
  scenes: StoryboardScene[];
  activeSceneId: string | null;
  activeShotId: string | null;
  quality: {
    coverage: number;
    flow: number;
    diversity: number;
    continuity: number;
    timing: number;
    brand: number;
    safety: number;
  };
  issues: StoryboardIssue[];
  versions: StoryboardVersion[];
  decisions: StoryboardDecision[];
  agent: StoryboardAgent;
  routing: StoryboardRouting;
  adapter: StoryboardAdapter;
  recovery: string | null;
  currentAction: string;
};

export type StoryboardPayload = {
  generatedAt: string;
  productions: StoryboardProduction[];
  summary: {
    total: number;
    active: number;
    ready: number;
    blocked: number;
    averageQuality: number;
  };
  engine: string;
  humanInputRequired: false;
};

type PersistedStoryboardSnapshot = {
  sourceRunId: string | null;
  sourceVersionId: string | null;
  sourceChecksum: string;
  generatedAt: string;
  versionNumber: number;
  versionLabel: string;
  sceneCount: number;
  shotCount: number;
  durationSeconds: number;
  structure: StoryboardStructureSegment[];
  scenes: StoryboardScene[];
  quality: StoryboardProduction["quality"];
  issues: StoryboardIssue[];
  routing: StoryboardRouting;
  recovery: string | null;
  versions: StoryboardVersion[];
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
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

function sanitizeText(value: unknown, max = 4000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function wordCount(text: string) {
  const normalized = sanitizeText(text, 50000);
  return normalized ? normalized.split(/\s+/).length : 0;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function titleCase(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function checksum(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function sentence(value: string, fallback: string) {
  const normalized = sanitizeText(value, 600);
  if (!normalized) return fallback;
  const match = normalized.match(/(.+?[.!?])(?:\s|$)/);
  return sanitizeText(match?.[1] ?? normalized, 180);
}

function summarize(value: string, fallback: string, max = 180) {
  const normalized = sanitizeText(value, max * 2);
  if (!normalized) return fallback;
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((item) => sanitizeText(item, 2000))
    .filter(Boolean);
}

function parseDuration(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== "string" || !value.trim()) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.every((part) => Number.isFinite(part))) {
    if (parts.length === 2) return Math.max(30, parts[0] * 60 + parts[1]);
    if (parts.length === 3) return Math.max(30, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber > 0 ? Math.round(asNumber) : null;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.max(0, seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function overallQuality(quality: StoryboardProduction["quality"]) {
  return Math.round(
    (quality.coverage +
      quality.flow +
      quality.diversity +
      quality.continuity +
      quality.timing +
      quality.brand +
      quality.safety) /
      7
  );
}

function qualityFromChecks(checks: ScriptCheckRow[], type: ScriptCheckRow["checkType"], fallback: number) {
  const check = checks.find((entry) => entry.checkType === type);
  if (!check) return fallback;
  if (check.status === "failed") return clamp(check.score, 0, 74);
  if (check.status === "warning") return clamp(check.score, 55, 88);
  return clamp(check.score, 70, 100);
}

function safeMetadataSnapshot(metadata: Record<string, unknown>) {
  const snapshot = asObject(metadata.autonomousStoryboard);
  if (!snapshot.generatedAt || !Array.isArray(snapshot.scenes)) return null;
  return snapshot as unknown as PersistedStoryboardSnapshot;
}

function scoreProductionFrameWorkPriority(row: ProductionRow) {
  const metadata = parseMetadata(row.MetadataJson);
  const snapshot = safeMetadataSnapshot(metadata);
  if (!snapshot?.scenes?.length) return 1_000;

  const previewIds: string[] = [];
  let totalShots = 0;
  for (const scene of snapshot.scenes) {
    for (const shot of scene.shots) {
      totalShots += 1;
      if (shot.previewAssetId) previewIds.push(shot.previewAssetId);
    }
  }

  const duplicateCount = previewIds.length - new Set(previewIds).size;
  const missingCount = Math.max(0, totalShots - previewIds.length);
  if (duplicateCount > 0) return 900 + duplicateCount * 10 + missingCount;
  if (missingCount > 0) return 500 + missingCount;
  return 0;
}

function prioritizeStoryboardSchedulerRows(rows: ProductionRow[]) {
  return [...rows].sort((left, right) => {
    const priorityDelta = scoreProductionFrameWorkPriority(right) - scoreProductionFrameWorkPriority(left);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.UpdatedAt).getTime() - new Date(left.UpdatedAt).getTime();
  });
}

function missingSchema(error: unknown) {
  return (
    error instanceof Error &&
    (/Invalid object name/i.test(error.message) ||
      /Invalid column name/i.test(error.message) ||
      /ProductionScript/i.test(error.message) ||
      /ScriptWritingRuns/i.test(error.message))
  );
}

async function getContext() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<{ WorkspaceId: string }>(
    "SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;"
  );
  const row = result.recordset[0];
  if (!row) throw new Error("No active workspace.");
  return { pool, workspaceId: row.WorkspaceId };
}

async function listCandidateProductions(pool: sql.ConnectionPool, workspaceId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .query<ProductionRow>(`
      SELECT TOP(12)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND p.Status NOT IN (N'archived', N'cancelled')
        AND (
          p.Stage IN (
            N'research',
            N'scripting',
            N'storyboard',
            N'visual-generation',
            N'audio-generation',
            N'quality-assurance',
            N'assembly',
            N'publishing',
            N'completed'
          )
          OR p.MetadataJson LIKE N'%"autonomousStoryboard"%'
          OR p.MetadataJson LIKE N'%"scriptBody"%'
          OR EXISTS (
            SELECT 1
            FROM cacsms.ScriptWritingRuns sw
            WHERE sw.ProductionId = p.ProductionId
              AND sw.Status = N'completed'
              AND sw.MandatoryGatesPassed = 1
          )
        )
      ORDER BY
        CASE
          WHEN p.Stage = N'storyboard' THEN 0
          WHEN p.MetadataJson LIKE N'%"autonomousStoryboard"%' THEN 1
          WHEN EXISTS (
            SELECT 1
            FROM cacsms.ScriptWritingRuns sw
            WHERE sw.ProductionId = p.ProductionId
              AND sw.Status = N'completed'
              AND sw.MandatoryGatesPassed = 1
          ) THEN 2
          WHEN p.Stage = N'scripting' THEN 3
          WHEN p.Stage = N'visual-generation' THEN 4
          WHEN p.Stage = N'assembly' THEN 5
          ELSE 6
        END,
        p.UpdatedAt DESC;
    `);
  return result.recordset;
}

async function loadProductionRow(pool: sql.ConnectionPool, workspaceId: string, productionId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .input("productionId", sql.NVarChar(36), productionId)
    .query<ProductionRow>(`
      SELECT TOP(1)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND CONVERT(nvarchar(36), p.ProductionId) = @productionId;
    `);
  return result.recordset[0] ?? null;
}

async function loadLatestScriptRun(pool: sql.ConnectionPool, productionId: string) {
  try {
    const result = await pool.request().input("productionId", sql.NVarChar(36), productionId).query<ScriptRunRow>(`
      SELECT TOP(1)
        CONVERT(nvarchar(36), ScriptWritingRunId) AS id,
        Status AS status,
        CurrentAction AS currentAction,
        CurrentAgentName AS currentAgentName,
        ModelName AS modelName,
        RetryCount AS retryCount,
        CONVERT(float, QualityScore) AS qualityScore,
        BlockerCode AS blockerCode,
        BlockerMessage AS blockerMessage,
        NextAction AS nextAction,
        CONVERT(nvarchar(40), StartedAt, 127) AS startedAt,
        CONVERT(nvarchar(40), LastHeartbeatAt, 127) AS lastHeartbeatAt
      FROM cacsms.ScriptWritingRuns
      WHERE CONVERT(nvarchar(36), ProductionId) = @productionId
      ORDER BY CreatedAt DESC;
    `);
    return result.recordset[0] ?? null;
  } catch (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
}

async function loadLatestScriptVersion(pool: sql.ConnectionPool, runId: string | null) {
  if (!runId) return null;
  try {
    const result = await pool.request().input("runId", sql.NVarChar(36), runId).query<ScriptVersionRow>(`
      SELECT TOP(1)
        CONVERT(nvarchar(36), ProductionScriptVersionId) AS id,
        Label AS label,
        Content AS content,
        WordCount AS wordCount,
        CONVERT(float, QualityScore) AS qualityScore,
        CONVERT(nvarchar(40), CreatedAt, 127) AS createdAt
      FROM cacsms.ProductionScriptVersions
      WHERE CONVERT(nvarchar(36), ScriptWritingRunId) = @runId
      ORDER BY CreatedAt DESC;
    `);
    return result.recordset[0] ?? null;
  } catch (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
}

async function loadScriptSections(pool: sql.ConnectionPool, runId: string | null) {
  if (!runId) return [];
  try {
    const result = await pool.request().input("runId", sql.NVarChar(36), runId).query<ScriptSectionRow>(`
      SELECT
        CONVERT(nvarchar(36), ProductionScriptSectionId) AS id,
        Title AS title,
        SequenceNo AS sequenceNo,
        Status AS status,
        WordCount AS wordCount,
        CitationCount AS citationCount,
        Content AS content
      FROM cacsms.ProductionScriptSections
      WHERE CONVERT(nvarchar(36), ScriptWritingRunId) = @runId
      ORDER BY SequenceNo;
    `);
    return result.recordset;
  } catch (error) {
    if (missingSchema(error)) return [];
    throw error;
  }
}

async function loadScriptSources(pool: sql.ConnectionPool, runId: string | null) {
  if (!runId) return [];
  try {
    const result = await pool.request().input("runId", sql.NVarChar(36), runId).query<ScriptSourceRow>(`
      SELECT TOP(12)
        CONVERT(nvarchar(36), ProductionScriptEvidenceId) AS id,
        SourceTitle AS sourceTitle,
        SourceStatus AS sourceStatus,
        CONVERT(float, Confidence) AS confidence,
        EvidenceText AS evidenceText,
        CONVERT(nvarchar(40), CreatedAt, 127) AS createdAt
      FROM cacsms.ProductionScriptEvidence
      WHERE CONVERT(nvarchar(36), ScriptWritingRunId) = @runId
      ORDER BY CreatedAt DESC;
    `);
    return result.recordset;
  } catch (error) {
    if (missingSchema(error)) return [];
    throw error;
  }
}

async function loadScriptChecks(pool: sql.ConnectionPool, runId: string | null) {
  if (!runId) return [];
  try {
    const result = await pool.request().input("runId", sql.NVarChar(36), runId).query<ScriptCheckRow>(`
      SELECT
        CheckType AS checkType,
        Status AS status,
        CONVERT(float, Score) AS score,
        Notes AS notes,
        CONVERT(nvarchar(40), CreatedAt, 127) AS createdAt
      FROM cacsms.ProductionScriptChecks
      WHERE CONVERT(nvarchar(36), ScriptWritingRunId) = @runId
      ORDER BY CreatedAt DESC, ProductionScriptCheckId DESC;
    `);
    return result.recordset;
  } catch (error) {
    if (missingSchema(error)) return [];
    throw error;
  }
}

async function loadScriptDecisions(pool: sql.ConnectionPool, runId: string | null) {
  if (!runId) return [];
  try {
    const result = await pool.request().input("runId", sql.NVarChar(36), runId).query<ScriptDecisionRow>(`
      SELECT TOP(8)
        Step AS step,
        Action AS action,
        Outcome AS outcome,
        Reason AS reason,
        CONVERT(nvarchar(40), CreatedAt, 127) AS createdAt
      FROM cacsms.ProductionScriptDecisions
      WHERE CONVERT(nvarchar(36), ScriptWritingRunId) = @runId
      ORDER BY CreatedAt DESC, ProductionScriptDecisionId DESC;
    `);
    return result.recordset;
  } catch (error) {
    if (missingSchema(error)) return [];
    throw error;
  }
}

async function persistStoryboardSnapshot(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  metadata: Record<string, unknown>,
  snapshot: PersistedStoryboardSnapshot
) {
  const merged = {
    ...metadata,
    autonomousStoryboard: snapshot
  };
  await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .input("progress", sql.TinyInt, clamp(Math.max(row.Progress, snapshot.routing.approved ? 82 : snapshot.sceneCount > 0 ? 58 : 12)))
    .query(`
      UPDATE cacsms.Productions
      SET MetadataJson = @metadata,
          Progress = @progress,
          UpdatedAt = SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ProductionId) = @productionId;
    `);
}

function buildStructure(durationSeconds: number): StoryboardStructureSegment[] {
  const ratios = [8, 16, 38, 26, 12];
  const base = ratios.reduce((sum, value) => sum + value, 0);
  let allocated = 0;
  return ratios.map((percent, index) => {
    if (index === ratios.length - 1) {
      return {
        label: STRUCTURE_LABELS[index],
        percent,
        durationSeconds: Math.max(1, durationSeconds - allocated)
      };
    }
    const segment = Math.max(1, Math.round((durationSeconds * percent) / base));
    allocated += segment;
    return {
      label: STRUCTURE_LABELS[index],
      percent,
      durationSeconds: segment
    };
  });
}

function buildSceneTitle(index: number, seed: string) {
  const clean = seed.replace(/^#+\s*/, "").replace(/^[0-9]+[.)-]\s*/, "").trim();
  if (clean) {
    return `Scene ${String(index + 1).padStart(2, "0")} · ${clean.slice(0, 52)}`;
  }
  return `Scene ${String(index + 1).padStart(2, "0")} · Story progression`;
}

function buildScenes(scriptText: string, sections: ScriptSectionRow[], durationSeconds: number) {
  const sectionBlocks = sections
    .map((section) => ({
      title: sanitizeText(section.title, 120),
      content: sanitizeText(section.content, 2000)
    }))
    .filter((section) => section.content);
  const paragraphBlocks =
    sectionBlocks.length > 0
      ? sectionBlocks
      : splitParagraphs(scriptText).map((paragraph, index) => ({
          title: `Narrative beat ${index + 1}`,
          content: paragraph
        }));

  if (!paragraphBlocks.length) return [];

  const targetScenes = Math.max(3, Math.min(MAX_SCENES, Math.ceil(wordCount(scriptText) / 110)));
  const chunkSize = Math.max(1, Math.ceil(paragraphBlocks.length / targetScenes));
  const groups: Array<Array<{ title: string; content: string }>> = [];
  for (let index = 0; index < paragraphBlocks.length; index += chunkSize) {
    groups.push(paragraphBlocks.slice(index, index + chunkSize));
  }

  const sceneCount = Math.max(1, groups.length);
  const perSceneDuration = Math.max(8, Math.round(durationSeconds / sceneCount));

  return groups.map((group, sceneIndex) => {
    const content = group.map((entry) => entry.content).join(" ");
    const primaryTitle = group[0]?.title ?? `Narrative beat ${sceneIndex + 1}`;
    const shotTarget = Math.max(3, Math.min(6, Math.ceil(wordCount(content) / 45)));
    const perShotDuration = Math.max(3, Math.round(perSceneDuration / shotTarget));
    const shots: StoryboardShot[] = Array.from({ length: shotTarget }, (_, shotIndex) => {
      const blueprint = SHOT_BLUEPRINT[shotIndex % SHOT_BLUEPRINT.length];
      const shotSummary = sentence(
        group[Math.min(shotIndex, group.length - 1)]?.content ?? content,
        "Narrative framing derived from the persisted script version."
      );
      return {
        id: `scene-${sceneIndex + 1}-shot-${shotIndex + 1}`,
        number: shotIndex + 1,
        title: blueprint.title,
        framing: blueprint.framing,
        camera: blueprint.camera,
        durationSeconds: perShotDuration,
        summary: shotSummary,
        visualFocus: summarize(shotSummary, "Primary action from the verified script."),
        narration: summarize(content, "Narration is aligned to the persisted script version.", 120),
        continuityStatus: "Monitoring",
        status: shotIndex === Math.min(2, shotTarget - 1) ? "Planning" : "Planned",
        assetExpectation: blueprint.asset
      };
    });

    return {
      id: `scene-${sceneIndex + 1}`,
      number: sceneIndex + 1,
      title: buildSceneTitle(sceneIndex, primaryTitle),
      summary: summarize(content, "Storyboard scene derived from the persisted script version.", 190),
      narration: summarize(content, "Narration is aligned to the persisted script version.", 220),
      durationSeconds: perSceneDuration,
      status: sceneIndex === Math.min(2, sceneCount - 1) ? "Planning" : sceneIndex < Math.min(2, sceneCount) ? "Complete" : "Queued",
      coverageLabel: STRUCTURE_LABELS[Math.min(STRUCTURE_LABELS.length - 1, Math.floor((sceneIndex / Math.max(1, sceneCount - 1)) * (STRUCTURE_LABELS.length - 1)))],
      continuityStatus: "Monitoring",
      assetCount: shots.length * 2 + 1,
      shots
    };
  });
}

function detectIssues(
  scenes: StoryboardScene[],
  sources: ScriptSourceRow[],
  checks: ScriptCheckRow[],
  hasScript: boolean
) {
  const issues: StoryboardIssue[] = [];

  if (!hasScript) {
    issues.push({
      id: "missing-script",
      title: "Storyboard is waiting for a persisted script version.",
      detail: "The autonomous storyboard engine will not create scenes until a persisted script body or version exists.",
      severity: "critical",
      status: "Waiting",
      autoFix: "Continue autonomous polling until script generation persists content.",
      resolved: false
    });
    return issues;
  }

  if (sources.length < 2) {
    issues.push({
      id: "thin-evidence",
      title: "Research coverage is thin for storyboard validation.",
      detail: "Scene planning is active, but fewer than two persisted research sources were found for narrative grounding.",
      severity: "warning",
      status: "Auto-fix active",
      autoFix: "Use the next scheduler cycle to inherit additional verified evidence from writing.",
      resolved: false
    });
  }

  const continuityCheck = checks.find((entry) => entry.checkType === "editorial" || entry.checkType === "factual");
  if (continuityCheck?.status === "warning" || continuityCheck?.status === "failed") {
    issues.push({
      id: "continuity-risk",
      title: "Continuity risk detected in the source script checks.",
      detail: continuityCheck.notes
        ? summarize(continuityCheck.notes, "Editorial continuity guidance requires an automatic revision pass.")
        : "The persisted script checks flagged editorial continuity or factual drift that storyboard planning must resolve.",
      severity: continuityCheck.status === "failed" ? "critical" : "warning",
      status: "Auto-fix active",
      autoFix: "Re-balance shot ordering and tighten narration alignment before routing.",
      resolved: false
    });
  }

  if (scenes.length > 0) {
    const durations = scenes.map((scene) => scene.durationSeconds);
    const variance = Math.max(...durations) - Math.min(...durations);
    if (variance > 20) {
      issues.push({
        id: "timing-spread",
        title: "Scene timing spread needs balancing.",
        detail: "One or more scenes are significantly longer than adjacent beats, so automatic timing normalization is enabled.",
        severity: "warning",
        status: "Normalizing",
        autoFix: "Redistribute shot density across adjacent scenes.",
        resolved: false
      });
    }
  }

  return issues;
}

function buildQuality(
  scenes: StoryboardScene[],
  durationSeconds: number,
  sources: ScriptSourceRow[],
  checks: ScriptCheckRow[],
  version: ScriptVersionRow | null
) {
  const shotCount = scenes.reduce((total, scene) => total + scene.shots.length, 0);
  const distinctShotTypes = new Set(scenes.flatMap((scene) => scene.shots.map((shot) => shot.title))).size;
  const coverage = clamp((scenes.length / Math.max(3, Math.min(MAX_SCENES, scenes.length || 3))) * 100);
  const flow = clamp(70 + Math.min(24, scenes.length * 2) - Math.max(0, scenes.length > 10 ? scenes.length - 10 : 0));
  const diversity = clamp(55 + distinctShotTypes * 7);
  const continuityPenalty = detectIssues(scenes, sources, checks, true).filter((issue) => !issue.resolved).length * 7;
  const continuity = clamp(92 - continuityPenalty);
  const expectedDuration = Math.max(30, Math.round((version?.wordCount ?? wordCount(scenes.map((scene) => scene.narration).join(" "))) / 150) * 60);
  const timing = clamp(100 - Math.min(35, Math.abs(durationSeconds - expectedDuration) / 2));
  const brand = qualityFromChecks(checks, "brand", 88);
  const safety = Math.min(qualityFromChecks(checks, "safety", 96), qualityFromChecks(checks, "compliance", 94));

  return {
    coverage,
    flow,
    diversity,
    continuity,
    timing,
    brand,
    safety
  };
}

function buildStoryboardState(
  row: ProductionRow,
  scenes: StoryboardScene[],
  quality: StoryboardProduction["quality"],
  issues: StoryboardIssue[],
  hasScript: boolean
) {
  if (!hasScript) {
    return { state: "Waiting for Script", step: 0, progress: 8 };
  }
  if (row.Stage === "assembly") {
    return { state: "Sequencing", step: 5, progress: Math.max(row.Progress, 96) };
  }
  if (row.Stage === "visual-generation") {
    return { state: "Routed to Visual Studio", step: 5, progress: Math.max(row.Progress, 90) };
  }

  const openCritical = issues.some((issue) => issue.severity === "critical" && !issue.resolved);
  const openIssues = issues.some((issue) => !issue.resolved);
  const score = overallQuality(quality);

  if (openCritical) return { state: "Auto Revising", step: 4, progress: 72 };
  if (openIssues) return { state: "Continuity Review", step: 3, progress: 68 };
  if (score >= QUALITY_THRESHOLD && scenes.length > 0) return { state: "Production Ready", step: 5, progress: 84 };
  return { state: "Planning Shots", step: 2, progress: 58 };
}

function buildRouting(row: ProductionRow, state: string, quality: StoryboardProduction["quality"], generatedAt: string) {
  const ready = overallQuality(quality) >= QUALITY_THRESHOLD && state === "Production Ready";
  if (row.Stage === "assembly") {
    return {
      status: "Scene Sequencer active",
      visualStudio: "Visual assets already routed",
      sceneSequencer: "Assembly is consuming the approved storyboard package",
      approved: true,
      updatedAt: generatedAt
    } satisfies StoryboardRouting;
  }
  if (row.Stage === "visual-generation") {
    return {
      status: "Visual Studio active",
      visualStudio: "Approved storyboard package is active in Visual Studio",
      sceneSequencer: "Will unlock after visual assets complete",
      approved: true,
      updatedAt: generatedAt
    } satisfies StoryboardRouting;
  }
  if (ready) {
    return {
      status: "Awaiting autonomous asset generation handoff",
      visualStudio: "Ready for Visual Studio asset queue",
      sceneSequencer: "Ready after visual approvals are persisted",
      approved: true,
      updatedAt: generatedAt
    } satisfies StoryboardRouting;
  }
  return {
    status: "Locked until storyboard gates pass",
    visualStudio: "Waiting for storyboard quality approval",
    sceneSequencer: "Waiting for storyboard and visual approvals",
    approved: false,
    updatedAt: generatedAt
  } satisfies StoryboardRouting;
}

function buildVersions(
  existing: PersistedStoryboardSnapshot | null,
  sourceVersionLabel: string,
  changed: boolean,
  generatedAt: string,
  state: string
) {
  if (!existing || changed) {
    const nextVersionNumber = (existing?.versionNumber ?? 0) + 1;
    const current: StoryboardVersion = {
      id: `sb-${slug(`${sourceVersionLabel}-${generatedAt}`)}`,
      label: `SB-v${nextVersionNumber}`,
      status: state,
      createdAt: generatedAt,
      sourceVersionLabel
    };
    return {
      versionNumber: nextVersionNumber,
      versionLabel: current.label,
      versions: [current, ...(existing?.versions ?? [])].slice(0, 6)
    };
  }

  const versions = [...(existing.versions ?? [])];
  if (versions[0]) {
    versions[0] = {
      ...versions[0],
      status: state
    };
  }
  return {
    versionNumber: existing.versionNumber,
    versionLabel: existing.versionLabel,
    versions
  };
}

function buildSources(row: ProductionRow, version: ScriptVersionRow | null, sources: ScriptSourceRow[]) {
  const metadata = parseMetadata(row.MetadataJson);
  const sourceTitle = sanitizeText(metadata.sourceTitle, 120);
  const unique = new Map<string, { id: string; label: string; status: string }>();
  if (version) {
    unique.set(`script-${version.id}`, {
      id: `script-${version.id}`,
      label: `${version.label} · ${version.wordCount} words`,
      status: `Storyboard source · ${Math.round(version.qualityScore)}% quality`
    });
  }
  if (sourceTitle) {
    unique.set("origin-record", {
      id: "origin-record",
      label: sourceTitle,
      status: "Originating production context"
    });
  }
  for (const source of sources) {
    if (!unique.has(source.id)) {
      unique.set(source.id, {
        id: source.id,
        label: sanitizeText(source.sourceTitle, 90) || "Verified source",
        status: `${sanitizeText(source.sourceStatus, 40) || "verified"} · ${clamp(source.confidence)}% confidence`
      });
    }
  }
  return [...unique.values()].slice(0, 6);
}

function buildDecisions(
  snapshot: PersistedStoryboardSnapshot,
  state: string,
  scriptRun: ScriptRunRow | null,
  scriptDecisions: ScriptDecisionRow[]
) {
  const decisions: StoryboardDecision[] = [
    {
      createdAt: snapshot.generatedAt,
      text:
        snapshot.sceneCount > 0
          ? `Decomposed ${snapshot.sceneCount} scenes and ${snapshot.shotCount} planned shots from the latest persisted script source.`
          : "Waiting for the writing engine to persist storyboard-ready script content.",
      highlighted: true
    },
    {
      createdAt: snapshot.generatedAt,
      text: `Storyboard state is "${state}" with truthful routing status "${snapshot.routing.status}".`
    }
  ];

  for (const issue of snapshot.issues.slice(0, 3)) {
    decisions.push({
      createdAt: snapshot.generatedAt,
      text: `${issue.title} ${issue.autoFix ? `Recovery: ${issue.autoFix}` : issue.detail}`
    });
  }

  if (scriptRun?.currentAction) {
    decisions.push({
      createdAt: scriptRun.lastHeartbeatAt ?? scriptRun.startedAt ?? snapshot.generatedAt,
      text: `Writing handoff context: ${sanitizeText(scriptRun.currentAction, 180)}`
    });
  }

  for (const entry of scriptDecisions.slice(0, 4)) {
    decisions.push({
      createdAt: entry.createdAt,
      text: `${entry.step.replace(/-/g, " ")} / ${entry.action.replace(/-/g, " ")}: ${sanitizeText(entry.reason, 140) || entry.outcome}`
    });
  }

  return decisions
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, MAX_DECISIONS);
}

function buildAgent(
  scriptRun: ScriptRunRow | null,
  state: string,
  issues: StoryboardIssue[],
  generatedAt: string,
  shotCount: number
) {
  const startedAt = scriptRun?.startedAt ? new Date(scriptRun.startedAt).getTime() : Date.now();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const heartbeat = scriptRun?.lastHeartbeatAt
    ? `Active · ${new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(scriptRun.lastHeartbeatAt))}`
    : `Storyboard sync · ${new Intl.DateTimeFormat("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date(generatedAt))}`;

  return {
    name: "Story Agent Alpha",
    model: scriptRun?.modelName || STORYBOARD_MODEL,
    action:
      state === "Waiting for Script"
        ? "Monitoring the writing handoff for a persisted storyboard-ready script."
        : issues.some((issue) => !issue.resolved)
          ? "Resolving continuity, evidence, and timing issues before routing."
          : "Preparing a controlled routing package for Visual Studio and Scene Sequencer.",
    elapsedSeconds,
    heartbeat,
    retryCount: scriptRun?.retryCount ?? 0,
    confidence:
      issues.some((issue) => issue.severity === "critical" && !issue.resolved)
        ? "Medium"
        : state === "Production Ready" || state === "Routed to Visual Studio" || state === "Sequencing"
          ? "High"
          : "Building",
    nextAction:
      issues.some((issue) => !issue.resolved)
        ? "Complete auto-revision and re-run continuity gates."
        : state === "Waiting for Script"
          ? "Claim the next persisted script version."
          : state === "Production Ready"
            ? "Release the approved package to Visual Studio."
            : "Finalize scene, shot, and narration alignment.",
    compute: `${Math.max(1, Math.ceil(shotCount / 6))}.0 vCPU · ${Math.max(4, Math.ceil(shotCount / 5))}.0 GB`
  } satisfies StoryboardAgent;
}

function deriveStoryboardData(
  row: ProductionRow,
  metadata: Record<string, unknown>,
  scriptRun: ScriptRunRow | null,
  version: ScriptVersionRow | null,
  sections: ScriptSectionRow[],
  sources: ScriptSourceRow[],
  checks: ScriptCheckRow[],
  decisions: ScriptDecisionRow[],
  existingSnapshot: PersistedStoryboardSnapshot | null
) {
  const generatedAt = new Date().toISOString();
  const bodyFromMetadata = sanitizeText(metadata.scriptBody, 40000);
  const scriptText =
    sanitizeText(version?.content, 40000) ||
    bodyFromMetadata ||
    sections.map((section) => sanitizeText(section.content, 2000)).filter(Boolean).join("\n\n");
  const hasScript = wordCount(scriptText) > 0;
  const sourceVersionId = version?.id ?? null;
  const sourceVersionLabel = version?.label ?? "Persisted script body";
  const sourceRunId = scriptRun?.id ?? null;
  const sourceChecksum = checksum(`${sourceVersionId ?? "metadata"}:${scriptText}`);
  const snapshotMatches =
    Boolean(existingSnapshot) &&
    existingSnapshot!.sourceChecksum === sourceChecksum &&
    existingSnapshot!.sourceVersionId === sourceVersionId &&
    existingSnapshot!.scenes.length > 0;
  const durationSeconds =
    snapshotMatches && existingSnapshot
      ? existingSnapshot.durationSeconds
      : (parseDuration(metadata.durationSeconds) ??
        parseDuration(metadata.duration) ??
        Math.max(60, Math.round((version?.wordCount ?? wordCount(scriptText)) / 150) * 60));
  const scenes =
    snapshotMatches && existingSnapshot
      ? existingSnapshot.scenes
      : hasScript
        ? buildScenes(scriptText, sections, durationSeconds)
        : [];
  const issues =
    snapshotMatches && existingSnapshot
      ? existingSnapshot.issues
      : detectIssues(scenes, sources, checks, hasScript);
  const quality =
    snapshotMatches && existingSnapshot
      ? existingSnapshot.quality
      : hasScript
        ? buildQuality(scenes, durationSeconds, sources, checks, version)
        : {
            coverage: 0,
            flow: 0,
            diversity: 0,
            continuity: 0,
            timing: 0,
            brand: qualityFromChecks(checks, "brand", 0),
            safety: qualityFromChecks(checks, "safety", 0)
          };
  const workflow = buildStoryboardState(row, scenes, quality, issues, hasScript);
  const routing = buildRouting(row, workflow.state, quality, generatedAt);
  const changed =
    !existingSnapshot ||
    existingSnapshot.sourceChecksum !== sourceChecksum ||
    existingSnapshot.sourceVersionId !== sourceVersionId ||
    existingSnapshot.routing.status !== routing.status;
  const versionState = buildVersions(existingSnapshot, sourceVersionLabel, changed, generatedAt, workflow.state);
  const snapshot: PersistedStoryboardSnapshot = {
    sourceRunId,
    sourceVersionId,
    sourceChecksum,
    generatedAt,
    versionNumber: versionState.versionNumber,
    versionLabel: versionState.versionLabel,
    sceneCount: scenes.length,
    shotCount: scenes.reduce((total, scene) => total + scene.shots.length, 0),
    durationSeconds,
    structure: snapshotMatches && existingSnapshot ? existingSnapshot.structure : buildStructure(durationSeconds),
    scenes,
    quality,
    issues,
    routing,
    recovery:
      hasScript && issues.some((issue) => !issue.resolved)
        ? "Automatic continuity, timing, and evidence recovery remains active until all storyboard gates pass."
        : hasScript
          ? "Storyboard package is ready for controlled downstream routing."
          : "Continue autonomous polling for a persisted storyboard-ready script.",
    versions: versionState.versions
  };

  const activeScene =
    scenes.find((scene) => scene.status === "Planning") ??
    scenes[Math.min(2, Math.max(0, scenes.length - 1))] ??
    null;
  const activeShot = activeScene?.shots.find((shot) => shot.status === "Planning") ?? activeScene?.shots[0] ?? null;
  const decisionsView = buildDecisions(snapshot, workflow.state, scriptRun, decisions);

  return {
    snapshot,
    production: {
      id: row.ProductionId,
      code: row.Code,
      title: row.Title,
      chapter: asString(metadata.chapter, `Chapter 01 · ${row.Title}`),
      stage: titleCase(row.Stage),
      priority: titleCase(row.Priority),
      state: workflow.state,
      step: workflow.step,
      progress: clamp(Math.max(row.Progress, workflow.progress)),
      updatedAt: toIso(row.UpdatedAt) ?? generatedAt,
      durationSeconds,
      sceneCount: snapshot.sceneCount,
      shotCount: snapshot.shotCount,
      versionLabel: snapshot.versionLabel,
      brief: {
        objective: asString(metadata.objective, asString(metadata.goal, `Translate ${row.Title} into storyboard-ready visual beats.`)),
        audience: asString(metadata.audience, "Decision-makers and professional audiences"),
        duration: formatDuration(durationSeconds),
        format: asString(metadata.format, row.ProductionType),
        aspectRatio: asString(metadata.aspectRatio, "16:9"),
        visualStyle: asString(metadata.visualStyle, "Cinematic corporate"),
        brand: asString(metadata.brandProfile, "CACSMS Corporate 2026")
      },
      structure: snapshot.structure,
      sources: buildSources(row, version, sources),
      scenes: snapshot.scenes,
      activeSceneId: activeScene?.id ?? null,
      activeShotId: activeShot?.id ?? null,
      quality: snapshot.quality,
      issues: snapshot.issues,
      versions: snapshot.versions,
      decisions: decisionsView,
      agent: buildAgent(scriptRun, workflow.state, snapshot.issues, generatedAt, snapshot.shotCount),
      routing: snapshot.routing,
      adapter: {
        apiEndpoint: "/api/storyboard/storyboard-editor",
        eventStreamEndpoint: "/api/storyboard/storyboard-editor/events",
        mode: "polling",
        live: true,
        lastSync: generatedAt,
        detail: "Polling adapter is active. SSE endpoint is reserved for future runtime streaming."
      },
      recovery: snapshot.recovery,
      currentAction:
        scriptRun?.currentAction ||
        (workflow.state === "Waiting for Script"
          ? "Waiting for the writing engine to persist storyboard-ready content."
          : workflow.state === "Production Ready"
            ? "Controlled routing package is prepared for downstream autonomous modules."
            : "Storyboard planning is decomposing scenes, aligning narration, and validating continuity.")
    } satisfies StoryboardProduction,
    changed
  };
}

async function materializeProduction(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  persist: boolean
): Promise<StoryboardProduction> {
  const metadata = parseMetadata(row.MetadataJson);
  const existingSnapshot = safeMetadataSnapshot(metadata);
  const scriptRun = await loadLatestScriptRun(pool, row.ProductionId);
  const version = await loadLatestScriptVersion(pool, scriptRun?.id ?? null);
  const sections = await loadScriptSections(pool, scriptRun?.id ?? null);
  const sources = await loadScriptSources(pool, scriptRun?.id ?? null);
  const checks = await loadScriptChecks(pool, scriptRun?.id ?? null);
  const decisions = await loadScriptDecisions(pool, scriptRun?.id ?? null);
  let derived = deriveStoryboardData(row, metadata, scriptRun, version, sections, sources, checks, decisions, existingSnapshot);

  if (persist) {
    derived = await completeStoryboardFrameGeneration(pool, row, derived);
    if (derived.changed) {
      await persistStoryboardSnapshot(pool, row, metadata, derived.snapshot);
    }
    if (derived.snapshot.routing.approved) {
      await seedVisualGenerationBrief(pool, row, metadata, derived);
    }
  }

  return derived.production;
}

function countGeneratedFrames(scenes: StoryboardScene[]) {
  return scenes.reduce(
    (total, scene) => total + scene.shots.filter((shot) => Boolean(shot.previewAssetId)).length,
    0
  );
}

function needsPhotorealPreview(shot: StoryboardShot, scenes: StoryboardScene[]) {
  if (!shot.previewAssetId || shot.previewRenderMode !== "photoreal-human") return true;
  let usage = 0;
  for (const scene of scenes) {
    for (const candidate of scene.shots) {
      if (candidate.previewAssetId === shot.previewAssetId) usage += 1;
    }
  }
  return usage > 1;
}

type PhotorealImageAsset = {
  assetId: string;
  fileName: string;
  checksumSha256: string;
  url: string;
  variantNumber: number;
};

async function loadProductionPhotorealImageAssets(pool: sql.ConnectionPool, productionId: string) {
  try {
    const result = await pool.request().input("productionId", sql.NVarChar(36), productionId).query<{
      ImageGenerationAssetId: string;
      FileName: string;
      ChecksumSha256: string;
      VariantNumber: number;
    }>(`
      SELECT
        CONVERT(nvarchar(36), a.ImageGenerationAssetId) AS ImageGenerationAssetId,
        a.FileName,
        a.ChecksumSha256,
        v.VariantNumber
      FROM cacsms.ImageGenerationVariants v
      INNER JOIN cacsms.ImageGenerationAssets a ON a.ImageGenerationAssetId = v.ImageGenerationAssetId
      WHERE CONVERT(nvarchar(36), v.ProductionId) = @productionId
        AND v.ImageGenerationAssetId IS NOT NULL
        AND a.BrowserLoadStatus = N'loaded'
      ORDER BY v.VariantNumber ASC, v.UpdatedAt DESC;
    `);
    const seen = new Set<string>();
    const assets: PhotorealImageAsset[] = [];
    for (const row of result.recordset) {
      if (!row?.ImageGenerationAssetId || seen.has(row.ImageGenerationAssetId)) continue;
      seen.add(row.ImageGenerationAssetId);
      assets.push({
        assetId: row.ImageGenerationAssetId,
        fileName: row.FileName,
        checksumSha256: row.ChecksumSha256,
        url: `/api/visuals/image-generator/assets/${row.ImageGenerationAssetId}`,
        variantNumber: row.VariantNumber
      });
    }
    return assets;
  } catch {
    return [];
  }
}

function linkImageGeneratorPreview(shot: StoryboardShot, asset: PhotorealImageAsset) {
  return {
    ...shot,
    previewAssetId: asset.assetId,
    previewUrl: asset.url,
    previewFileName: asset.fileName,
    previewChecksumSha256: asset.checksumSha256,
    previewRenderMode: "photoreal-human" as const,
    previewSource: "image-generator" as const
  };
}

async function completeStoryboardFrameGeneration(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  derived: ReturnType<typeof deriveStoryboardData>
): Promise<ReturnType<typeof deriveStoryboardData>> {
  if (!derived.snapshot.scenes.length) return derived;

  const maxLocalRenders = Math.max(
    0,
    Number.parseInt(process.env.CACSMS_STORYBOARD_FRAMES_PER_CYCLE ?? "0", 10) || 0
  );
  const maxImageGenLinks = Math.max(
    1,
    Number.parseInt(process.env.CACSMS_STORYBOARD_IMAGEGEN_LINKS_PER_CYCLE ?? "3", 10) || 3
  );
  const imageGenAssets = await loadProductionPhotorealImageAssets(pool, row.ProductionId);
  const reservedAssetIds = new Set<string>();
  for (const scene of derived.snapshot.scenes) {
    for (const shot of scene.shots) {
      if (!shot.previewAssetId || needsPhotorealPreview(shot, derived.snapshot.scenes)) continue;
      reservedAssetIds.add(shot.previewAssetId);
    }
  }

  let linked = 0;
  let rendered = 0;
  const updatedScenes: StoryboardScene[] = [];

  for (const scene of derived.snapshot.scenes) {
    const updatedShots: StoryboardShot[] = [];
    for (const shot of scene.shots) {
      if (!needsPhotorealPreview(shot, derived.snapshot.scenes)) {
        updatedShots.push(shot);
        continue;
      }

      const availableAsset = imageGenAssets.find((asset) => !reservedAssetIds.has(asset.assetId));
      if (availableAsset && linked < maxImageGenLinks) {
        reservedAssetIds.add(availableAsset.assetId);
        updatedShots.push(linkImageGeneratorPreview(shot, availableAsset));
        linked += 1;
        continue;
      }

      if (rendered >= maxLocalRenders) {
        updatedShots.push(shot);
        continue;
      }

      if (maxLocalRenders <= 0) {
        updatedShots.push(shot);
        continue;
      }

      const prompt = buildPhotorealStoryboardPrompt({
        productionTitle: row.Title,
        sceneTitle: scene.title,
        shotTitle: shot.title,
        framing: shot.framing,
        camera: shot.camera,
        visualFocus: shot.visualFocus,
        summary: shot.summary
      });

      try {
        const frameSeed = `${row.ProductionId}:${shot.id}:${scene.number}:${shot.number}`;
        const renderedFrame = await renderStoryboardPhotorealFrame(prompt, frameSeed, 1280, 720);
        const asset = await persistLocalStoryboardFrame(row.ProductionId, shot.id, prompt, renderedFrame.bytes);
        updatedShots.push({
          ...shot,
          previewAssetId: asset.assetId,
          previewUrl: asset.url,
          previewFileName: asset.fileName,
          previewChecksumSha256: asset.checksumSha256,
          previewRenderMode: "photoreal-human",
          previewSource: "local"
        });
        rendered += 1;
      } catch (error) {
        console.warn("storyboard.photoreal-frame.failed", {
          productionId: row.ProductionId,
          shotId: shot.id,
          message: error instanceof Error ? error.message : "Unknown render failure"
        });
        updatedShots.push(shot);
      }
    }
    updatedScenes.push({ ...scene, shots: updatedShots });
  }

  if (linked === 0 && rendered === 0) return derived;

  const generatedAt = new Date().toISOString();
  const frameCount = countGeneratedFrames(updatedScenes);
  const snapshot: PersistedStoryboardSnapshot = {
    ...derived.snapshot,
    generatedAt,
    scenes: updatedScenes,
    recovery: `Linked ${linked} Image Generator frame${linked === 1 ? "" : "s"} and rendered ${rendered} unique local storyboard preview${rendered === 1 ? "" : "s"} (${frameCount}/${derived.snapshot.shotCount} shots covered).`
  };
  const activeScene =
    updatedScenes.find((scene) => scene.status === "Planning") ??
    updatedScenes[Math.min(2, Math.max(0, updatedScenes.length - 1))] ??
    null;
  const activeShot = activeScene?.shots.find((shot) => shot.status === "Planning") ?? activeScene?.shots[0] ?? null;

  return {
    snapshot,
    changed: true,
    production: {
      ...derived.production,
      scenes: updatedScenes,
      activeSceneId: activeScene?.id ?? derived.production.activeSceneId ?? null,
      activeShotId: activeShot?.id ?? derived.production.activeShotId ?? null,
      updatedAt: generatedAt,
      recovery: snapshot.recovery,
      currentAction: snapshot.recovery ?? derived.production.currentAction
    }
  };
}

async function seedVisualGenerationBrief(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  metadata: Record<string, unknown>,
  derived: ReturnType<typeof deriveStoryboardData>
) {
  const activeScene =
    derived.snapshot.scenes.find((scene) => scene.id === derived.production.activeSceneId) ??
    derived.snapshot.scenes.find((scene) => scene.status === "Planning") ??
    derived.snapshot.scenes[0] ??
    null;
  const activeShot =
    activeScene?.shots.find((shot) => shot.id === derived.production.activeShotId) ??
    activeScene?.shots.find((shot) => shot.status === "Planning") ??
    activeScene?.shots[0] ??
    null;
  if (!activeScene || !activeShot) return;

  const existingBrief = asObject(asObject(metadata.visualGeneration).brief);
  if (asString(existingBrief.prompt, "").includes(activeShot.visualFocus)) return;

  const prompt = buildPhotorealStoryboardPrompt({
    productionTitle: row.Title,
    sceneTitle: activeScene.title,
    shotTitle: activeShot.title,
    framing: activeShot.framing,
    camera: activeShot.camera,
    visualFocus: activeShot.visualFocus,
    summary: activeShot.summary
  });
  const merged = {
    ...metadata,
    visualGeneration: {
      ...asObject(metadata.visualGeneration),
      brief: {
        purpose: asString(existingBrief.purpose, `Create photoreal human visual assets for ${row.Title}.`),
        scene: activeScene.title,
        subject: activeShot.visualFocus,
        composition: activeShot.framing,
        style: "Photorealistic, cinematic, realistic human subjects, corporate documentary still.",
        aspectRatio: asString(existingBrief.aspectRatio, "16:9 (1280x720)"),
        brandProfile: asString(existingBrief.brandProfile, "CACSMS Corporate 2026"),
        prompt,
        required: ["Primary subject", "Brand-safe palette", "Storyboard-aligned framing"],
        prohibited: ["Fantasy", "Cartoon style", "Unapproved logos"],
        typography: asString(existingBrief.typography, "No text except approved interface labels"),
        safeArea: asString(existingBrief.safeArea, "10% all sides"),
        originality: "Must be original and unique to this storyboard package",
        references: [`SB-${row.Code}`, activeScene.id, activeShot.id]
      }
    }
  };

  await pool
    .request()
    .input("productionId", sql.NVarChar(36), row.ProductionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .input("stage", sql.NVarChar(100), row.Stage === "storyboard" ? "visual-generation" : row.Stage)
    .query(`
      UPDATE cacsms.Productions
      SET MetadataJson = @metadata,
          Stage = CASE WHEN Stage = N'storyboard' THEN @stage ELSE Stage END,
          UpdatedAt = SYSUTCDATETIME()
      WHERE CONVERT(nvarchar(36), ProductionId) = @productionId;
    `);
}

export async function loadStoryboardFrameAsset(assetId: string) {
  const normalized = sanitizeText(assetId, 80);
  if (!/^[a-f0-9]{32}$/i.test(normalized)) {
    throw new Error("Invalid storyboard frame asset id.");
  }
  const { pool, workspaceId } = await getContext();
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .input("needle", sql.NVarChar(120), `%${normalized}%`)
    .query<ProductionRow>(`
      SELECT TOP(8)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.ProductionType,
        p.Stage,
        p.Status,
        p.Priority,
        ISNULL(p.Progress, 0) AS Progress,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND p.MetadataJson LIKE @needle
      ORDER BY p.UpdatedAt DESC;
    `);

  for (const row of result.recordset) {
    const snapshot = safeMetadataSnapshot(parseMetadata(row.MetadataJson));
    if (!snapshot) continue;
    for (const scene of snapshot.scenes) {
      for (const shot of scene.shots) {
        if (shot.previewAssetId !== normalized || !shot.previewFileName || !shot.previewChecksumSha256) continue;
        const bytes = await readLocalStoryboardFrame(row.ProductionId, shot.previewFileName, shot.previewChecksumSha256);
        return {
          bytes,
          mimeType: "image/png",
          fileName: shot.previewFileName,
          checksumSha256: shot.previewChecksumSha256
        };
      }
    }
  }

  throw new Error("Storyboard frame asset not found.");
}

export async function getStoryboardWorkspaceData(): Promise<StoryboardPayload> {
  const { pool, workspaceId } = await getContext();
  const rows = await listCandidateProductions(pool, workspaceId);
  const productions = await Promise.all(rows.map((row) => materializeProduction(pool, row, false)));
  const averageQuality =
    productions.length > 0
      ? Math.round(
          productions.reduce((total, production) => total + overallQuality(production.quality), 0) / productions.length
        )
      : 0;
  return {
    generatedAt: new Date().toISOString(),
    productions,
    summary: {
      total: productions.length,
      active: productions.filter((production) =>
        ["Planning Shots", "Continuity Review", "Auto Revising", "Routed to Visual Studio", "Sequencing"].includes(production.state)
      ).length,
      ready: productions.filter((production) => production.routing.approved).length,
      blocked: productions.filter((production) => production.issues.some((issue) => issue.severity === "critical" && !issue.resolved)).length,
      averageQuality
    },
    engine: "autonomous-storyboard-orchestrator-v1",
    humanInputRequired: false
  };
}

export async function syncStoryboardProduction(productionId: string) {
  const { pool, workspaceId } = await getContext();
  const row = await loadProductionRow(pool, workspaceId, productionId);
  if (!row) throw new Error("Production not found.");
  return materializeProduction(pool, row, true);
}

export async function runStoryboardScheduler(): Promise<{
  ok: true;
  generatedAt: string;
  processed: Array<{ code: string; productionId: string; frameWorkPriority: number }>;
}> {
  const { pool, workspaceId } = await getContext();
  const rows = prioritizeStoryboardSchedulerRows(await listCandidateProductions(pool, workspaceId));
  const batch = rows.slice(0, 1);
  await dispatchAssetEngineBatch(
    "storyboard",
    batch.map((row) => ({ id: row.ProductionId, title: row.Title, stage: row.Stage }))
  );
  const processed: Array<{ code: string; productionId: string; frameWorkPriority: number }> = [];
  for (const row of batch) {
    await materializeProduction(pool, row, true);
    processed.push({
      code: row.Code,
      productionId: row.ProductionId,
      frameWorkPriority: scoreProductionFrameWorkPriority(row)
    });
  }
  return { ok: true, generatedAt: new Date().toISOString(), processed };
}
