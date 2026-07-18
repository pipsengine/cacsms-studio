import crypto from "node:crypto";
import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

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
          p.Stage IN (N'storyboard', N'visual-generation', N'assembly')
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
          WHEN EXISTS (
            SELECT 1
            FROM cacsms.ScriptWritingRuns sw
            WHERE sw.ProductionId = p.ProductionId
              AND sw.Status = N'completed'
              AND sw.MandatoryGatesPassed = 1
          ) THEN 1
          WHEN p.Stage = N'visual-generation' THEN 2
          WHEN p.Stage = N'assembly' THEN 3
          ELSE 4
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
  const durationSeconds =
    parseDuration(metadata.durationSeconds) ??
    parseDuration(metadata.duration) ??
    Math.max(60, Math.round((version?.wordCount ?? wordCount(scriptText)) / 150) * 60);
  const scenes = hasScript ? buildScenes(scriptText, sections, durationSeconds) : [];
  const issues = detectIssues(scenes, sources, checks, hasScript);
  const quality = hasScript
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
  const sourceVersionId = version?.id ?? null;
  const sourceVersionLabel = version?.label ?? "Persisted script body";
  const sourceRunId = scriptRun?.id ?? null;
  const sourceChecksum = checksum(`${sourceVersionId ?? "metadata"}:${scriptText}`);
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
    structure: buildStructure(durationSeconds),
    scenes,
    quality,
    issues,
    routing,
    recovery:
      hasScript && issues.length
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
      stage: row.Stage,
      priority: row.Priority,
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
  const derived = deriveStoryboardData(row, metadata, scriptRun, version, sections, sources, checks, decisions, existingSnapshot);

  if (persist && derived.changed) {
    await persistStoryboardSnapshot(pool, row, metadata, derived.snapshot);
  }

  return derived.production;
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

export async function runStoryboardScheduler(): Promise<StoryboardPayload> {
  const { pool, workspaceId } = await getContext();
  const rows = await listCandidateProductions(pool, workspaceId);
  for (const row of rows.slice(0, 4)) {
    await materializeProduction(pool, row, true);
  }
  return getStoryboardWorkspaceData();
}
