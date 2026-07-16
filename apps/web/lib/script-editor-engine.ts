import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

const WRITING_STATES = [
  "waiting",
  "researching",
  "queued",
  "generating",
  "reviewing",
  "revising",
  "blocked",
  "retrying",
  "failed",
  "completed"
] as const;

const CHECK_TYPES = ["factual", "editorial", "brand", "safety", "compliance"] as const;
const ACTIVE_STATES = new Set<typeof WRITING_STATES[number]>([
  "waiting",
  "researching",
  "queued",
  "generating",
  "reviewing",
  "revising",
  "retrying"
]);
const PRODUCTION_STAGES = [
  "research",
  "scripting",
  "storyboard",
  "visual-generation",
  "audio-generation",
  "assembly",
  "quality-assurance",
  "publishing",
  "completed"
] as const;
const RESEARCH_MODEL = "CACSMS Knowledge Universe SQL Retriever v2";
const SAFETY_BLOCKLIST = /\b(hate crime|terrorist manifesto|fraud instructions|self-harm method)\b/i;

const SECTION_BLUEPRINT = [
  { key: "opening", title: "Opening" },
  { key: "context", title: "Context and evidence" },
  { key: "narrative", title: "Core narrative" },
  { key: "close", title: "Close and call to action" }
] as const;

type WritingState = (typeof WRITING_STATES)[number];
type CheckType = (typeof CHECK_TYPES)[number];

type SettingsRow = {
  WorkspaceId: string;
  Enabled: boolean;
  RunIntervalSeconds: number;
  QualityThreshold: number;
  MinimumBriefLength: number;
  MinimumResearchSources: number;
  MinimumWordCount: number;
  MaxRevisionAttempts: number;
  WriterModel: string;
  ReviewerModel: string;
  NextRunAt: Date | null;
};

type ProductionRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  stage: string;
  status: string;
  progress: number;
  priority: string;
  updatedAt: string;
  metadataJson: string | null;
  sourceRecordId: string | null;
  sourceTitle: string | null;
  sourceDescription: string | null;
};

type RunRow = {
  id: string;
  jobId: string;
  status: WritingState;
  triggerSource: string;
  currentAction: string;
  currentAgentName: string | null;
  currentAgentRole: string | null;
  modelName: string | null;
  retryCount: number;
  wordCount: number;
  qualityScore: number;
  briefValid: boolean;
  researchSourceCount: number;
  versionCount: number;
  mandatoryGatesPassed: boolean;
  blockerCode: string | null;
  blockerMessage: string | null;
  nextAction: string | null;
  errorMessage: string | null;
  startedAt: string;
  lastHeartbeatAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SectionRow = {
  id: string;
  key: string;
  title: string;
  sequenceNo: number;
  status: string;
  wordCount: number;
  citationCount: number;
  content: string | null;
  completedAt: string | null;
};

type SourceRow = {
  id: string;
  sectionId: string | null;
  knowledgeRecordId: string | null;
  citation: string;
  sourceTitle: string;
  sourceStatus: string;
  confidence: number;
  evidenceText: string;
  createdAt: string;
};

type VersionRow = {
  id: string;
  attemptNumber: number;
  label: string;
  content: string;
  wordCount: number;
  qualityScore: number;
  createdAt: string;
};

type CheckRow = {
  id: number;
  attemptNumber: number;
  checkType: CheckType;
  status: "passed" | "failed" | "warning";
  score: number;
  notes: string | null;
  createdAt: string;
};

type DecisionRow = {
  id: number;
  step: string;
  action: string;
  outcome: string;
  reason: string | null;
  dataJson: string | null;
  createdAt: string;
};

type AuditRow = {
  id: number;
  eventType: string;
  entityType: string | null;
  payloadJson: string | null;
  createdAt: string;
};

type KnowledgeCandidate = {
  id: string;
  title: string;
  summary: string;
  source: string;
  confidence: number;
  qualityScore: number;
  status: string;
};

export interface ScriptSectionView {
  id: string;
  key: string;
  title: string;
  status: string;
  wordCount: number;
  citationCount: number;
  content: string;
  completedAt: string | null;
}

export interface ScriptSourceView {
  id: string;
  sectionId: string | null;
  citation: string;
  title: string;
  status: string;
  confidence: number;
  evidence: string;
  createdAt: string;
}

export interface ScriptVersionView {
  id: string;
  attemptNumber: number;
  label: string;
  wordCount: number;
  qualityScore: number;
  createdAt: string;
}

export interface ScriptCheckView {
  id: number;
  attemptNumber: number;
  type: CheckType;
  status: "passed" | "failed" | "warning";
  score: number;
  notes: string;
  createdAt: string;
}

export interface ScriptDecisionView {
  id: number;
  step: string;
  action: string;
  outcome: string;
  reason: string;
  createdAt: string;
}

export interface ScriptAuditView {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
}

export interface ScriptEditorProduction {
  id: string;
  code: string;
  title: string;
  type: string;
  stage: string;
  status: string;
  priority: string;
  updatedAt: string;
  brief: string;
  scriptTitle: string;
  body: string;
  progress: number;
  wordCount: number;
  estimatedMinutes: number;
  qualityScore: number;
  assistantState: WritingState;
  sections: ScriptSectionView[];
  sources: ScriptSourceView[];
  versions: ScriptVersionView[];
  checks: ScriptCheckView[];
  decisions: ScriptDecisionView[];
  audit: ScriptAuditView[];
  execution: {
    state: WritingState;
    currentAction: string;
    currentAgent: string | null;
    currentRole: string | null;
    model: string | null;
    jobId: string | null;
    startedAt: string | null;
    elapsedSeconds: number | null;
    retries: number;
    blocker: { code: string; message: string } | null;
    nextAction: string | null;
  };
  gates: {
    brief: boolean;
    research: boolean;
    sections: boolean;
    versions: boolean;
    quality: boolean;
    mandatory: boolean;
    preview: boolean;
    completion: boolean;
    threshold: number;
  };
}

export interface ScriptEditorPayload {
  productions: ScriptEditorProduction[];
  generatedAt: string;
  engine: string;
  humanInputRequired: false;
}

function parseJson(value: string | null): Record<string, unknown> {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function sanitizeText(value: unknown, max = 50000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(clamp(value) * 10) / 10;
}

function wordCount(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function stageProgress(stage: string) {
  const index = PRODUCTION_STAGES.indexOf(stage as (typeof PRODUCTION_STAGES)[number]);
  if (index === -1) return 0;
  return Math.round(((index + 1) / PRODUCTION_STAGES.length) * 100);
}

function executionProgress(
  gates: ScriptEditorProduction["gates"],
  state: WritingState,
  retries: number
) {
  const base =
    (gates.brief ? 15 : 0) +
    (gates.research ? 20 : 0) +
    (gates.sections ? 25 : 0) +
    (gates.versions ? 15 : 0) +
    (gates.quality ? 25 : 0);

  if (gates.mandatory) return 100;
  if (state === "queued") return Math.max(base, 32);
  if (state === "generating") return Math.max(base, 48);
  if (state === "reviewing") return Math.max(base, 68);
  if (state === "revising") return Math.max(base, Math.min(92, 72 + retries * 4));
  if (state === "retrying") return Math.max(base, 55);
  return base;
}

function listFromJson<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function titleFromMetadata(row: ProductionRow, metadata: Record<string, unknown>) {
  return sanitizeText(metadata.scriptTitle ?? row.title, 300) || row.title;
}

function briefFromMetadata(row: ProductionRow, metadata: Record<string, unknown>) {
  return (
    sanitizeText(metadata.creativeBrief, 2000) ||
    sanitizeText(metadata.description, 2000) ||
    sanitizeText(row.sourceDescription, 2000)
  );
}

async function getContext() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<SettingsRow>(
    `SELECT TOP(1) s.*
     FROM cacsms.ScriptWritingSettings s
     JOIN cacsms.Workspaces w ON w.WorkspaceId=s.WorkspaceId
     WHERE w.Status=N'active'
     ORDER BY w.CreatedAt`
  );
  const settings = result.recordset[0];
  if (!settings) throw new Error("Autonomous script writing is not configured. Run migration 031 and retry.");
  return { pool, settings };
}

async function loadProductions(pool: sql.ConnectionPool, workspace: string) {
  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspace).query<ProductionRow>(
    `SELECT TOP(40)
        CONVERT(nvarchar(36),p.ProductionId) id,
        p.Code code,
        p.Title title,
        p.ProductionType type,
        p.Stage stage,
        p.Status status,
        p.Progress progress,
        p.Priority priority,
        CONVERT(nvarchar(40),p.UpdatedAt,127) updatedAt,
        p.MetadataJson metadataJson,
        CONVERT(nvarchar(36),p.AutonomousSourceRecordId) sourceRecordId,
        source.Title sourceTitle,
        source.Description sourceDescription
      FROM cacsms.Productions p
      LEFT JOIN cacsms.OpportunityOperationalRecords source ON source.RecordId=p.AutonomousSourceRecordId
      WHERE p.WorkspaceId=@workspace
        AND p.Status NOT IN (N'archived', N'cancelled')
      ORDER BY
        CASE
          WHEN p.Stage IN (N'research', N'scripting') THEN 0
          WHEN p.Stage=N'storyboard' THEN 1
          ELSE 2
        END,
        p.UpdatedAt DESC`
  );
  return result.recordset;
}

async function loadProductionRow(pool: sql.ConnectionPool, workspace: string, productionId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.UniqueIdentifier, workspace)
    .input("id", sql.UniqueIdentifier, productionId)
    .query<ProductionRow>(
      `SELECT TOP(1)
          CONVERT(nvarchar(36),p.ProductionId) id,
          p.Code code,
          p.Title title,
          p.ProductionType type,
          p.Stage stage,
          p.Status status,
          p.Progress progress,
          p.Priority priority,
          CONVERT(nvarchar(40),p.UpdatedAt,127) updatedAt,
          p.MetadataJson metadataJson,
          CONVERT(nvarchar(36),p.AutonomousSourceRecordId) sourceRecordId,
          source.Title sourceTitle,
          source.Description sourceDescription
        FROM cacsms.Productions p
        LEFT JOIN cacsms.OpportunityOperationalRecords source ON source.RecordId=p.AutonomousSourceRecordId
        WHERE p.WorkspaceId=@workspace AND p.ProductionId=@id`
    );
  return result.recordset[0] ?? null;
}

