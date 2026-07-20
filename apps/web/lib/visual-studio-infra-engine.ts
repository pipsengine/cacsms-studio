import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import { getImageGeneratorData, type ImageGeneratorPayload, type ImageGeneratorProduction } from "@/lib/image-generator-data";
import { getCompletedVariantIntegrityErrors } from "@/lib/image-generator-integrity";
import { getAssetRequirementsWorkspaceData, type AssetRequirementsPayload } from "@/lib/storyboard-asset-requirements-engine";
import { getScriptIntelligenceWorkspaceData, type ScriptIntelligencePayload } from "@/lib/script-intelligence-engine";

export const VISUAL_INFRA_MODES = [
  "generation-queue",
  "visual-brief-resolver",
  "prompt-intelligence",
  "regional-visual-intelligence",
  "model-and-workflow-manager",
  "reference-conditioning",
  "image-repair-and-enhancement",
  "rights-and-provenance"
] as const;

export type VisualInfraMode =
  | "generation-queue"
  | "visual-brief-resolver"
  | "prompt-intelligence"
  | "regional-visual-intelligence"
  | "model-and-workflow-manager"
  | "reference-conditioning"
  | "image-repair-and-enhancement"
  | "rights-and-provenance";

type QueueManifest = {
  generatedAt: string;
  queueState: string;
  pendingVariants: number;
  completedVariants: number;
  failedVariants: number;
  browserVerifiedVariants: number;
  activeVariantLabel: string | null;
};

type BriefManifest = {
  generatedAt: string;
  sourceAssetCode: string;
  scene: string;
  subject: string;
  purpose: string;
  aspectRatio: string;
  visualOpportunities: string[];
  requiredAssetTypes: string[];
  characters: string[];
  locations: string[];
  props: string[];
  emotions: string[];
};

type PromptManifest = {
  generatedAt: string;
  prompt: string;
  required: string[];
  prohibited: string[];
  references: string[];
  candidatePlan: string[];
};

type RegionalManifest = {
  generatedAt: string;
  country: string;
  region: string;
  city: string;
  environment: string;
  culturalNotes: string[];
  infrastructure: string;
  clothing: string;
  stereotypeAvoidance: string[];
};

type WorkflowManifest = {
  generatedAt: string;
  provider: string;
  model: string;
  routingStatus: string;
  selectedVariant: string | null;
  selectedQualityScore: number | null;
  selectionMethod: string;
  queueDepth: number;
  configuredLocalModel: boolean;
  browserLoadStatus: string;
  repairRequired: boolean;
  targetSceneId: string | null;
  targetShotId: string | null;
};

type ReferenceManifest = {
  generatedAt: string;
  references: string[];
  characterReferences: string[];
  sceneReferences: string[];
  conditioningMode: string;
};

type RepairManifest = {
  generatedAt: string;
  issueTitles: string[];
  integrityWarnings: string[];
  failedVariants: string[];
  nextRepairAction: string | null;
};

type RightsManifest = {
  generatedAt: string;
  assetId: string | null;
  assetUrl: string | null;
  checksum: string | null;
  mimeType: string | null;
  browserLoadStatus: string;
  providerModel: string;
  provenanceStatus: string;
};

export type VisualInfraProduction = {
  id: string;
  code: string;
  title: string;
  state: string;
  priority: string;
  updatedAt: string;
  qualityScore: number;
  queue: QueueManifest;
  briefResolver: BriefManifest;
  promptIntelligence: PromptManifest;
  regional: RegionalManifest;
  workflow: WorkflowManifest;
  referenceConditioning: ReferenceManifest;
  repair: RepairManifest;
  rights: RightsManifest;
};

export type VisualInfraPayload = {
  generatedAt: string;
  productions: VisualInfraProduction[];
  summary: {
    total: number;
    active: number;
    approved: number;
    queueDepth: number;
    averageQuality: number;
  };
};

export type VisualInfraHistoryEntry = {
  createdAt: string;
  previousState: string | null;
  newState: string;
  reason: string | null;
  attempt: number;
  workerName: string | null;
  agentName: string | null;
  providerName: string | null;
  modelName: string | null;
  errorDetails: string[];
};

export type VisualInfraCandidateEntry = {
  variantLabel: string;
  state: string;
  qualityScore: number | null;
  browserLoadStatus: string;
  selected: boolean;
  assetId: string | null;
  qualityPassed: boolean | null;
  qualityDefects: string[];
  technicalStatus: string | null;
  technicalReasons: string[];
};

export type VisualInfraVersionEntry = {
  versionNumber: number;
  createdAt: string;
  summary: string;
  chips: string[];
};