async function loadLatestRun(pool: sql.ConnectionPool, productionId: string) {
  const result = await pool.request().input("production", sql.UniqueIdentifier, productionId).query<RunRow>(
    `SELECT TOP(1)
        CONVERT(nvarchar(36),ScriptWritingRunId) id,
        CONVERT(nvarchar(36),JobId) jobId,
        Status status,
        TriggerSource triggerSource,
        CurrentAction currentAction,
        CurrentAgentName currentAgentName,
        CurrentAgentRole currentAgentRole,
        ModelName modelName,
        RetryCount retryCount,
        WordCount wordCount,
        CONVERT(float,QualityScore) qualityScore,
        BriefValid briefValid,
        ResearchSourceCount researchSourceCount,
        VersionCount versionCount,
        MandatoryGatesPassed mandatoryGatesPassed,
        BlockerCode blockerCode,
        BlockerMessage blockerMessage,
        NextAction nextAction,
        ErrorMessage errorMessage,
        CONVERT(nvarchar(40),StartedAt,127) startedAt,
        CONVERT(nvarchar(40),LastHeartbeatAt,127) lastHeartbeatAt,
        CONVERT(nvarchar(40),CompletedAt,127) completedAt,
        CONVERT(nvarchar(40),CreatedAt,127) createdAt,
        CONVERT(nvarchar(40),UpdatedAt,127) updatedAt
      FROM cacsms.ScriptWritingRuns
      WHERE ProductionId=@production
      ORDER BY CreatedAt DESC`
  );
  return result.recordset[0] ?? null;
}

async function loadSections(pool: sql.ConnectionPool, runId: string) {
  const result = await pool.request().input("run", sql.UniqueIdentifier, runId).query<SectionRow>(
    `SELECT
        CONVERT(nvarchar(36),ProductionScriptSectionId) id,
        SectionKey [key],
        Title title,
        SequenceNo sequenceNo,
        Status status,
        WordCount wordCount,
        CitationCount citationCount,
        Content content,
        CONVERT(nvarchar(40),CompletedAt,127) completedAt
      FROM cacsms.ProductionScriptSections
      WHERE ScriptWritingRunId=@run
      ORDER BY SequenceNo`
  );
  return result.recordset;
}

async function loadSources(pool: sql.ConnectionPool, runId: string) {
  const result = await pool.request().input("run", sql.UniqueIdentifier, runId).query<SourceRow>(
    `SELECT
        CONVERT(nvarchar(36),ProductionScriptEvidenceId) id,
        CONVERT(nvarchar(36),ProductionScriptSectionId) sectionId,
        CONVERT(nvarchar(36),KnowledgeRecordId) knowledgeRecordId,
        Citation citation,
        SourceTitle sourceTitle,
        SourceStatus sourceStatus,
        CONVERT(float,Confidence) confidence,
        EvidenceText evidenceText,
        CONVERT(nvarchar(40),CreatedAt,127) createdAt
      FROM cacsms.ProductionScriptEvidence
      WHERE ScriptWritingRunId=@run
      ORDER BY CreatedAt`
  );
  return result.recordset;
}

async function loadVersions(pool: sql.ConnectionPool, runId: string) {
  const result = await pool.request().input("run", sql.UniqueIdentifier, runId).query<VersionRow>(
    `SELECT
        CONVERT(nvarchar(36),ProductionScriptVersionId) id,
        AttemptNumber attemptNumber,
        Label label,
        Content content,
        WordCount wordCount,
        CONVERT(float,QualityScore) qualityScore,
        CONVERT(nvarchar(40),CreatedAt,127) createdAt
      FROM cacsms.ProductionScriptVersions
      WHERE ScriptWritingRunId=@run
      ORDER BY CreatedAt DESC`
  );
  return result.recordset;
}

async function loadChecks(pool: sql.ConnectionPool, runId: string) {
  const result = await pool.request().input("run", sql.UniqueIdentifier, runId).query<CheckRow>(
    `SELECT
        ProductionScriptCheckId id,
        AttemptNumber attemptNumber,
        CheckType checkType,
        Status status,
        CONVERT(float,Score) score,
        Notes notes,
        CONVERT(nvarchar(40),CreatedAt,127) createdAt
      FROM cacsms.ProductionScriptChecks
      WHERE ScriptWritingRunId=@run
      ORDER BY CreatedAt DESC, ProductionScriptCheckId DESC`
  );
  return result.recordset;
}

async function loadDecisions(pool: sql.ConnectionPool, runId: string) {
  const result = await pool.request().input("run", sql.UniqueIdentifier, runId).query<DecisionRow>(
    `SELECT TOP(24)
        ProductionScriptDecisionId id,
        Step step,
        Action action,
        Outcome outcome,
        Reason reason,
        DataJson dataJson,
        CONVERT(nvarchar(40),CreatedAt,127) createdAt
      FROM cacsms.ProductionScriptDecisions
      WHERE ScriptWritingRunId=@run
      ORDER BY CreatedAt DESC, ProductionScriptDecisionId DESC`
  );
  return result.recordset;
}

async function loadAudit(pool: sql.ConnectionPool, productionId: string) {
  const result = await pool.request().input("production", sql.NVarChar(100), productionId).query<AuditRow>(
    `SELECT TOP(12)
        AuditEventId id,
        EventType eventType,
        EntityType entityType,
        PayloadJson payloadJson,
        CONVERT(nvarchar(40),CreatedAt,127) createdAt
      FROM cacsms.AuditEvents
      WHERE EntityId=@production
      ORDER BY CreatedAt DESC, AuditEventId DESC`
  );
  return result.recordset;
}

function deriveFallbackState(args: {
  briefValid: boolean;
  sources: number;
  sectionsReady: boolean;
  versionsReady: boolean;
  qualityReady: boolean;
  mandatory: boolean;
}): WritingState {
  if (args.mandatory) return "completed";
  if (!args.briefValid) return "waiting";
  if (args.sources === 0) return "researching";
  if (!args.sectionsReady) return "queued";
  if (!args.versionsReady) return "generating";
  if (!args.qualityReady) return "reviewing";
  return "blocked";
}

function mapAuditEvent(row: AuditRow): ScriptAuditView {
  const payload = parseJson(row.payloadJson);
  const detail =
    sanitizeText(payload.message, 400) ||
    sanitizeText(payload.reason, 400) ||
    sanitizeText(payload.status, 400) ||
    "Persisted workflow activity.";

  return {
    id: String(row.id),
    label: row.eventType.replace(/^writing\./, "").replace(/\./g, " "),
    detail,
    createdAt: row.createdAt
  };
}

async function buildSnapshot(pool: sql.ConnectionPool, settings: SettingsRow, row: ProductionRow): Promise<ScriptEditorProduction> {
  const metadata = parseJson(row.metadataJson);
  const latestRun = await loadLatestRun(pool, row.id);
  const sections = latestRun ? await loadSections(pool, latestRun.id) : [];
  const sources = latestRun ? await loadSources(pool, latestRun.id) : [];
  const versions = latestRun ? await loadVersions(pool, latestRun.id) : [];
  const checks = latestRun ? await loadChecks(pool, latestRun.id) : [];
  const decisions = latestRun ? await loadDecisions(pool, latestRun.id) : [];
  const audit = await loadAudit(pool, row.id);
  const body = versions[0]?.content ?? sections.map((section) => sanitizeText(section.content)).filter(Boolean).join("\n\n");
  const scriptTitle = titleFromMetadata(row, metadata);
  const brief = briefFromMetadata(row, metadata);
  const requiredSectionKeys = new Set(SECTION_BLUEPRINT.map((section) => section.key));
  const sectionKeySet = new Set(sections.map((section) => section.key));
  const allChecks = new Map<CheckType, CheckRow>();

  for (const check of checks) {
    if (!allChecks.has(check.checkType)) allChecks.set(check.checkType, check);
  }

  const sectionReady =
    requiredSectionKeys.size > 0 &&
    [...requiredSectionKeys].every((key) => sectionKeySet.has(key)) &&
    sections.length >= requiredSectionKeys.size &&
    sections.every((section) => section.wordCount > 0 && /completed|reviewing|revising/i.test(section.status));
  const versionReady = versions.length > 0 && versions[0].wordCount >= settings.MinimumWordCount;
  const averageQuality = allChecks.size
    ? round([...allChecks.values()].reduce((total, check) => total + Number(check.score), 0) / allChecks.size)
    : 0;
  const qualityReady =
    CHECK_TYPES.every((type) => allChecks.has(type)) &&
    [...allChecks.values()].every((check) => check.status !== "failed") &&
    averageQuality >= settings.QualityThreshold;
  const briefValid = brief.length >= settings.MinimumBriefLength;
  const researchReady = sources.length >= settings.MinimumResearchSources;
  const mandatory = briefValid && researchReady && sectionReady && versionReady && qualityReady;
  const executionState = latestRun?.status ?? deriveFallbackState({
    briefValid,
    sources: sources.length,
    sectionsReady: sectionReady,
    versionsReady: versionReady,
    qualityReady,
    mandatory
  });
  const progress = executionProgress(
    {
      brief: briefValid,
      research: researchReady,
      sections: sectionReady,
      versions: versionReady,
      quality: qualityReady,
      mandatory,
      preview: mandatory && body.length > 0,
      completion: executionState === "completed" && mandatory,
      threshold: Number(settings.QualityThreshold)
    },
    executionState,
    latestRun?.retryCount ?? 0
  );
  const startedAt = latestRun?.startedAt ?? null;
  const elapsedSeconds = startedAt ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : null;

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    type: row.type,
    stage: row.stage,
    status: row.status,
    priority: row.priority,
    updatedAt: row.updatedAt,
    brief,
    scriptTitle,
    body,
    progress,
    wordCount: wordCount(body),
    estimatedMinutes: Math.max(1, Math.round(Math.max(1, wordCount(body)) / 150)),
    qualityScore: latestRun ? Number(latestRun.qualityScore) : averageQuality,
    assistantState: executionState,
    sections: sections.map((section) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      status: section.status,
      wordCount: Number(section.wordCount),
      citationCount: Number(section.citationCount),
      content: sanitizeText(section.content),
      completedAt: section.completedAt
    })),
    sources: sources.map((source) => ({
      id: source.id,
      sectionId: source.sectionId,
      citation: source.citation,
      title: source.sourceTitle,
      status: source.sourceStatus,
      confidence: Number(source.confidence),
      evidence: sanitizeText(source.evidenceText, 2000),
      createdAt: source.createdAt
    })),
    versions: versions.map((version) => ({
      id: version.id,
      attemptNumber: Number(version.attemptNumber),
      label: version.label,
      wordCount: Number(version.wordCount),
      qualityScore: Number(version.qualityScore),
      createdAt: version.createdAt
    })),
    checks: [...allChecks.values()].map((check) => ({
      id: check.id,
      attemptNumber: Number(check.attemptNumber),
      type: check.checkType,
      status: check.status,
      score: Number(check.score),
      notes: sanitizeText(check.notes, 1000),
      createdAt: check.createdAt
    })),
    decisions: decisions.map((decision) => ({
      id: decision.id,
      step: decision.step,
      action: decision.action,
      outcome: decision.outcome,
      reason: sanitizeText(decision.reason, 1000),
      createdAt: decision.createdAt
    })),
    audit: audit.map(mapAuditEvent),
    execution: {
      state: executionState,
      currentAction:
        latestRun?.currentAction ??
        (mandatory ? "Writing gates passed and the production is ready for the next pipeline stage." : "Waiting for the autonomous writing engine."),
      currentAgent: latestRun?.currentAgentName ?? null,
      currentRole: latestRun?.currentAgentRole ?? null,
      model: latestRun?.modelName ?? null,
      jobId: latestRun?.jobId ?? null,
      startedAt,
      elapsedSeconds,
      retries: latestRun?.retryCount ?? 0,
      blocker:
        latestRun?.blockerCode || latestRun?.blockerMessage
          ? {
              code: latestRun?.blockerCode ?? "unknown",
              message: latestRun?.blockerMessage ?? "The writing engine is waiting for a recoverable dependency."
            }
          : null,
      nextAction: latestRun?.nextAction ?? null
    },
    gates: {
      brief: briefValid,
      research: researchReady,
      sections: sectionReady,
      versions: versionReady,
      quality: qualityReady,
      mandatory,
      preview: mandatory && body.length > 0,
      completion: executionState === "completed" && mandatory,
      threshold: Number(settings.QualityThreshold)
    }
  };
}

function extractKeywords(value: string) {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4))].slice(0, 18);
}

async function persistDecision(
  pool: sql.ConnectionPool,
  runId: string,
  productionId: string,
  step: string,
  action: string,
  outcome: string,
  reason: string,
  data?: Record<string, unknown>
) {
  await pool
    .request()
    .input("run", sql.UniqueIdentifier, runId)
    .input("production", sql.UniqueIdentifier, productionId)
    .input("step", sql.NVarChar(80), step)
    .input("action", sql.NVarChar(120), action)
    .input("outcome", sql.NVarChar(80), outcome)
    .input("reason", sql.NVarChar(1000), reason.slice(0, 1000))
    .input("data", sql.NVarChar(sql.MAX), data ? JSON.stringify(data) : null)
    .query(
      `INSERT cacsms.ProductionScriptDecisions(ScriptWritingRunId,ProductionId,Step,Action,Outcome,Reason,DataJson)
       VALUES(@run,@production,@step,@action,@outcome,@reason,@data)`
    );
}

async function persistAudit(
  pool: sql.ConnectionPool,
  workspaceId: string,
  productionId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  await pool
    .request()
    .input("workspace", sql.UniqueIdentifier, workspaceId)
    .input("eventType", sql.NVarChar(150), eventType)
    .input("entityId", sql.NVarChar(100), productionId)
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(payload))
    .query(
      `INSERT cacsms.AuditEvents(WorkspaceId,EventType,EntityType,EntityId,PayloadJson)
       VALUES(@workspace,@eventType,N'production',@entityId,@payload)`
    );
}