export type VisualInfraProductionDetail = {
  productionId: string;
  queue: {
    jobId: string | null;
    state: string;
    workerName: string | null;
    claimedAt: string | null;
    leaseExpiresAt: string | null;
    workerHeartbeatAt: string | null;
    technicalValidationStatus: string | null;
    storageResult: string | null;
    model: string | null;
    provider: string | null;
    workflow: string | null;
  };
  operational: {
    leaseRisk: string;
    leaseRemainingSeconds: number | null;
    heartbeatLagSeconds: number | null;
    reclaimCount: number;
    reclaimEvents: Array<{
      createdAt: string;
      state: string;
      reason: string | null;
      attempt: number;
    }>;
    providerHealth: Array<{ label: string; value: string }>;
    degradedRouting: boolean;
    routingDecisionReason: string | null;
    scoringRationale: string[];
  };
  request: {
    requestId: string | null;
    status: string;
    sceneKey: string | null;
    assetType: string | null;
    purpose: string | null;
    priority: string | null;
    briefHash: string | null;
    storyboardVersionLabel: string | null;
    storyboardSceneId: string | null;
    storyboardShotId: string | null;
    targetAssetCount: number | null;
    routedAssetId: string | null;
    updatedAt: string | null;
  };
  brief: {
    briefId: string | null;
    status: string;
    currentVersion: number | null;
    required: string[];
    prohibited: string[];
    evidence: string[];
    updatedAt: string | null;
    versions: VisualInfraVersionEntry[];
  };
  prompt: {
    promptId: string | null;
    currentVersion: number | null;
    canonicalPrompt: string | null;
    modelSpecificPrompt: string | null;
    negativePrompt: string | null;
    unresolvedVariables: boolean | null;
    localeResolved: boolean | null;
    workflow: string | null;
    updatedAt: string | null;
    versions: VisualInfraVersionEntry[];
  };
  routing: {
    status: string;
    storyboard: string;
    assetLibrary: string;
    videoStudio: string;
    targetSceneId: string | null;
    targetShotId: string | null;
    approvedAssetId: string | null;
    approvedAssetUrl: string | null;
    updatedAt: string | null;
    audit: Array<{ label: string; value: string }>;
  };
  candidates: VisualInfraCandidateEntry[];
  history: VisualInfraHistoryEntry[];
};

export type VisualInfraModeCollectionItem = {
  productionId: string;
  code: string;
  title: string;
  state: string;
  priority: string;
  updatedAt: string;
  status: string;
  emphasis: string;
  detail: string;
  chips: string[];
  metricLabel: string;
  metricValue: string;
};

export type VisualInfraModeCollectionPayload = {
  mode: VisualInfraMode;
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    blocked: number;
    pending: number;
  };
  items: VisualInfraModeCollectionItem[];
};

function parseJson(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function truncate(value: string | null | undefined, max = 120) {
  if (!value) return "Pending";
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item))));
}

function takeWords(lines: Array<{ excerpt: string }>, limit = 6) {
  return lines.slice(0, limit).map((item) => item.excerpt);
}

function selectedCandidate(production: ImageGeneratorProduction) {
  const ranked = [...production.variants].sort((left, right) => {
    const leftCompleted = left.status === "Completed" ? 1 : 0;
    const rightCompleted = right.status === "Completed" ? 1 : 0;
    if (rightCompleted !== leftCompleted) return rightCompleted - leftCompleted;
    const leftLoaded = left.browserLoadStatus === "loaded" ? 1 : 0;
    const rightLoaded = right.browserLoadStatus === "loaded" ? 1 : 0;
    if (rightLoaded !== leftLoaded) return rightLoaded - leftLoaded;
    return 0;
  });
  return (
    ranked.find((variant) => variant.assetId === production.activeAssetId) ??
    ranked.find((variant) => variant.status === "Completed" && variant.browserLoadStatus === "loaded") ??
    ranked[0] ??
    null
  );
}

function detailMetricValue(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "Pending";
}