async function upsertAgentRun(
  pool: sql.ConnectionPool,
  productionId: string,
  name: string,
  role: string,
  task: string,
  status: "queued" | "running" | "completed" | "failed",
  errorMessage?: string
) {
  await pool
    .request()
    .input("production", sql.UniqueIdentifier, productionId)
    .input("name", sql.NVarChar(200), name)
    .input("role", sql.NVarChar(100), role)
    .input("task", sql.NVarChar(300), task)
    .input("status", sql.NVarChar(30), status)
    .input("error", sql.NVarChar(2000), errorMessage ?? null)
    .query(
      `DECLARE @existing uniqueidentifier = (
          SELECT TOP(1) AgentRunId
          FROM cacsms.AgentRuns
          WHERE ProductionId=@production AND AgentRole=@role
          ORDER BY UpdatedAt DESC
       );
       IF @existing IS NULL
         INSERT cacsms.AgentRuns(ProductionId,AgentName,AgentRole,TaskName,Status,QueueName,StartedAt,LastHeartbeatAt,ErrorMessage)
         VALUES(
           @production,@name,@role,@task,@status,N'autonomous-script-writing',
           CASE WHEN @status IN (N'running',N'completed',N'failed') THEN SYSUTCDATETIME() ELSE NULL END,
           CASE WHEN @status IN (N'running',N'completed',N'failed') THEN SYSUTCDATETIME() ELSE NULL END,
           @error
         );
       ELSE
         UPDATE cacsms.AgentRuns
         SET AgentName=@name,
             TaskName=@task,
             Status=@status,
             ErrorMessage=@error,
             StartedAt=CASE WHEN @status IN (N'running',N'completed',N'failed') THEN COALESCE(StartedAt,SYSUTCDATETIME()) ELSE StartedAt END,
             CompletedAt=CASE WHEN @status IN (N'completed',N'failed') THEN SYSUTCDATETIME() ELSE NULL END,
             LastHeartbeatAt=CASE WHEN @status IN (N'running',N'completed',N'failed') THEN SYSUTCDATETIME() ELSE LastHeartbeatAt END,
             UpdatedAt=SYSUTCDATETIME()
         WHERE AgentRunId=@existing;`
    );
}

async function createRun(pool: sql.ConnectionPool, workspaceId: string, productionId: string, triggerSource: string, initialState: WritingState) {
  const result = await pool
    .request()
    .input("workspace", sql.UniqueIdentifier, workspaceId)
    .input("production", sql.UniqueIdentifier, productionId)
    .input("trigger", sql.NVarChar(40), triggerSource.slice(0, 40))
    .input("status", sql.NVarChar(30), initialState)
    .query<{ id: string }>(
      `INSERT cacsms.ScriptWritingRuns(
          WorkspaceId,ProductionId,TriggerSource,Status,CurrentAction,NextAction
       )
       OUTPUT CONVERT(nvarchar(36),inserted.ScriptWritingRunId) id
       VALUES(
          @workspace,@production,@trigger,@status,
          N'Validate required inputs before autonomous writing begins.',
          N'Validate required inputs'
       )`
    );
  return result.recordset[0].id;
}

async function updateRun(
  pool: sql.ConnectionPool,
  runId: string,
  patch: Partial<{
    status: WritingState;
    currentAction: string;
    currentAgentName: string | null;
    currentAgentRole: string | null;
    modelName: string | null;
    retryCount: number;
    wordCount: number;
    qualityScore: number;
    briefValid: boolean;
    researchSourceCount: number;
    versionCount: number;
    mandatoryGatesPassed: boolean;
    blockerCode: string | null;
    blockerMessage: string | null;
    nextAction: string | null;
    errorMessage: string | null;
    completedAtNow: boolean;
  }>
) {
  await pool
    .request()
    .input("run", sql.UniqueIdentifier, runId)
    .input("status", sql.NVarChar(30), patch.status ?? null)
    .input("action", sql.NVarChar(200), patch.currentAction ?? null)
    .input("agentName", sql.NVarChar(200), patch.currentAgentName ?? null)
    .input("agentRole", sql.NVarChar(100), patch.currentAgentRole ?? null)
    .input("model", sql.NVarChar(120), patch.modelName ?? null)
    .input("retryCount", sql.Int, patch.retryCount ?? null)
    .input("wordCount", sql.Int, patch.wordCount ?? null)
    .input("qualityScore", sql.Decimal(5, 2), patch.qualityScore ?? null)
    .input("briefValid", sql.Bit, patch.briefValid ?? null)
    .input("researchCount", sql.Int, patch.researchSourceCount ?? null)
    .input("versionCount", sql.Int, patch.versionCount ?? null)
    .input("gates", sql.Bit, patch.mandatoryGatesPassed ?? null)
    .input("blockerCode", sql.NVarChar(80), patch.blockerCode ?? null)
    .input("blockerMessage", sql.NVarChar(1000), patch.blockerMessage ?? null)
    .input("nextAction", sql.NVarChar(200), patch.nextAction ?? null)
    .input("error", sql.NVarChar(1000), patch.errorMessage ?? null)
    .input("complete", sql.Bit, patch.completedAtNow ? 1 : 0)
    .query(
      `UPDATE cacsms.ScriptWritingRuns
       SET Status=COALESCE(@status,Status),
           CurrentAction=COALESCE(@action,CurrentAction),
           CurrentAgentName=@agentName,
           CurrentAgentRole=@agentRole,
           ModelName=@model,
           RetryCount=COALESCE(@retryCount,RetryCount),
           WordCount=COALESCE(@wordCount,WordCount),
           QualityScore=COALESCE(@qualityScore,QualityScore),
           BriefValid=COALESCE(@briefValid,BriefValid),
           ResearchSourceCount=COALESCE(@researchCount,ResearchSourceCount),
           VersionCount=COALESCE(@versionCount,VersionCount),
           MandatoryGatesPassed=COALESCE(@gates,MandatoryGatesPassed),
           BlockerCode=@blockerCode,
           BlockerMessage=@blockerMessage,
           NextAction=@nextAction,
           ErrorMessage=@error,
           LastHeartbeatAt=SYSUTCDATETIME(),
           CompletedAt=CASE WHEN @complete=1 THEN SYSUTCDATETIME() ELSE NULL END,
           UpdatedAt=SYSUTCDATETIME()
       WHERE ScriptWritingRunId=@run`
    );
}

async function updateProductionMetadata(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  patch: {
    brief: string;
    scriptTitle: string;
    body: string;
    sections: ScriptSectionView[];
    sources: ScriptSourceView[];
    versions: ScriptVersionView[];
    checks: ScriptCheckView[];
    qualityScore: number;
    state: WritingState;
  }
) {
  const metadata = parseJson(row.metadataJson);
  const nextMetadata = {
    ...metadata,
    creativeBrief: patch.brief,
    scriptTitle: patch.scriptTitle,
    scriptBody: patch.body,
    scriptSections: patch.sections.map((section) => ({
      title: section.title,
      key: section.key,
      status: section.status,
      wordCount: section.wordCount,
      citationCount: section.citationCount
    })),
    researchSources: patch.sources.map((source) => ({
      title: source.title,
      citation: source.citation,
      status: source.status,
      confidence: source.confidence
    })),
    scriptVersions: patch.versions.slice(0, 12).map((version) => ({
      label: version.label,
      wordCount: version.wordCount,
      qualityScore: version.qualityScore,
      createdAt: version.createdAt
    })),
    scriptCompliance: patch.checks.map((check) => ({
      name: check.type,
      status: check.status,
      score: check.score,
      notes: check.notes
    })),
    scriptQualityScore: patch.qualityScore,
    scriptAutosaveAt: new Date().toISOString(),
    assistantState: patch.state,
    humanInputRequired: false
  };

  await pool
    .request()
    .input("id", sql.UniqueIdentifier, row.id)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(nextMetadata))
    .query(`UPDATE cacsms.Productions SET MetadataJson=@metadata,UpdatedAt=SYSUTCDATETIME() WHERE ProductionId=@id`);
}