function secondsBetween(from: Date | null | undefined, to: Date) {
  if (!from) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

function secondsUntil(from: Date | null | undefined, to: Date) {
  if (!from) return null;
  return Math.round((from.getTime() - to.getTime()) / 1000);
}

function leaseRiskLabel(leaseRemainingSeconds: number | null, heartbeatLagSeconds: number | null, queueState: string) {
  if (!["Queued", "Generating", "Uploading", "Persisting", "Validating", "Reviewing", "Revising", "Waiting for Inputs"].includes(queueState)) {
    return "Inactive";
  }
  if (leaseRemainingSeconds === null) return "Untracked";
  if (leaseRemainingSeconds <= 0) return "Expired";
  if (leaseRemainingSeconds <= 60) return "Critical";
  if (heartbeatLagSeconds !== null && heartbeatLagSeconds >= 180) return "Heartbeat stale";
  if (leaseRemainingSeconds <= 180) return "Watch";
  return "Healthy";
}

function queueManifest(production: ImageGeneratorProduction): QueueManifest {
  const completedVariants = production.variants.filter((variant) => variant.status === "Completed").length;
  const failedVariants = production.variants.filter((variant) => variant.status === "Failed" || variant.status === "Rejected").length;
  const pendingVariants = production.variants.length - completedVariants - failedVariants;
  const browserVerifiedVariants = production.variants.filter((variant) => variant.browserLoadStatus === "loaded").length;
  return {
    generatedAt: production.updatedAt,
    queueState: production.state,
    pendingVariants,
    completedVariants,
    failedVariants,
    browserVerifiedVariants,
    activeVariantLabel: production.variants.find((variant) => variant.status === production.state)?.label ?? production.variants[0]?.label ?? null
  };
}

function briefManifest(
  production: ImageGeneratorProduction,
  assetRequirements: AssetRequirementsPayload["productions"][number] | undefined,
  scriptIntelligence: ScriptIntelligencePayload["productions"][number] | undefined
): BriefManifest {
  return {
    generatedAt: production.updatedAt,
    sourceAssetCode: production.asset,
    scene: production.brief.scene,
    subject: production.brief.subject,
    purpose: production.brief.purpose,
    aspectRatio: production.brief.aspectRatio,
    visualOpportunities: takeWords(scriptIntelligence?.manifest?.visualOpportunities ?? []),
    requiredAssetTypes: unique(assetRequirements?.manifest?.scenes.flatMap((scene) => scene.categories.map((category) => category.category)) ?? []),
    characters: unique(scriptIntelligence?.manifest?.characters.map((item) => item.label) ?? []),
    locations: unique(scriptIntelligence?.manifest?.locations.map((item) => item.label) ?? []),
    props: unique(scriptIntelligence?.manifest?.props.map((item) => item.label) ?? []),
    emotions: unique(scriptIntelligence?.manifest?.emotions.map((item) => item.label) ?? [])
  };
}

function promptManifest(production: ImageGeneratorProduction): PromptManifest {
  return {
    generatedAt: production.updatedAt,
    prompt: production.prompt,
    required: production.constraints.required,
    prohibited: production.constraints.prohibited,
    references: production.references.map((item) => `${item.id} · ${item.status}`),
    candidatePlan: [
      "Generate multiple candidates with regional accuracy preserved.",
      "Send all completed candidates through visual QA and integrity validation.",
      "Repair only variants with verified defects or policy drift."
    ]
  };
}

function regionalManifest(production: ImageGeneratorProduction): RegionalManifest {
  const locale = production.brief.localeProfile;
  return {
    generatedAt: production.updatedAt,
    country: locale.country,
    region: locale.region,
    city: locale.city,
    environment: locale.environment,
    culturalNotes: locale.culturalNotes,
    infrastructure: locale.infrastructure,
    clothing: locale.clothing,
    stereotypeAvoidance: locale.stereotypeAvoidance
  };
}

function workflowManifest(production: ImageGeneratorProduction, payload: ImageGeneratorPayload): WorkflowManifest {
  const selected = selectedCandidate(production);
  return {
    generatedAt: production.updatedAt,
    provider: production.agent.storageResult || "local visual pipeline",
    model: production.agent.model,
    routingStatus: production.routing.status,
    selectedVariant: selected?.label ?? null,
    selectedQualityScore: null,
    selectionMethod: "Highest-ranked completed candidate with verified routing preference",
    queueDepth: payload.summary.queueDepth,
    configuredLocalModel: Boolean(process.env.CACSMS_LOCAL_IMAGE_MODEL_ID?.trim()),
    browserLoadStatus: production.browserLoadStatus,
    repairRequired: production.issues.length > 0 || production.browserLoadStatus === "failed",
    targetSceneId: null,
    targetShotId: null
  };
}

function referenceManifest(
  production: ImageGeneratorProduction,
  assetRequirements: AssetRequirementsPayload["productions"][number] | undefined,
  scriptIntelligence: ScriptIntelligencePayload["productions"][number] | undefined
): ReferenceManifest {
  return {
    generatedAt: production.updatedAt,
    references: production.references.map((item) => item.id),
    characterReferences: unique(scriptIntelligence?.manifest?.characters.map((item) => item.label) ?? []),
    sceneReferences: unique(assetRequirements?.manifest?.scenes.map((item) => item.title) ?? []),
    conditioningMode: production.references.length ? "reference-conditioned autonomous generation" : "brief-only autonomous generation"
  };
}

function repairManifest(production: ImageGeneratorProduction): RepairManifest {
  const integrityWarnings = production.variants.flatMap((variant) =>
    getCompletedVariantIntegrityErrors({
      state: variant.status,
      assetId: variant.assetId,
      assetUrl: variant.assetUrl,
      fileSizeBytes: variant.fileSizeBytes,
      checksumSha256: variant.checksumSha256,
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType,
      browserLoadStatus: variant.browserLoadStatus
    }).map((error) => `${variant.label}: ${error}`)
  );
  return {
    generatedAt: production.updatedAt,
    issueTitles: production.issues.map((item) => item.title),
    integrityWarnings,
    failedVariants: production.variants.filter((variant) => variant.status === "Failed" || variant.status === "Rejected").map((variant) => variant.label),
    nextRepairAction: production.recovery
  };
}

function rightsManifest(production: ImageGeneratorProduction): RightsManifest {
  const activeVariant = production.variants.find((variant) => variant.assetId === production.activeAssetId) ?? production.variants.find((variant) => variant.status === "Completed") ?? null;
  return {
    generatedAt: production.updatedAt,
    assetId: production.activeAssetId,
    assetUrl: production.activeAssetUrl,
    checksum: activeVariant?.checksumSha256 ?? null,
    mimeType: activeVariant?.mimeType ?? null,
    browserLoadStatus: production.browserLoadStatus,
    providerModel: production.agent.model,
    provenanceStatus: production.browserLoadStatus === "loaded" && production.activeAssetId ? "verified synthetic provenance" : "pending asset integrity"
  };
}

async function metadataByProduction(pool: sql.ConnectionPool, productionIds: string[]) {
  if (!productionIds.length) return new Map<string, string | null>();
  const request = pool.request();
  const placeholders: string[] = [];
  productionIds.forEach((id, index) => {
    const name = `id${index}`;
    request.input(name, sql.NVarChar(36), id);
    placeholders.push(`@${name}`);
  });
  const result = await request.query<{ ProductionId: string; MetadataJson: string | null }>(`
    SELECT CONVERT(nvarchar(36), ProductionId) AS ProductionId, MetadataJson
    FROM cacsms.Productions
    WHERE CONVERT(nvarchar(36), ProductionId) IN (${placeholders.join(", ")});
  `);
  return new Map(result.recordset.map((row) => [row.ProductionId, row.MetadataJson]));
}

async function loadVisualProductionDetail(pool: sql.ConnectionPool, productionId: string): Promise<VisualInfraProductionDetail> {
  const jobRow = await pool.request().input("production", sql.NVarChar(36), productionId).query<{
    ImageGenerationJobId: string;
    State: string;
    WorkerName: string | null;
    ClaimedAt: Date | null;
    LeaseExpiresAt: Date | null;
    WorkerHeartbeatAt: Date | null;
    TechnicalValidationStatus: string | null;
    StorageResult: string | null;
    ModelResponseJson: string | null;
    ProviderName: string | null;
    ModelName: string | null;
  }>(`
    SELECT TOP(1)
      CONVERT(nvarchar(36), ImageGenerationJobId) AS ImageGenerationJobId,
      State,
      WorkerName,
      ClaimedAt,
      LeaseExpiresAt,
      WorkerHeartbeatAt,
      TechnicalValidationStatus,
      StorageResult,
      ModelResponseJson,
      ProviderName,
      ModelName
    FROM cacsms.ImageGenerationJobs
    WHERE CONVERT(nvarchar(36), ProductionId) = @production
    ORDER BY UpdatedAt DESC, CreatedAt DESC;
  `);
  const job = jobRow.recordset[0] ?? null;
  const modelResponse = parseJson(job?.ModelResponseJson ?? null);

  const requestRow = await pool.request().input("production", sql.NVarChar(36), productionId).query<{
    VisualGenerationRequestId: string;
    Status: string;
    SceneKey: string | null;
    AssetType: string | null;
    Purpose: string | null;
    Priority: string | null;
    BriefHash: string | null;
    ContextJson: string | null;
    UpdatedAt: Date | null;
  }>(`
    SELECT TOP(1)
      CONVERT(nvarchar(36), VisualGenerationRequestId) AS VisualGenerationRequestId,
      Status,
      SceneKey,
      AssetType,
      Purpose,
      Priority,
      BriefHash,
      ContextJson,
      UpdatedAt
    FROM cacsms.VisualGenerationRequests
    WHERE ProductionId = CONVERT(uniqueidentifier, @production)
      AND IsDeleted = 0
    ORDER BY UpdatedAt DESC, CreatedAt DESC;
  `);
  const request = requestRow.recordset[0] ?? null;
  const requestContext = asObject(parseJson(request?.ContextJson ?? null).storyboard);

  const briefRow = request
    ? await pool.request().input("requestId", sql.NVarChar(36), request.VisualGenerationRequestId).query<{
        VisualBriefId: string;
        Status: string;
        CurrentVersion: number;
        UpdatedAt: Date | null;
        RequiredElementsJson: string | null;
        ProhibitedElementsJson: string | null;
        EvidenceJson: string | null;
      }>(`
        SELECT TOP(1)
          CONVERT(nvarchar(36), b.VisualBriefId) AS VisualBriefId,
          b.Status,
          b.CurrentVersion,
          b.UpdatedAt,
          v.RequiredElementsJson,
          v.ProhibitedElementsJson,
          v.EvidenceJson
        FROM cacsms.VisualBriefs b
        LEFT JOIN cacsms.VisualBriefVersions v
          ON v.VisualBriefId = b.VisualBriefId
         AND v.VersionNumber = b.CurrentVersion
        WHERE b.VisualGenerationRequestId = CONVERT(uniqueidentifier, @requestId);
      `)
    : null;
  const brief = briefRow?.recordset[0] ?? null;
  const briefVersionsRow = brief
    ? await pool.request().input("briefId", sql.NVarChar(36), brief.VisualBriefId).query<{
        VersionNumber: number;
        CreatedAt: Date;
        RequiredElementsJson: string | null;
        ProhibitedElementsJson: string | null;
        EvidenceJson: string | null;
      }>(`
        SELECT TOP(6)
          VersionNumber,
          CreatedAt,
          RequiredElementsJson,
          ProhibitedElementsJson,
          EvidenceJson
        FROM cacsms.VisualBriefVersions
        WHERE VisualBriefId = CONVERT(uniqueidentifier, @briefId)
        ORDER BY VersionNumber DESC;
      `)
    : null;

  const promptRow = brief
    ? await pool.request().input("briefId", sql.NVarChar(36), brief.VisualBriefId).query<{
        VisualPromptId: string;
        CurrentVersion: number;
        UpdatedAt: Date | null;
        CanonicalPrompt: string | null;
        ModelSpecificPrompt: string | null;
        NegativePrompt: string | null;
        ValidationJson: string | null;
      }>(`
        SELECT TOP(1)
          CONVERT(nvarchar(36), p.VisualPromptId) AS VisualPromptId,
          p.CurrentVersion,
          p.UpdatedAt,
          v.CanonicalPrompt,
          v.ModelSpecificPrompt,
          v.NegativePrompt,
          v.ValidationJson
        FROM cacsms.VisualPrompts p
        LEFT JOIN cacsms.VisualPromptVersions v
          ON v.VisualPromptId = p.VisualPromptId
         AND v.VersionNumber = p.CurrentVersion
        WHERE p.VisualBriefId = CONVERT(uniqueidentifier, @briefId);
      `)
    : null;
  const prompt = promptRow?.recordset[0] ?? null;
  const promptVersionsRow = prompt
    ? await pool.request().input("promptId", sql.NVarChar(36), prompt.VisualPromptId).query<{
        VersionNumber: number;
        CreatedAt: Date;
        ModelSpecificPrompt: string | null;
        ValidationJson: string | null;
      }>(`
        SELECT TOP(6)
          VersionNumber,
          CreatedAt,
          ModelSpecificPrompt,
          ValidationJson
        FROM cacsms.VisualPromptVersions
        WHERE VisualPromptId = CONVERT(uniqueidentifier, @promptId)
        ORDER BY VersionNumber DESC;
      `)
    : null;

  const metadataRow = await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .query<{ MetadataJson: string | null }>(
      "SELECT TOP(1) MetadataJson FROM cacsms.Productions WHERE CONVERT(nvarchar(36), ProductionId)=@production;"
    );
  const metadata = parseJson(metadataRow.recordset[0]?.MetadataJson ?? null);
  const visualGeneration = asObject(metadata.visualGeneration);
  const routing = asObject(visualGeneration.routing);
  const approvedAsset = asObject(visualGeneration.approvedAsset);

  const historyRows = request
    ? await pool.request().input("requestId", sql.NVarChar(36), request.VisualGenerationRequestId).query<{
        PreviousState: string | null;
        NewState: string;
        Reason: string | null;
        Attempt: number;
        WorkerName: string | null;
        AgentName: string | null;
        ProviderName: string | null;
        ModelName: string | null;
        ErrorDetailsJson: string | null;
        CreatedAt: Date;
      }>(`
        SELECT TOP(10)
          PreviousState,
          NewState,
          Reason,
          Attempt,
          WorkerName,
          AgentName,
          ProviderName,
          ModelName,
          ErrorDetailsJson,
          CreatedAt
        FROM cacsms.VisualGenerationStateHistory
        WHERE VisualGenerationRequestId = CONVERT(uniqueidentifier, @requestId)
        ORDER BY CreatedAt DESC;
      `)
    : null;

  const candidateRows = await pool.request().input("production", sql.NVarChar(36), productionId).query<{
    VariantNumber: number;
    State: string;
    QualityScore: number | null;
    QualitySummaryJson: string | null;
    BrowserLoadStatus: string | null;
    ImageGenerationAssetId: string | null;
    TechnicalValidationJson: string | null;
    TechnicalValidationStatus: string | null;
  }>(`
    SELECT
      v.VariantNumber,
      v.State,
      CONVERT(float, v.QualityScore) AS QualityScore,
      v.QualitySummaryJson,
      a.BrowserLoadStatus,
      CONVERT(nvarchar(36), v.ImageGenerationAssetId) AS ImageGenerationAssetId,
      a.TechnicalValidationJson,
      a.TechnicalValidationStatus
    FROM cacsms.ImageGenerationVariants v
    LEFT JOIN cacsms.ImageGenerationAssets a ON a.ImageGenerationAssetId = v.ImageGenerationAssetId
    WHERE CONVERT(nvarchar(36), v.ProductionId) = @production
    ORDER BY ISNULL(v.QualityScore, 0) DESC, v.UpdatedAt DESC, v.VariantNumber ASC;
  `);

  const validation = parseJson(prompt?.ValidationJson ?? null);
  const selectedAssetId = asOptionalString(approvedAsset.assetId);
  const review = asObject(modelResponse.review);
  const router = asObject(modelResponse.router);
  const providerHealth = asObject(router.health);
  const now = new Date();
  const leaseRemainingSeconds = secondsUntil(job?.LeaseExpiresAt ?? null, now);
  const heartbeatLagSeconds = secondsBetween(job?.WorkerHeartbeatAt ?? null, now);
  const briefVersions = (briefVersionsRow?.recordset ?? []).map((row) => {
    const evidence = asObject(parseJson(row.EvidenceJson ?? null));
    const references = toStringArray(evidence.references);
    const required = toStringArray(parseJsonArray(row.RequiredElementsJson ?? null));
    const prohibited = toStringArray(parseJsonArray(row.ProhibitedElementsJson ?? null));
    return {
      versionNumber: row.VersionNumber,
      createdAt: row.CreatedAt.toISOString(),
      summary: `${required.length} required · ${prohibited.length} prohibited · ${references.length} evidence reference(s)`,
      chips: [
        ...required.slice(0, 2).map((item) => `Need ${item}`),
        ...prohibited.slice(0, 2).map((item) => `Block ${item}`),
        ...(references[0] ? [`Ref ${references[0]}`] : [])
      ]
    };
  });
  const promptVersions = (promptVersionsRow?.recordset ?? []).map((row) => {
    const promptValidation = asObject(parseJson(row.ValidationJson ?? null));
    return {
      versionNumber: row.VersionNumber,
      createdAt: row.CreatedAt.toISOString(),
      summary: truncate(row.ModelSpecificPrompt ?? "Prompt text unavailable", 120),
      chips: [
        asOptionalString(promptValidation.workflow) ?? "workflow pending",
        `Locale ${asBoolean(promptValidation.localeResolved) ? "resolved" : "pending"}`,
        `Variables ${asBoolean(promptValidation.unresolvedVariables) ? "open" : "closed"}`
      ]
    };
  });
  const history = (historyRows?.recordset ?? []).map((row) => ({
    createdAt: row.CreatedAt.toISOString(),
    previousState: row.PreviousState,
    newState: row.NewState,
    reason: row.Reason,
    attempt: row.Attempt,
    workerName: row.WorkerName,
    agentName: row.AgentName,
    providerName: row.ProviderName,
    modelName: row.ModelName,
    errorDetails: toStringArray(asObject(parseJson(row.ErrorDetailsJson ?? null)).errors).concat(
      toStringArray(asObject(parseJson(row.ErrorDetailsJson ?? null)).defects)
    ).slice(0, 4)
  }));
  const reclaimEvents = history
    .filter((entry) => entry.attempt > 0 || /revis|retry|reclaim|lease|timeout/i.test(`${entry.reason ?? ""} ${entry.newState}`))
    .slice(0, 6)
    .map((entry) => ({
      createdAt: entry.createdAt,
      state: entry.newState,
      reason: entry.reason,
      attempt: entry.attempt
    }));
  const scoringRationale = unique([
    ...toStringArray(review.audit),
    ...toStringArray(asObject(review.quality).highlights),
    ...toStringArray(asObject(review.quality).warnings),
    ...toStringArray(review.defects)
  ]).slice(0, 8);

  return {
    productionId,
    queue: {
      jobId: job?.ImageGenerationJobId ?? null,
      state: job?.State ?? "Unavailable",
      workerName: job?.WorkerName ?? null,
      claimedAt: job?.ClaimedAt ? job.ClaimedAt.toISOString() : null,
      leaseExpiresAt: job?.LeaseExpiresAt ? job.LeaseExpiresAt.toISOString() : null,
      workerHeartbeatAt: job?.WorkerHeartbeatAt ? job.WorkerHeartbeatAt.toISOString() : null,
      technicalValidationStatus: job?.TechnicalValidationStatus ?? null,
      storageResult: job?.StorageResult ?? null,
      model: job?.ModelName ?? asOptionalString(router.model),
      provider: job?.ProviderName ?? asOptionalString(router.provider),
      workflow: asOptionalString(router.workflow)
    },
    operational: {
      leaseRisk: leaseRiskLabel(leaseRemainingSeconds, heartbeatLagSeconds, job?.State ?? "Unavailable"),
      leaseRemainingSeconds,
      heartbeatLagSeconds,
      reclaimCount: Math.max(...history.map((entry) => entry.attempt), 0),
      reclaimEvents,
      providerHealth: [
        ["Reachable", asBoolean(providerHealth.reachable) === null ? null : asBoolean(providerHealth.reachable) ? "Yes" : "No"],
        ["Model loaded", asBoolean(providerHealth.modelLoaded) === null ? null : asBoolean(providerHealth.modelLoaded) ? "Yes" : "No"],
        ["Base URL", asOptionalString(providerHealth.baseUrl)],
        ["Endpoint", asOptionalString(providerHealth.endpoint)],
        ["Latency", typeof providerHealth.latencyMs === "number" ? `${providerHealth.latencyMs} ms` : null]
      ]
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
        .map(([label, value]) => ({ label, value })),
      degradedRouting: asBoolean(providerHealth.reachable) === false || asBoolean(providerHealth.modelLoaded) === false,
      routingDecisionReason: asOptionalString(router.reason),
      scoringRationale
    },
    request: {
      requestId: request?.VisualGenerationRequestId ?? null,
      status: request?.Status ?? "Unavailable",
      sceneKey: request?.SceneKey ?? null,
      assetType: request?.AssetType ?? null,
      purpose: request?.Purpose ?? null,
      priority: request?.Priority ?? null,
      briefHash: request?.BriefHash ?? null,
      storyboardVersionLabel: asOptionalString(requestContext.storyboardVersionLabel),
      storyboardSceneId: asOptionalString(requestContext.sceneId),
      storyboardShotId: asOptionalString(requestContext.shotId),
      targetAssetCount: typeof requestContext.targetAssetCount === "number" ? requestContext.targetAssetCount : null,
      routedAssetId: asOptionalString(requestContext.routedAssetId),
      updatedAt: request?.UpdatedAt ? request.UpdatedAt.toISOString() : null
    },
    brief: {
      briefId: brief?.VisualBriefId ?? null,
      status: brief?.Status ?? "Unavailable",
      currentVersion: brief?.CurrentVersion ?? null,
      required: unique(parseJsonArray(brief?.RequiredElementsJson ?? null).filter((item): item is string => typeof item === "string")).slice(0, 8),
      prohibited: unique(parseJsonArray(brief?.ProhibitedElementsJson ?? null).filter((item): item is string => typeof item === "string")).slice(0, 8),
      evidence: unique([
        ...((asObject(parseJson(brief?.EvidenceJson ?? null)).references as unknown[]) ?? []).filter((item): item is string => typeof item === "string"),
        asOptionalString(asObject(parseJson(brief?.EvidenceJson ?? null)).localeProfile ? "Locale profile resolved" : null)
      ]),
      updatedAt: brief?.UpdatedAt ? brief.UpdatedAt.toISOString() : null,
      versions: briefVersions
    },
    prompt: {
      promptId: prompt?.VisualPromptId ?? null,
      currentVersion: prompt?.CurrentVersion ?? null,
      canonicalPrompt: prompt?.CanonicalPrompt ?? null,
      modelSpecificPrompt: prompt?.ModelSpecificPrompt ?? null,
      negativePrompt: prompt?.NegativePrompt ?? null,
      unresolvedVariables: asBoolean(validation.unresolvedVariables),
      localeResolved: asBoolean(validation.localeResolved),
      workflow: asOptionalString(validation.workflow),
      updatedAt: prompt?.UpdatedAt ? prompt.UpdatedAt.toISOString() : null,
      versions: promptVersions
    },
    routing: {
      status: asString(routing.status, "Unavailable"),
      storyboard: asString(routing.storyboard, "pending"),
      assetLibrary: asString(routing.assetLibrary, "pending"),
      videoStudio: asString(routing.videoStudio, "pending"),
      targetSceneId: asOptionalString(routing.targetSceneId),
      targetShotId: asOptionalString(routing.targetShotId),
      approvedAssetId: selectedAssetId,
      approvedAssetUrl: asOptionalString(approvedAsset.assetUrl),
      updatedAt: asOptionalString(routing.updatedAt),
      audit: [
        ["Provider", job?.ProviderName ?? asOptionalString(router.provider)],
        ["Model", job?.ModelName ?? asOptionalString(router.model)],
        ["Workflow", asOptionalString(router.workflow)],
        ["Selection score", typeof review.score === "number" ? `${review.score}%` : null],
        ["Storyboard route", asOptionalString(routing.storyboard)],
        ["Asset library", asOptionalString(routing.assetLibrary)],
        ["Video studio", asOptionalString(routing.videoStudio)],
        ["Approved asset", selectedAssetId]
      ]
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
        .map(([label, value]) => ({ label, value }))
    },
    candidates: candidateRows.recordset.map((row) => ({
      variantLabel: `Variant ${row.VariantNumber}`,
      state: row.State,
      qualityScore: row.QualityScore ?? null,
      browserLoadStatus: row.BrowserLoadStatus ?? "pending",
      selected: Boolean(selectedAssetId && row.ImageGenerationAssetId === selectedAssetId),
      assetId: row.ImageGenerationAssetId ?? null,
      qualityPassed: typeof asObject(parseJson(row.QualitySummaryJson ?? null)).passed === "boolean" ? Boolean(asObject(parseJson(row.QualitySummaryJson ?? null)).passed) : null,
      qualityDefects: toStringArray(asObject(parseJson(row.QualitySummaryJson ?? null)).defects).slice(0, 4),
      technicalStatus: row.TechnicalValidationStatus ?? null,
      technicalReasons: unique([
        ...toStringArray(asObject(parseJson(row.TechnicalValidationJson ?? null)).reasons),
        ...toStringArray(asObject(parseJson(row.QualitySummaryJson ?? null)).audit)
      ]).slice(0, 4)
    })),
    history
  };
}

function buildModeCollectionItem(
  mode: VisualInfraMode,
  production: VisualInfraProduction,
  detail: VisualInfraProductionDetail
): VisualInfraModeCollectionItem {
  switch (mode) {
    case "generation-queue":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: production.queue.queueState,
        emphasis: `${production.queue.pendingVariants} pending · ${production.queue.completedVariants} completed · ${production.queue.failedVariants} failed`,
        detail: `Request ${detail.request.status} · target ${detail.request.targetAssetCount ?? 0} asset(s) · shot ${detail.request.storyboardShotId ?? "pending"}`,
        chips: [
          `Active ${production.queue.activeVariantLabel ?? "variant pending"}`,
          `Browser verified ${production.queue.browserVerifiedVariants}`,
          detail.request.assetType ?? "asset type pending",
          detail.routing.storyboard
        ],
        metricLabel: "Queue depth",
        metricValue: `${production.queue.pendingVariants}`
      };
    case "visual-brief-resolver":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: detail.brief.status,
        emphasis: `${production.briefResolver.scene} · ${production.briefResolver.subject}`,
        detail: `Brief ${detail.brief.currentVersion ? `v${detail.brief.currentVersion}` : "pending"} · shot ${detail.request.storyboardShotId ?? "pending"} · version ${detail.request.storyboardVersionLabel ?? "pending"}`,
        chips: [
          ...production.briefResolver.requiredAssetTypes.slice(0, 2),
          ...detail.brief.required.slice(0, 2)
        ],
        metricLabel: "Requirements",
        metricValue: `${detail.brief.required.length}`
      };
    case "prompt-intelligence":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: detail.prompt.currentVersion ? `Prompt v${detail.prompt.currentVersion}` : "Prompt pending",
        emphasis: truncate(detail.prompt.modelSpecificPrompt ?? detail.prompt.canonicalPrompt ?? production.promptIntelligence.prompt, 132),
        detail: `Workflow ${detail.prompt.workflow ?? "pending"} · unresolved variables ${detail.prompt.unresolvedVariables ? "yes" : "no"} · locale ${detail.prompt.localeResolved ? "resolved" : "pending"}`,
        chips: [
          ...detail.brief.required.slice(0, 2).map((item) => `Need ${item}`),
          ...detail.brief.prohibited.slice(0, 2).map((item) => `Block ${item}`)
        ],
        metricLabel: "Prompt guards",
        metricValue: `${detail.brief.required.length + detail.brief.prohibited.length}`
      };
    case "regional-visual-intelligence":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: "Regional profile resolved",
        emphasis: `${production.regional.country} · ${production.regional.region} · ${production.regional.city}`,
        detail: `${production.regional.environment} · ${production.regional.infrastructure}`,
        chips: [...production.regional.culturalNotes.slice(0, 2), ...production.regional.stereotypeAvoidance.slice(0, 2).map((item) => `Avoid ${item}`)],
        metricLabel: "Safeguards",
        metricValue: `${production.regional.culturalNotes.length + production.regional.stereotypeAvoidance.length}`
      };
    case "model-and-workflow-manager":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: detail.routing.status,
        emphasis: `${production.workflow.provider} · ${production.workflow.model}`,
        detail: `${production.workflow.selectionMethod} · target ${detail.routing.targetShotId ?? "pending"} · video ${detail.routing.videoStudio}`,
        chips: [
          production.workflow.selectedVariant ?? "selected variant pending",
          detail.routing.storyboard,
          detail.routing.assetLibrary,
          detail.routing.videoStudio
        ],
        metricLabel: "Selected score",
        metricValue: detailMetricValue(production.workflow.selectedQualityScore, "%")
      };
    case "reference-conditioning":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: production.referenceConditioning.conditioningMode,
        emphasis: truncate(production.referenceConditioning.references.join(" · ") || "Brief-only conditioning", 132),
        detail: `${production.referenceConditioning.characterReferences.length} character refs · ${production.referenceConditioning.sceneReferences.length} scene refs`,
        chips: [
          ...production.referenceConditioning.characterReferences.slice(0, 2).map((item) => `Character ${item}`),
          ...production.referenceConditioning.sceneReferences.slice(0, 2).map((item) => `Scene ${item}`)
        ],
        metricLabel: "References",
        metricValue: `${production.referenceConditioning.references.length}`
      };
    case "image-repair-and-enhancement":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: production.repair.issueTitles.length || production.repair.integrityWarnings.length ? "Repair required" : "Clear",
        emphasis: truncate(production.repair.nextRepairAction ?? "No repair action is currently required.", 132),
        detail: `${production.repair.issueTitles.length} issue(s) · ${production.repair.integrityWarnings.length} integrity warning(s) · ${production.repair.failedVariants.length} failed variant(s)`,
        chips: [
          ...production.repair.failedVariants.slice(0, 2).map((item) => `Failed ${item}`),
          ...production.repair.integrityWarnings.slice(0, 2)
        ],
        metricLabel: "Repair backlog",
        metricValue: `${production.repair.issueTitles.length + production.repair.integrityWarnings.length}`
      };
    case "rights-and-provenance":
      return {
        productionId: production.id,
        code: production.code,
        title: production.title,
        state: production.state,
        priority: production.priority,
        updatedAt: production.updatedAt,
        status: production.rights.provenanceStatus,
        emphasis: production.rights.assetId ?? "Approved asset pending",
        detail: `${production.rights.providerModel} · load ${production.rights.browserLoadStatus} · routed asset ${detail.routing.approvedAssetId ?? "pending"}`,
        chips: [
          production.rights.mimeType ?? "mime pending",
          detail.routing.storyboard,
          detail.routing.assetLibrary,
          detail.routing.videoStudio
        ],
        metricLabel: "Checksum",
        metricValue: production.rights.checksum ? truncate(production.rights.checksum, 14) : "Pending"
      };
  }
}

async function persistManifests(pool: sql.ConnectionPool, productionId: string, manifests: Omit<VisualInfraProduction, "id" | "code" | "title" | "state" | "priority" | "updatedAt" | "qualityScore">, currentMetadata: string | null) {
  const metadata = parseJson(currentMetadata);
  const merged = {
    ...metadata,
    visualStudioInfra: {
      queue: manifests.queue,
      briefResolver: manifests.briefResolver,
      promptIntelligence: manifests.promptIntelligence,
      regionalVisualIntelligence: manifests.regional,
      modelAndWorkflowManager: manifests.workflow,
      referenceConditioning: manifests.referenceConditioning,
      imageRepairAndEnhancement: manifests.repair,
      rightsAndProvenance: manifests.rights
    }
  };
  await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query("UPDATE cacsms.Productions SET MetadataJson=@metadata WHERE CONVERT(nvarchar(36), ProductionId)=@production;");
}

export async function getVisualStudioInfrastructureData(): Promise<VisualInfraPayload> {
  const [imagePayload, assetRequirementPayload, scriptIntelligencePayload, pool] = await Promise.all([
    getImageGeneratorData(),
    getAssetRequirementsWorkspaceData(),
    getScriptIntelligenceWorkspaceData(),
    getMssqlPool()
  ]);

  const assetMap = new Map(assetRequirementPayload.productions.map((item) => [item.id, item]));
  const scriptMap = new Map(scriptIntelligencePayload.productions.map((item) => [item.id, item]));
  const metadataMap = await metadataByProduction(pool, imagePayload.productions.map((item) => item.id));

  const productions: VisualInfraProduction[] = [];
  for (const production of imagePayload.productions) {
    const assetRequirements = assetMap.get(production.id);
    const scriptIntelligence = scriptMap.get(production.id);
    const manifests = {
      queue: queueManifest(production),
      briefResolver: briefManifest(production, assetRequirements, scriptIntelligence),
      promptIntelligence: promptManifest(production),
      regional: regionalManifest(production),
      workflow: workflowManifest(production, imagePayload),
      referenceConditioning: referenceManifest(production, assetRequirements, scriptIntelligence),
      repair: repairManifest(production),
      rights: rightsManifest(production)
    };
    await persistManifests(pool, production.id, manifests, metadataMap.get(production.id) ?? null);
    productions.push({
      id: production.id,
      code: production.code,
      title: production.title,
      state: production.state,
      priority: production.priority,
      updatedAt: production.updatedAt,
      qualityScore: Math.round(
        (production.quality.brief +
          production.quality.brand +
          production.quality.composition +
          production.quality.technical +
          production.quality.originality +
          production.quality.safety) / 6
      ),
      ...manifests
    });
  }

  return {
    generatedAt: imagePayload.generatedAt,
    productions,
    summary: {
      total: productions.length,
      active: imagePayload.summary.active,
      approved: imagePayload.summary.approved,
      queueDepth: imagePayload.summary.queueDepth,
      averageQuality: imagePayload.summary.averageQuality
    }
  };
}