async function reconcileProductionState(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  nextStage: string,
  nextStatus: string,
  nextProgress: number,
  message: string
) {
  if (row.stage === nextStage && row.status === nextStatus && Number(row.progress) === nextProgress) return;

  await pool
    .request()
    .input("production", sql.UniqueIdentifier, row.id)
    .input("stage", sql.NVarChar(100), nextStage)
    .input("status", sql.NVarChar(30), nextStatus)
    .input("progress", sql.TinyInt, nextProgress)
    .input("message", sql.NVarChar(1000), message.slice(0, 1000))
    .query(
      `UPDATE cacsms.Productions
       SET Stage=@stage,
           Status=@status,
           Progress=@progress,
           CompletedAt=CASE WHEN @stage=N'completed' THEN SYSUTCDATETIME() ELSE NULL END,
           PublishedAt=CASE WHEN @stage=N'completed' THEN SYSUTCDATETIME() ELSE PublishedAt END,
           UpdatedAt=SYSUTCDATETIME()
       WHERE ProductionId=@production;
       UPDATE cacsms.ProductionStageHistory
       SET ExitedAt=SYSUTCDATETIME()
       WHERE ProductionId=@production AND ExitedAt IS NULL;
       INSERT cacsms.ProductionStageHistory(ProductionId,Stage,Status,Progress,Message)
       VALUES(@production,@stage,@status,@progress,@message);`
    );
}

async function ensureBrief(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  settings: SettingsRow
) {
  const metadata = parseJson(row.metadataJson);
  let brief = briefFromMetadata(row, metadata);
  if (!brief && row.sourceDescription) {
    brief = sanitizeText(row.sourceDescription, 2000);
  }
  if (brief.length >= settings.MinimumBriefLength) {
    await updateProductionMetadata(pool, row, {
      brief,
      scriptTitle: titleFromMetadata(row, metadata),
      body: sanitizeText(metadata.scriptBody),
      sections: listFromJson<ScriptSectionView>(metadata.scriptSections),
      sources: listFromJson<ScriptSourceView>(metadata.researchSources),
      versions: listFromJson<ScriptVersionView>(metadata.scriptVersions),
      checks: listFromJson<ScriptCheckView>(metadata.scriptCompliance),
      qualityScore: Number(metadata.scriptQualityScore ?? 0),
      state: "waiting"
    });
  }
  return brief;
}

function scoreCandidate(candidate: KnowledgeCandidate, tokens: string[]) {
  const haystack = `${candidate.title} ${candidate.summary} ${candidate.source}`.toLowerCase();
  const overlap = tokens.filter((token) => haystack.includes(token)).length;
  return overlap * 20 + Number(candidate.confidence) * 0.35 + Number(candidate.qualityScore) * 0.45;
}

async function findResearchCandidates(pool: sql.ConnectionPool, workspaceId: string) {
  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query<KnowledgeCandidate>(
    `SELECT TOP(120)
        CONVERT(nvarchar(36),KnowledgeRecordId) id,
        Title title,
        Summary summary,
        Source source,
        CONVERT(float,Confidence) confidence,
        CONVERT(float,QualityScore) qualityScore,
        Status status
      FROM cacsms.KnowledgeRecords
      WHERE WorkspaceId=@workspace
        AND ArchivedAt IS NULL
        AND Status IN (N'active', N'verified')
      ORDER BY QualityScore DESC, UpdatedAt DESC`
  );
  return result.recordset;
}

async function ensureResearchSources(
  pool: sql.ConnectionPool,
  workspaceId: string,
  row: ProductionRow,
  runId: string,
  brief: string,
  settings: SettingsRow
) {
  const existing = await loadSources(pool, runId);
  if (existing.length >= settings.MinimumResearchSources) return existing;

  const tokens = extractKeywords(`${row.title} ${brief} ${row.sourceTitle ?? ""}`);
  const candidates = await findResearchCandidates(pool, workspaceId);
  const selected = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, tokens) }))
    .filter((entry) => entry.score > 40)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(settings.MinimumResearchSources + 1, 4))
    .map((entry) => entry.candidate);

  if (selected.length > 0) {
    for (let index = 0; index < selected.length; index += 1) {
      const candidate = selected[index];
      const citation = `[${index + 1}] ${candidate.title} - ${candidate.source} (${Math.round(candidate.confidence)}% confidence)`;
      await pool
        .request()
        .input("run", sql.UniqueIdentifier, runId)
        .input("production", sql.UniqueIdentifier, row.id)
        .input("record", sql.UniqueIdentifier, candidate.id)
        .input("citation", sql.NVarChar(500), citation)
        .input("title", sql.NVarChar(300), candidate.title)
        .input("status", sql.NVarChar(30), candidate.status)
        .input("confidence", sql.Decimal(5, 2), candidate.confidence)
        .input("evidence", sql.NVarChar(2000), sanitizeText(candidate.summary, 2000))
        .query(
          `IF NOT EXISTS(
             SELECT 1 FROM cacsms.ProductionScriptEvidence
             WHERE ScriptWritingRunId=@run AND KnowledgeRecordId=@record
           )
           INSERT cacsms.ProductionScriptEvidence(
             ScriptWritingRunId,ProductionId,KnowledgeRecordId,Citation,SourceTitle,SourceStatus,Confidence,EvidenceText
           )
           VALUES(@run,@production,@record,@citation,@title,@status,@confidence,@evidence)`
        );
    }
  }

  if (row.sourceDescription) {
    await pool
      .request()
      .input("run", sql.UniqueIdentifier, runId)
      .input("production", sql.UniqueIdentifier, row.id)
      .input("citation", sql.NVarChar(500), `[S] ${row.sourceTitle ?? row.title} - opportunity intelligence source record`)
      .input("title", sql.NVarChar(300), row.sourceTitle ?? row.title)
      .input("status", sql.NVarChar(30), N"verified")
      .input("confidence", sql.Decimal(5, 2), 88)
      .input("evidence", sql.NVarChar(2000), sanitizeText(row.sourceDescription, 2000))
      .query(
        `IF NOT EXISTS(
           SELECT 1 FROM cacsms.ProductionScriptEvidence
           WHERE ScriptWritingRunId=@run AND KnowledgeRecordId IS NULL AND SourceTitle=@title
         )
         INSERT cacsms.ProductionScriptEvidence(
           ScriptWritingRunId,ProductionId,KnowledgeRecordId,Citation,SourceTitle,SourceStatus,Confidence,EvidenceText
         )
         VALUES(@run,@production,NULL,@citation,@title,@status,@confidence,@evidence)`
      );
  }

  return loadSources(pool, runId);
}

function chooseEvidenceForSection(sources: SourceRow[], index: number) {
  if (!sources.length) return [];
  const rotated = [...sources.slice(index), ...sources.slice(0, index)];
  return rotated.slice(0, Math.min(2, rotated.length));
}

function composeSectionParagraph(
  row: ProductionRow,
  title: string,
  brief: string,
  sectionTitle: string,
  evidence: SourceRow[],
  attempt: number,
  revisionHint?: string
) {
  const evidenceSummary = evidence
    .map((source) => `${source.evidenceText} ${source.citation}`)
    .join(" ");
  const focus = revisionHint ? ` Revision priority: ${revisionHint}.` : "";

  if (sectionTitle === "Opening") {
    return `${title} frames the production objective with a clear audience promise. ${brief}${focus} The opening stakes the opportunity, clarifies why it matters now, and grounds the narrative in verified evidence instead of assumptions. ${evidenceSummary}`.trim();
  }
  if (sectionTitle === "Context and evidence") {
    return `The verified research establishes the operating context, current constraints, and the strongest supporting facts for ${row.title}. This section cites only persisted sources, links each claim to evidence, and avoids unsupported completion signals. ${evidenceSummary}`.trim();
  }
  if (sectionTitle === "Core narrative") {
    return `The narrative connects the brief, the audience need, and the strongest research findings into an actionable story arc. Attempt ${attempt} strengthens the script by tightening causal logic, preserving evidence traceability, and keeping every major assertion attributable to stored citations. ${evidenceSummary}`.trim();
  }
  return `The close converts the evidence-backed narrative into a clear takeaway, operational next step, and compliant call to action. It does not mark the production complete until the factual, editorial, brand, safety, and compliance gates are all passed. ${evidenceSummary}`.trim();
}

async function writeSectionsAndVersion(
  pool: sql.ConnectionPool,
  row: ProductionRow,
  run: RunRow,
  brief: string,
  sources: SourceRow[],
  revisionHint?: string
) {
  const title = titleFromMetadata(row, parseJson(row.metadataJson));
  const attemptNumber = run.versionCount + 1;
  const sections = SECTION_BLUEPRINT.map((section, index) => {
    const sectionSources = chooseEvidenceForSection(sources, index);
    const content = composeSectionParagraph(row, title, brief, section.title, sectionSources, attemptNumber, revisionHint);
    return {
      ...section,
      content,
      wordCount: wordCount(content),
      citationCount: sectionSources.length
    };
  });

  await pool.request().input("run", sql.UniqueIdentifier, run.id).query(`DELETE FROM cacsms.ProductionScriptSections WHERE ScriptWritingRunId=@run`);

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const inserted = await pool
      .request()
      .input("run", sql.UniqueIdentifier, run.id)
      .input("production", sql.UniqueIdentifier, row.id)
      .input("key", sql.NVarChar(80), section.key)
      .input("title", sql.NVarChar(200), section.title)
      .input("sequence", sql.TinyInt, index + 1)
      .input("status", sql.NVarChar(30), "completed")
      .input("wordCount", sql.Int, section.wordCount)
      .input("citationCount", sql.Int, section.citationCount)
      .input("content", sql.NVarChar(sql.MAX), section.content)
      .query<{ id: string }>(
        `INSERT cacsms.ProductionScriptSections(
            ScriptWritingRunId,ProductionId,SectionKey,Title,SequenceNo,Status,WordCount,CitationCount,Content,CompletedAt
         )
         OUTPUT CONVERT(nvarchar(36),inserted.ProductionScriptSectionId) id
         VALUES(@run,@production,@key,@title,@sequence,@status,@wordCount,@citationCount,@content,SYSUTCDATETIME())`
      );

    for (const source of chooseEvidenceForSection(sources, index)) {
      await pool
        .request()
        .input("section", sql.UniqueIdentifier, inserted.recordset[0].id)
        .input("evidence", sql.UniqueIdentifier, source.id)
        .query(`UPDATE cacsms.ProductionScriptEvidence SET ProductionScriptSectionId=@section WHERE ProductionScriptEvidenceId=@evidence`);
    }
  }

  const content = sections.map((section) => `${section.title}\n\n${section.content}`).join("\n\n");
  const totalWords = wordCount(content);

  await pool
    .request()
    .input("run", sql.UniqueIdentifier, run.id)
    .input("production", sql.UniqueIdentifier, row.id)
    .input("attempt", sql.Int, attemptNumber)
    .input("label", sql.NVarChar(200), attemptNumber === 1 ? "Autonomous evidence draft" : `Autonomous revision ${attemptNumber - 1}`)
    .input("content", sql.NVarChar(sql.MAX), content)
    .input("wordCount", sql.Int, totalWords)
    .input("quality", sql.Decimal(5, 2), 0)
    .query(
      `INSERT cacsms.ProductionScriptVersions(
          ScriptWritingRunId,ProductionId,AttemptNumber,Label,Content,WordCount,QualityScore
       )
       VALUES(@run,@production,@attempt,@label,@content,@wordCount,@quality)`
    );

  return { sections, content, totalWords, attemptNumber };
}

function evaluateChecks(
  settings: SettingsRow,
  brief: string,
  sources: SourceRow[],
  sections: Array<{ wordCount: number; citationCount: number; content: string }>,
  content: string
) {
  const totalWords = wordCount(content);
  const citations = sources.length;
  const sectionCoverage = sections.filter((section) => section.wordCount > 0 && section.citationCount > 0).length;
  const factual = clamp((citations / settings.MinimumResearchSources) * 70 + (sectionCoverage / SECTION_BLUEPRINT.length) * 30);
  const editorial = clamp((totalWords / settings.MinimumWordCount) * 70 + (sections.length / SECTION_BLUEPRINT.length) * 30);
  const brand = clamp((brief.length / settings.MinimumBriefLength) * 45 + (content.toLowerCase().includes("audience") ? 15 : 5) + 40);
  const safety = SAFETY_BLOCKLIST.test(content) ? 20 : 96;
  const compliance = clamp((citations / settings.MinimumResearchSources) * 45 + (sectionCoverage / SECTION_BLUEPRINT.length) * 35 + (brief.length ? 20 : 0));

  const checks: Array<{ type: CheckType; score: number; status: "passed" | "failed" | "warning"; notes: string }> = [
    {
      type: "factual",
      score: round(factual),
      status: factual >= settings.QualityThreshold ? "passed" : factual >= 70 ? "warning" : "failed",
      notes: factual >= settings.QualityThreshold ? "Evidence coverage is sufficient." : "Add stronger evidence coverage and citations."
    },
    {
      type: "editorial",
      score: round(editorial),
      status: editorial >= settings.QualityThreshold ? "passed" : editorial >= 70 ? "warning" : "failed",
      notes: editorial >= settings.QualityThreshold ? "Section structure and word count are acceptable." : "Expand or tighten the sections for clarity and completeness."
    },
    {
      type: "brand",
      score: round(brand),
      status: brand >= settings.QualityThreshold ? "passed" : brand >= 70 ? "warning" : "failed",
      notes: brand >= settings.QualityThreshold ? "The script remains aligned with the persisted brief." : "Strengthen the brief alignment before approval."
    },
    {
      type: "safety",
      score: round(safety),
      status: safety >= settings.QualityThreshold ? "passed" : "failed",
      notes: safety >= settings.QualityThreshold ? "No blocked safety pattern was detected." : "Unsafe content must be removed."
    },
    {
      type: "compliance",
      score: round(compliance),
      status: compliance >= settings.QualityThreshold ? "passed" : compliance >= 70 ? "warning" : "failed",
      notes: compliance >= settings.QualityThreshold ? "Mandatory gates have the required persisted evidence." : "One or more mandatory gates remain incomplete."
    }
  ];

  const average = round(checks.reduce((total, check) => total + check.score, 0) / checks.length);
  return { checks, average };
}

async function persistChecks(
  pool: sql.ConnectionPool,
  runId: string,
  productionId: string,
  attemptNumber: number,
  checks: ReturnType<typeof evaluateChecks>["checks"]
) {
  for (const check of checks) {
    await pool
      .request()
      .input("run", sql.UniqueIdentifier, runId)
      .input("production", sql.UniqueIdentifier, productionId)
      .input("attempt", sql.Int, attemptNumber)
      .input("type", sql.NVarChar(40), check.type)
      .input("status", sql.NVarChar(30), check.status)
      .input("score", sql.Decimal(5, 2), check.score)
      .input("notes", sql.NVarChar(1000), check.notes)
      .query(
        `INSERT cacsms.ProductionScriptChecks(
            ScriptWritingRunId,ProductionId,AttemptNumber,CheckType,Status,Score,Notes
         )
         VALUES(@run,@production,@attempt,@type,@status,@score,@notes)`
      );
  }
}

function determineRevisionHint(checks: ReturnType<typeof evaluateChecks>["checks"]) {
  const failing = checks
    .filter((check) => check.status !== "passed")
    .sort((left, right) => left.score - right.score)[0];
  return failing?.notes ?? "Strengthen evidence traceability and editorial clarity.";
}

async function refreshProductionSnapshot(pool: sql.ConnectionPool, settings: SettingsRow, workspaceId: string, productionId: string) {
  const row = await loadProductionRow(pool, workspaceId, productionId);
  if (!row) throw new Error("Production not found.");
  return buildSnapshot(pool, settings, row);
}

export async function getScriptEditorData(): Promise<ScriptEditorPayload> {
  const { pool, settings } = await getContext();
  const rows = await loadProductions(pool, settings.WorkspaceId);
  const productions = await Promise.all(rows.map((row) => buildSnapshot(pool, settings, row)));
  return {
    productions,
    generatedAt: new Date().toISOString(),
    engine: "autonomous-script-writing-orchestrator-v2",
    humanInputRequired: false
  };
}