export async function getVisualStudioInfrastructureProductionDetail(productionId: string): Promise<VisualInfraProductionDetail> {
  const pool = await getMssqlPool();
  return loadVisualProductionDetail(pool, productionId);
}

export async function getVisualStudioInfrastructureModeCollection(mode: VisualInfraMode): Promise<VisualInfraModeCollectionPayload> {
  const payload = await getVisualStudioInfrastructureData();
  const pool = await getMssqlPool();
  const details = await Promise.all(payload.productions.map((production) => loadVisualProductionDetail(pool, production.id)));
  const detailMap = new Map(details.map((detail) => [detail.productionId, detail]));
  const items = payload.productions
    .map((production) => {
      const detail = detailMap.get(production.id);
      return detail ? buildModeCollectionItem(mode, production, detail) : null;
    })
    .filter((item): item is VisualInfraModeCollectionItem => Boolean(item));
  return {
    mode,
    generatedAt: payload.generatedAt,
    summary: {
      total: items.length,
      ready: items.filter((item) => /approved|verified|resolved|clear|ready|tracked/i.test(item.status)).length,
      blocked: items.filter((item) => /blocked|failed|repair|required|pending asset integrity/i.test(item.status)).length,
      pending: items.filter((item) => /queued|waiting|pending|unavailable/i.test(item.status)).length
    },
    items
  };
}