export async function runScriptEditorAutomation(productionId: string, action: "sync" | "retry" = "sync") {
  const { pool, settings } = await getContext();
  const row = await loadProductionRow(pool, settings.WorkspaceId, productionId);
  if (!row) throw new Error("Production not found.");

  let run = await loadLatestRun(pool, productionId);
  if (!run) {
    const runId = await createRun(pool, settings.WorkspaceId, productionId, action === "retry" ? "retry" : "operator", "waiting");
    await persistDecision(pool, runId, productionId, "initialize", "create-run", "queued", "Created a persisted writing job for the production.");
    await persistAudit(pool, settings.WorkspaceId, productionId, "writing.waiting", {
      message: "Created a persisted writing job.",
      status: "waiting"
    });
    return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
  }

  if ((run.status === "blocked" || run.status === "failed") && action === "retry") {
    const runId = await createRun(pool, settings.WorkspaceId, productionId, "retry", "retrying");
    await persistDecision(pool, runId, productionId, "retry", "create-retry-run", "queued", "A retry run was requested for the production.");
    await persistAudit(pool, settings.WorkspaceId, productionId, "writing.retrying", {
      message: "Created a retry run.",
      status: "retrying"
    });
    return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
  }

  if ((run.status === "blocked" || run.status === "failed" || run.status === "completed") && action === "sync") {
    return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
  }

  try {
    if (run.status === "waiting" || run.status === "retrying") {
      const brief = await ensureBrief(pool, row, settings);
      if (brief.length < settings.MinimumBriefLength) {
        await updateRun(pool, run.id, {
          status: "blocked",
          currentAction: "Waiting for a valid persisted creative brief.",
          currentAgentName: "Input Validation Agent",
          currentAgentRole: "validation",
          modelName: null,
          briefValid: false,
          blockerCode: "missing-brief",
          blockerMessage: `A persisted creative brief of at least ${settings.MinimumBriefLength} characters is required before writing can begin.`,
          nextAction: "Persist a valid creative brief, then retry."
        });
        await persistDecision(pool, run.id, productionId, "validate-inputs", "validate-brief", "blocked", "The persisted brief is missing or too short.");
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.blocked", {
          message: "Blocked the writing workflow because the creative brief is not valid.",
          status: "blocked"
        });
        await reconcileProductionState(pool, row, "research", "blocked", 12, "Writing blocked until a valid persisted brief exists.");
      } else {
        await updateRun(pool, run.id, {
          status: "researching",
          currentAction: "Retrieving verified research, evidence, and citations.",
          currentAgentName: "Evidence Research Agent",
          currentAgentRole: "research",
          modelName: RESEARCH_MODEL,
          briefValid: true,
          blockerCode: null,
          blockerMessage: null,
          nextAction: "Attach persisted research and queue the writing job."
        });
        await upsertAgentRun(pool, productionId, "Evidence Research Agent", "research", "Retrieve verified writing evidence", "running");
        await persistDecision(pool, run.id, productionId, "validate-inputs", "advance-to-research", "completed", "The required inputs are valid and research can begin.");
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.researching", {
          message: "Validated the inputs and started research retrieval.",
          status: "researching"
        });
        await reconcileProductionState(pool, row, "research", "active", 18, "Writing workflow is retrieving verified research.");
      }
      return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
    }

    if (run.status === "researching") {
      const brief = briefFromMetadata(row, parseJson(row.metadataJson));
      const sources = await ensureResearchSources(pool, settings.WorkspaceId, row, run.id, brief, settings);
      if (sources.length < settings.MinimumResearchSources) {
        await updateRun(pool, run.id, {
          status: "blocked",
          currentAction: "Research retrieval is blocked because the required sources are missing.",
          currentAgentName: "Evidence Research Agent",
          currentAgentRole: "research",
          modelName: RESEARCH_MODEL,
          briefValid: true,
          researchSourceCount: sources.length,
          blockerCode: "missing-research",
          blockerMessage: `At least ${settings.MinimumResearchSources} persisted research sources are required before script generation can begin.`,
          nextAction: "Ingest or verify more research records, then retry."
        });
        await upsertAgentRun(pool, productionId, "Evidence Research Agent", "research", "Retrieve verified writing evidence", "failed", "Missing persisted research sources.");
        await persistDecision(pool, run.id, productionId, "research", "hydrate-research", "blocked", "The research gate failed because too few persisted sources were found.", {
          sources: sources.length
        });
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.blocked", {
          message: "Blocked the writing workflow because the research gate failed.",
          status: "blocked"
        });
        await reconcileProductionState(pool, row, "research", "blocked", 18, "Writing blocked until research sources are available.");
      } else {
        await updateRun(pool, run.id, {
          status: "queued",
          currentAction: "Persisted evidence is ready and the writing job is queued.",
          currentAgentName: "Narrative Synthesis Agent",
          currentAgentRole: "script",
          modelName: settings.WriterModel,
          briefValid: true,
          researchSourceCount: sources.length,
          blockerCode: null,
          blockerMessage: null,
          nextAction: "Generate and persist all script sections."
        });
        await upsertAgentRun(pool, productionId, "Evidence Research Agent", "research", "Retrieve verified writing evidence", "completed");
        await upsertAgentRun(pool, productionId, "Narrative Synthesis Agent", "script", "Generate the production script", "queued");
        await persistDecision(pool, run.id, productionId, "research", "persist-research", "completed", "Attached persisted evidence and citations to the writing job.", {
          sources: sources.length
        });
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.queued", {
          message: "Persisted evidence and queued the writing job.",
          status: "queued"
        });
        await reconcileProductionState(pool, row, "scripting", "active", 26, "Writing queued from verified research.");
      }
      return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
    }

    if (run.status === "queued") {
      await updateRun(pool, run.id, {
        status: "generating",
        currentAction: "Generating and persisting script sections from verified evidence.",
        currentAgentName: "Narrative Synthesis Agent",
        currentAgentRole: "script",
        modelName: settings.WriterModel,
        nextAction: "Persist the section draft and create a script version."
      });
      await upsertAgentRun(pool, productionId, "Narrative Synthesis Agent", "script", "Generate the production script", "running");
      await persistDecision(pool, run.id, productionId, "queue", "start-generation", "completed", "Started the writing job.");
      await persistAudit(pool, settings.WorkspaceId, productionId, "writing.generating", {
        message: "Started script generation.",
        status: "generating"
      });
      await reconcileProductionState(pool, row, "scripting", "active", 32, "Writing is generating the script sections.");
      return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
    }

    if (run.status === "generating") {
      const brief = briefFromMetadata(row, parseJson(row.metadataJson));
      const sources = await loadSources(pool, run.id);
      const generated = await writeSectionsAndVersion(pool, row, run, brief, sources);
      await updateRun(pool, run.id, {
        status: "reviewing",
        currentAction: "Running factual, editorial, brand, safety, and compliance gates.",
        currentAgentName: "Autonomous QA Agent",
        currentAgentRole: "quality",
        modelName: settings.ReviewerModel,
        briefValid: true,
        researchSourceCount: sources.length,
        versionCount: generated.attemptNumber,
        wordCount: generated.totalWords,
        blockerCode: null,
        blockerMessage: null,
        nextAction: "Score the draft and either approve it or revise it."
      });
      await upsertAgentRun(pool, productionId, "Narrative Synthesis Agent", "script", "Generate the production script", "completed");
      await upsertAgentRun(pool, productionId, "Autonomous QA Agent", "quality", "Run mandatory writing gates", "running");
      await persistDecision(pool, run.id, productionId, "generation", "persist-sections", "completed", "Persisted all script sections and created a new script version.", {
        words: generated.totalWords,
        attemptNumber: generated.attemptNumber
      });
      await persistAudit(pool, settings.WorkspaceId, productionId, "writing.reviewing", {
        message: "Persisted the draft and started quality review.",
        status: "reviewing"
      });
      await reconcileProductionState(pool, row, "scripting", "active", 38, "Writing draft persisted and under review.");
      return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
    }

    if (run.status === "reviewing") {
      const versions = await loadVersions(pool, run.id);
      const currentSections = await loadSections(pool, run.id);
      const currentSources = await loadSources(pool, run.id);
      const latestVersion = versions[0];
      const evaluation = evaluateChecks(
        settings,
        briefFromMetadata(row, parseJson(row.metadataJson)),
        currentSources,
        currentSections.map((section) => ({
          wordCount: Number(section.wordCount),
          citationCount: Number(section.citationCount),
          content: sanitizeText(section.content)
        })),
        latestVersion?.content ?? ""
      );
      await persistChecks(pool, run.id, productionId, latestVersion?.attemptNumber ?? Math.max(1, run.versionCount), evaluation.checks);

      if (evaluation.average >= settings.QualityThreshold && evaluation.checks.every((check) => check.status !== "failed")) {
        await pool
          .request()
          .input("run", sql.UniqueIdentifier, run.id)
          .input("quality", sql.Decimal(5, 2), evaluation.average)
          .query(
            `UPDATE cacsms.ProductionScriptVersions
             SET QualityScore=@quality
             WHERE ScriptWritingRunId=@run AND AttemptNumber=(
               SELECT MAX(AttemptNumber) FROM cacsms.ProductionScriptVersions WHERE ScriptWritingRunId=@run
             )`
          );
        await updateRun(pool, run.id, {
          status: "completed",
          currentAction: "Mandatory writing gates passed and the production advanced to storyboard.",
          currentAgentName: "Autonomous QA Agent",
          currentAgentRole: "quality",
          modelName: settings.ReviewerModel,
          wordCount: latestVersion?.wordCount ?? 0,
          qualityScore: evaluation.average,
          briefValid: true,
          researchSourceCount: currentSources.length,
          versionCount: versions.length,
          mandatoryGatesPassed: true,
          blockerCode: null,
          blockerMessage: null,
          nextAction: "Storyboard planning can begin.",
          completedAtNow: true
        });
        await upsertAgentRun(pool, productionId, "Autonomous QA Agent", "quality", "Run mandatory writing gates", "completed");
        await persistDecision(pool, run.id, productionId, "review", "approve-script", "completed", "All mandatory writing gates passed.", {
          qualityScore: evaluation.average
        });
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.completed", {
          message: "Passed all writing gates and advanced to storyboard.",
          status: "completed",
          qualityScore: evaluation.average
        });
        await reconcileProductionState(pool, row, "storyboard", "active", stageProgress("storyboard"), "Writing gates passed and the production advanced to storyboard.");
      } else if (run.retryCount < settings.MaxRevisionAttempts) {
        const hint = determineRevisionHint(evaluation.checks);
        await updateRun(pool, run.id, {
          status: "revising",
          currentAction: "Revising the script to satisfy the mandatory gates.",
          currentAgentName: "Narrative Synthesis Agent",
          currentAgentRole: "script",
          modelName: settings.WriterModel,
          retryCount: run.retryCount + 1,
          qualityScore: evaluation.average,
          briefValid: true,
          researchSourceCount: currentSources.length,
          versionCount: versions.length,
          mandatoryGatesPassed: false,
          blockerCode: null,
          blockerMessage: null,
          nextAction: hint
        });
        await upsertAgentRun(pool, productionId, "Autonomous QA Agent", "quality", "Run mandatory writing gates", "completed");
        await upsertAgentRun(pool, productionId, "Narrative Synthesis Agent", "script", "Revise the production script", "running");
        await persistDecision(pool, run.id, productionId, "review", "request-revision", "retry", "The draft did not pass the quality threshold and will be revised.", {
          qualityScore: evaluation.average,
          retry: run.retryCount + 1,
          hint
        });
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.revising", {
          message: "Requested a revision after review.",
          status: "revising",
          qualityScore: evaluation.average
        });
        await reconcileProductionState(pool, row, "scripting", "active", 40, "Writing review requested a revision.");
      } else {
        const hint = determineRevisionHint(evaluation.checks);
        await updateRun(pool, run.id, {
          status: "failed",
          currentAction: "The writing engine exhausted the configured revision attempts.",
          currentAgentName: "Autonomous QA Agent",
          currentAgentRole: "quality",
          modelName: settings.ReviewerModel,
          qualityScore: evaluation.average,
          briefValid: true,
          researchSourceCount: currentSources.length,
          versionCount: versions.length,
          mandatoryGatesPassed: false,
          blockerCode: "quality-threshold",
          blockerMessage: hint,
          nextAction: "Inspect the audit history and retry after correcting the blockers."
        });
        await upsertAgentRun(pool, productionId, "Autonomous QA Agent", "quality", "Run mandatory writing gates", "failed", hint);
        await persistDecision(pool, run.id, productionId, "review", "fail-script", "failed", "The writing engine exhausted the configured revision attempts.", {
          qualityScore: evaluation.average
        });
        await persistAudit(pool, settings.WorkspaceId, productionId, "writing.failed", {
          message: "The writing engine exhausted the configured revision attempts.",
          status: "failed",
          qualityScore: evaluation.average
        });
        await reconcileProductionState(pool, row, "scripting", "blocked", 36, "Writing failed the mandatory gates and requires recovery.");
      }
      return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
    }

    if (run.status === "revising") {
      const brief = briefFromMetadata(row, parseJson(row.metadataJson));
      const sources = await loadSources(pool, run.id);
      const latestChecks = await loadChecks(pool, run.id);
      const hint = determineRevisionHint(
        latestChecks
          .slice(0, CHECK_TYPES.length)
          .map((check) => ({
            type: check.checkType,
            score: Number(check.score),
            status: check.status,
            notes: sanitizeText(check.notes, 1000)
          }))
      );
      const generated = await writeSectionsAndVersion(pool, row, run, brief, sources, hint);
      await updateRun(pool, run.id, {
        status: "reviewing",
        currentAction: "Running the mandatory gates against the revised draft.",
        currentAgentName: "Autonomous QA Agent",
        currentAgentRole: "quality",
        modelName: settings.ReviewerModel,
        wordCount: generated.totalWords,
        versionCount: generated.attemptNumber,
        nextAction: "Approve the revised draft or request another revision."
      });
      await upsertAgentRun(pool, productionId, "Narrative Synthesis Agent", "script", "Revise the production script", "completed");
      await upsertAgentRun(pool, productionId, "Autonomous QA Agent", "quality", "Run mandatory writing gates", "running");
      await persistDecision(pool, run.id, productionId, "revision", "persist-revision", "completed", "Persisted a revised script version for another quality review.", {
        attemptNumber: generated.attemptNumber,
        words: generated.totalWords
      });
      await persistAudit(pool, settings.WorkspaceId, productionId, "writing.reviewing", {
        message: "Persisted a revision and restarted review.",
        status: "reviewing"
      });
      await reconcileProductionState(pool, row, "scripting", "active", 42, "Writing revision persisted and under review.");
      return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
    }

    return refreshProductionSnapshot(pool, settings, settings.WorkspaceId, productionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Autonomous script writing failed.";
    await updateRun(pool, run.id, {
      status: "failed",
      currentAction: "The writing engine failed and requires recovery.",
      currentAgentName: run.currentAgentName,
      currentAgentRole: run.currentAgentRole,
      modelName: run.modelName,
      errorMessage: message,
      blockerCode: "runtime-error",
      blockerMessage: message,
      nextAction: "Retry the writing job after correcting the runtime failure."
    });
    await persistDecision(pool, run.id, productionId, "runtime", "handle-error", "failed", message);
    await persistAudit(pool, settings.WorkspaceId, productionId, "writing.failed", {
      message,
      status: "failed"
    });
    await reconcileProductionState(pool, row, "scripting", "blocked", 30, "Writing failed and requires recovery.");
    throw error;
  }
}

export async function runScriptWritingScheduler() {
  const { pool, settings } = await getContext();
  const productions = await loadProductions(pool, settings.WorkspaceId);

  for (const prod of productions) {
    if (["completed", "published", "archived", "cancelled"].includes(prod.status.toLowerCase())) continue;

    try {
      await runScriptEditorAutomation(prod.id, "sync");
    } catch (error) {
      console.error(`Failed to run script writing for production ${prod.id}`, { name: error instanceof Error ? error.name : "Unknown", message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return getScriptEditorData();
}
