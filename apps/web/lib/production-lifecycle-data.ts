<<<<<<< Updated upstream
import sql from "mssql";
import {
  lifecycleStageValidationRules,
  productionLifecycleStages,
  resolveLifecycleStage,
  type WorkflowStage
} from "@cacsms/contracts";
import { getMssqlPool } from "@/lib/database/mssql";

export type LifecycleStageStatus = {
  id: WorkflowStage;
  count: number;
  statusLabel: string;
  trend: "up" | "stable" | "down";
};

export type LifecycleQueueItem = {
  id: string;
  title: string;
  entityType: "opportunity" | "production" | "signal" | "job" | "record";
  lifecycleStage: WorkflowStage;
  orchestratorStage: string | null;
  opportunityState: string | null;
  status: string;
  progress: number;
  updatedAt: string;
  href: string | null;
};

export type LifecycleSettings = {
  autoAdvanceEnabled: boolean;
  manualApprovalRequired: boolean;
  updatedAt: string | null;
};

export type ProductionCentricItem = {
  opportunityId: string | null;
  opportunityTitle: string | null;
  opportunityLifecycleStage: WorkflowStage | null;
  productionId: string | null;
  productionTitle: string | null;
  productionOrchestratorStage: string | null;
  productionLifecycleStage: WorkflowStage | null;
  linked: boolean;
  updatedAt: string;
};

export type LifecycleStatusPayload = {
  stages: LifecycleStageStatus[];
  settings: LifecycleSettings;
  productionCentric: ProductionCentricItem[];
  generatedAt: string;
};

async function activeWorkspaceId(pool: sql.ConnectionPool): Promise<string> {
  const result = await pool.request().query<{ WorkspaceId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt`
  );
  const id = result.recordset[0]?.WorkspaceId;
  if (!id) throw new Error("No active workspace configured.");
  return id;
}

function formatStatusLabel(stage: WorkflowStage, count: number): string {
  const labels: Record<WorkflowStage, [string, string]> = {
    discover: ["New", "New"],
    research: ["In Progress", "In Progress"],
    evaluate: ["High Priority", "High Priority"],
    "pre-plan": ["Ready", "Ready"],
    schedule: ["Scheduled", "Scheduled"],
    produce: ["Active", "Active"],
    assemble: ["In Progress", "In Progress"],
    quality: ["In Review", "In Review"],
    export: ["Exporting", "Exporting"],
    publish: ["Today", "Today"],
    monitor: ["Monitoring", "Monitoring"],
    learn: ["Learning", "Learning"],
    repeat: ["Auto Loop", "Auto Loop"]
  };
  const [singular, plural] = labels[stage];
  if (count === 0) return `0 ${singular}`;
  if (stage === "learn") return count === 1 ? "AI Learning" : `${count} Learning`;
  if (stage === "repeat") return count === 0 ? "Auto Loop" : `${count} Loops`;
  if (stage === "publish" && count > 0) return count === 1 ? "1 Today" : `${count} Today`;
  return `${count} ${count === 1 ? singular : plural.replace("In Progress", "In Progress")}`;
}

export async function getLifecycleSettings(): Promise<LifecycleSettings> {
  const pool = await getMssqlPool();
  const workspaceId = await activeWorkspaceId(pool);
  const result = await pool
    .request()
    .input("workspace", sql.UniqueIdentifier, workspaceId)
    .query<{ AutoAdvanceEnabled: boolean; ManualApprovalRequired: boolean; UpdatedAt: Date | null }>(
      `SELECT AutoAdvanceEnabled, ManualApprovalRequired, UpdatedAt FROM cacsms.ProductionLifecycleSettings WHERE WorkspaceId=@workspace`
    );
  const row = result.recordset[0];
  if (!row) {
    return { autoAdvanceEnabled: true, manualApprovalRequired: false, updatedAt: null };
  }
  return {
    autoAdvanceEnabled: Boolean(row.AutoAdvanceEnabled),
    manualApprovalRequired: Boolean(row.ManualApprovalRequired),
    updatedAt: row.UpdatedAt?.toISOString() ?? null
  };
}

export async function saveLifecycleSettings(settings: Partial<LifecycleSettings>): Promise<LifecycleSettings> {
  const pool = await getMssqlPool();
  const workspaceId = await activeWorkspaceId(pool);
  await pool
    .request()
    .input("workspace", sql.UniqueIdentifier, workspaceId)
    .input("autoAdvance", sql.Bit, settings.autoAdvanceEnabled ?? true)
    .input("manualApproval", sql.Bit, settings.manualApprovalRequired ?? false)
    .query(`
      IF NOT EXISTS(SELECT 1 FROM cacsms.ProductionLifecycleSettings WHERE WorkspaceId=@workspace)
        INSERT cacsms.ProductionLifecycleSettings(WorkspaceId,AutoAdvanceEnabled,ManualApprovalRequired) VALUES(@workspace,@autoAdvance,@manualApproval);
      ELSE
        UPDATE cacsms.ProductionLifecycleSettings SET AutoAdvanceEnabled=@autoAdvance,ManualApprovalRequired=@manualApproval,UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace;
    `);
  return getLifecycleSettings();
}

export async function getLifecycleStatus(): Promise<LifecycleStatusPayload> {
  const pool = await getMssqlPool();
  const workspaceId = await activeWorkspaceId(pool);

  const counts = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(`
    SELECT
      (SELECT COUNT(*) FROM cacsms.OpportunitySignals WHERE WorkspaceId=@workspace AND State IN(N'new',N'discovered',N'watchlisted')) discoverCount,
      (SELECT COUNT(*) FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND Status IN(N'researching',N'discovered') AND IsArchived=0) researchOppCount,
      (SELECT COUNT(*) FROM cacsms.ContentIntelligenceRecords WHERE WorkspaceId=@workspace AND PageSlug IN(N'research-workspace',N'source-analysis',N'fact-verification') AND Status IN(N'active',N'in-progress',N'open')) researchCiCount,
      (SELECT COUNT(*) FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND IsHighPriority=1 AND IsArchived=0) evaluateCount,
      (SELECT COUNT(*) FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug IN(N'scoring-engine',N'editorial-board',N'executive-recommendations') AND Status NOT IN(N'archived',N'rejected')) evaluateOpCount,
      (SELECT COUNT(*) FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug IN(N'multi-format-planner',N'campaign-builder',N'template-dashboard') AND Status IN(N'ready',N'Auto-approved',N'Auto-certified')) prePlanCount,
      (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Status IN(N'draft',N'queued') AND Stage IN(N'discover',N'pre-plan')) prePlanProdCount,
      (SELECT COUNT(*) FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=N'opportunity-scheduler' AND DueAt IS NOT NULL) scheduleOpCount,
      (SELECT COUNT(*) FROM cacsms.CalendarEvents WHERE WorkspaceId=@workspace AND Status IN(N'scheduled',N'in-progress') AND StartsAt>=SYSUTCDATETIME()) scheduleCalCount,
      (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Stage IN(N'scripting',N'storyboard',N'visual-generation',N'audio-generation') AND Status IN(N'active',N'queued')) produceCount,
      (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Stage=N'assembly' AND Status IN(N'active',N'queued')) assembleCount,
      (SELECT COUNT(*) FROM cacsms.RenderingJobs r JOIN cacsms.Productions p ON p.ProductionId=r.ProductionId WHERE p.WorkspaceId=@workspace AND r.Status IN(N'running',N'queued')) assembleRenderCount,
      (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Stage=N'quality-assurance' AND Status IN(N'in-review',N'active')) qualityCount,
      (SELECT COUNT(*) FROM cacsms.RenderingJobs r JOIN cacsms.Productions p ON p.ProductionId=r.ProductionId WHERE p.WorkspaceId=@workspace AND r.Status IN(N'running',N'completed') AND r.Progress<100) exportCount,
      (SELECT COUNT(*) FROM cacsms.PublishingJobs j JOIN cacsms.Productions p ON p.ProductionId=j.ProductionId WHERE p.WorkspaceId=@workspace AND j.Status IN(N'publishing',N'scheduled',N'queued')) publishCount,
      (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Status IN(N'published',N'completed') AND PublishedAt>=CAST(SYSUTCDATETIME() AS date)) monitorCount,
      (SELECT COUNT(*) FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=N'learning-engine') learnCount,
      (SELECT COUNT(*) FROM cacsms.ProductionOrchestrationSettings WHERE WorkspaceId=@workspace AND Enabled=1) repeatCount
  `);

  const c = counts.recordset[0] as Record<string, number>;
  const stageCounts: Record<WorkflowStage, number> = {
    discover: Number(c.discoverCount ?? 0),
    research: Number(c.researchOppCount ?? 0) + Number(c.researchCiCount ?? 0),
    evaluate: Number(c.evaluateCount ?? 0) + Number(c.evaluateOpCount ?? 0),
    "pre-plan": Number(c.prePlanCount ?? 0) + Number(c.prePlanProdCount ?? 0),
    schedule: Number(c.scheduleOpCount ?? 0) + Number(c.scheduleCalCount ?? 0),
    produce: Number(c.produceCount ?? 0),
    assemble: Number(c.assembleCount ?? 0) + Number(c.assembleRenderCount ?? 0),
    quality: Number(c.qualityCount ?? 0),
    export: Number(c.exportCount ?? 0),
    publish: Number(c.publishCount ?? 0),
    monitor: Number(c.monitorCount ?? 0),
    learn: Number(c.learnCount ?? 0),
    repeat: Number(c.repeatCount ?? 0)
  };

  const stages: LifecycleStageStatus[] = productionLifecycleStages.map((stage) => ({
    id: stage.id,
    count: stageCounts[stage.id],
    statusLabel: formatStatusLabel(stage.id, stageCounts[stage.id]),
    trend: stageCounts[stage.id] > 0 ? "up" : "stable"
  }));

  const productionCentric = await getProductionCentricView(pool, workspaceId);
  const settings = await getLifecycleSettings();

  return {
    stages,
    settings,
    productionCentric,
    generatedAt: new Date().toISOString()
  };
}

async function getProductionCentricView(
  pool: sql.ConnectionPool,
  workspaceId: string
): Promise<ProductionCentricItem[]> {
  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(`
    SELECT TOP(20)
      CONVERT(nvarchar(36), o.OpportunityId) opportunityId,
      o.Title opportunityTitle,
      o.Status opportunityState,
      CONVERT(nvarchar(36), p.ProductionId) productionId,
      p.Title productionTitle,
      p.Stage orchestratorStage,
      CONVERT(nvarchar(40), COALESCE(p.UpdatedAt, o.UpdatedAt), 127) updatedAt
    FROM cacsms.Opportunities o
    LEFT JOIN cacsms.Productions p ON p.AutonomousSourceRecordId IN (
      SELECT RecordId FROM cacsms.OpportunityOperationalRecords r
      WHERE r.WorkspaceId=@workspace AND TRY_CONVERT(uniqueidentifier, JSON_VALUE(r.MetadataJson, '$.sourceOpportunityId'))=o.OpportunityId
    )
    WHERE o.WorkspaceId=@workspace AND o.IsArchived=0
    ORDER BY COALESCE(p.UpdatedAt, o.UpdatedAt) DESC
  `);

  return result.recordset.map((row) => {
    const orchestratorStage = row.productionId ? String(row.orchestratorStage) : null;
    const opportunityState = row.opportunityId ? String(row.opportunityState) : null;
    return {
      opportunityId: row.opportunityId ? String(row.opportunityId) : null,
      opportunityTitle: row.opportunityTitle ? String(row.opportunityTitle) : null,
      opportunityLifecycleStage: opportunityState
        ? resolveLifecycleStage({ opportunityState })
        : null,
      productionId: row.productionId ? String(row.productionId) : null,
      productionTitle: row.productionTitle ? String(row.productionTitle) : null,
      productionOrchestratorStage: orchestratorStage,
      productionLifecycleStage: orchestratorStage
        ? resolveLifecycleStage({ orchestratorStage })
        : null,
      linked: Boolean(row.productionId && row.opportunityId),
      updatedAt: String(row.updatedAt)
    };
  });
}

export async function getLifecycleQueue(stageId: WorkflowStage): Promise<LifecycleQueueItem[]> {
  const pool = await getMssqlPool();
  const workspaceId = await activeWorkspaceId(pool);

  const queries: Partial<Record<WorkflowStage, string>> = {
    discover: `
      SELECT TOP(15) CONVERT(nvarchar(36), SignalId) id, Subject title, N'signal' entityType, State status, SignalScore progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.OpportunitySignals WHERE WorkspaceId=@workspace ORDER BY UpdatedAt DESC`,
    research: `
      SELECT TOP(15) CONVERT(nvarchar(36), OpportunityId) id, Title title, N'opportunity' entityType, Status status, OpportunityScore progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND Status IN(N'researching',N'discovered') AND IsArchived=0 ORDER BY UpdatedAt DESC`,
    evaluate: `
      SELECT TOP(15) CONVERT(nvarchar(36), OpportunityId) id, Title title, N'opportunity' entityType, Status status, OpportunityScore progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND IsHighPriority=1 AND IsArchived=0 ORDER BY OpportunityScore DESC`,
    "pre-plan": `
      SELECT TOP(15) CONVERT(nvarchar(36), RecordId) id, Title title, N'record' entityType, Status status, ISNULL(Progress,0) progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug IN(N'multi-format-planner',N'campaign-builder') ORDER BY UpdatedAt DESC`,
    schedule: `
      SELECT TOP(15) CONVERT(nvarchar(36), RecordId) id, Title title, N'record' entityType, Status status, ISNULL(Progress,0) progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=N'opportunity-scheduler' ORDER BY DueAt ASC`,
    produce: `
      SELECT TOP(15) CONVERT(nvarchar(36), ProductionId) id, Title title, N'production' entityType, Status status, Progress progress, Stage orchestratorStage, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Stage IN(N'scripting',N'storyboard',N'visual-generation',N'audio-generation') ORDER BY UpdatedAt DESC`,
    assemble: `
      SELECT TOP(15) CONVERT(nvarchar(36), p.ProductionId) id, p.Title title, N'production' entityType, p.Status status, p.Progress progress, p.Stage orchestratorStage, CONVERT(nvarchar(40), p.UpdatedAt, 127) updatedAt
      FROM cacsms.Productions p WHERE p.WorkspaceId=@workspace AND p.Stage=N'assembly' ORDER BY p.UpdatedAt DESC`,
    quality: `
      SELECT TOP(15) CONVERT(nvarchar(36), ProductionId) id, Title title, N'production' entityType, Status status, Progress progress, Stage orchestratorStage, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Stage=N'quality-assurance' ORDER BY UpdatedAt DESC`,
    export: `
      SELECT TOP(15) CONVERT(nvarchar(36), r.RenderingJobId) id, ISNULL(r.AssetName,p.Title) title, N'job' entityType, r.Status status, r.Progress progress, CONVERT(nvarchar(40), r.UpdatedAt, 127) updatedAt
      FROM cacsms.RenderingJobs r JOIN cacsms.Productions p ON p.ProductionId=r.ProductionId WHERE p.WorkspaceId=@workspace ORDER BY r.UpdatedAt DESC`,
    publish: `
      SELECT TOP(15) CONVERT(nvarchar(36), j.PublishingJobId) id, CONCAT(p.Title, N' · ', j.Channel) title, N'job' entityType, j.Status status, 0 progress, CONVERT(nvarchar(40), j.UpdatedAt, 127) updatedAt
      FROM cacsms.PublishingJobs j JOIN cacsms.Productions p ON p.ProductionId=j.ProductionId WHERE p.WorkspaceId=@workspace ORDER BY j.UpdatedAt DESC`,
    monitor: `
      SELECT TOP(15) CONVERT(nvarchar(36), ProductionId) id, Title title, N'production' entityType, Status status, Progress progress, Stage orchestratorStage, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.Productions WHERE WorkspaceId=@workspace AND Status IN(N'published',N'completed') ORDER BY PublishedAt DESC`,
    learn: `
      SELECT TOP(15) CONVERT(nvarchar(36), RecordId) id, Title title, N'record' entityType, Status status, ISNULL(Progress,0) progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=N'learning-engine' ORDER BY UpdatedAt DESC`,
    repeat: `
      SELECT TOP(15) CONVERT(nvarchar(36), OpportunityId) id, Title title, N'opportunity' entityType, Status status, OpportunityScore progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND IsArchived=0 ORDER BY UpdatedAt DESC`
  };

  const query = queries[stageId];
  if (!query) return [];

  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(query);
  return result.recordset.map((row) => {
    const entityType = String(row.entityType) as LifecycleQueueItem["entityType"];
    const orchestratorStage = row.orchestratorStage ? String(row.orchestratorStage) : null;
    const href =
      entityType === "production"
        ? `/production-studio/all-productions`
        : entityType === "opportunity"
          ? `/opportunity-intelligence/opportunity-dashboard`
          : entityType === "signal"
            ? `/opportunity-intelligence/discovery-engine`
            : null;
    return {
      id: String(row.id),
      title: String(row.title),
      entityType,
      lifecycleStage: stageId,
      orchestratorStage,
      opportunityState: entityType === "opportunity" ? String(row.status) : null,
      status: String(row.status),
      progress: Number(row.progress ?? 0),
      updatedAt: String(row.updatedAt),
      href
    };
  });
}

export async function markLifecycleStageReady(input: {
  stageId: WorkflowStage;
  entityType?: string;
  entityId?: string;
  checks: string[];
  userId?: string | null;
  message?: string;
}): Promise<{ status: "ready" | "blocked"; validationErrors: string[] }> {
  const rules = lifecycleStageValidationRules[input.stageId];
  const validationErrors: string[] = [];
  if (!rules) validationErrors.push("Unknown lifecycle stage.");
  else {
    for (const check of rules.requiredChecks) {
      if (!input.checks.includes(check)) validationErrors.push(`Missing required check: ${check}`);
    }
    const queue = await getLifecycleQueue(input.stageId);
    if (rules.minCount && input.entityId && queue.length < rules.minCount) {
      validationErrors.push(`Stage requires at least ${rules.minCount} active item(s).`);
    }
  }
  if (validationErrors.length) return { status: "blocked", validationErrors };

  const pool = await getMssqlPool();
  const workspaceId = await activeWorkspaceId(pool);
  const settings = await getLifecycleSettings();
  if (settings.manualApprovalRequired && !input.userId) {
    return { status: "blocked", validationErrors: ["Manual approval requires an authenticated user."] };
  }

  await pool
    .request()
    .input("workspace", sql.UniqueIdentifier, workspaceId)
    .input("stage", sql.NVarChar(50), input.stageId)
    .input("entityType", sql.NVarChar(50), input.entityType ?? "workspace")
    .input("entityId", sql.UniqueIdentifier, input.entityId ?? null)
    .input("status", sql.NVarChar(30), "ready")
    .input("checks", sql.NVarChar(sql.MAX), JSON.stringify(input.checks))
    .input("userId", sql.UniqueIdentifier, input.userId ?? null)
    .input("message", sql.NVarChar(1000), (input.message ?? `Stage ${input.stageId} marked ready.`).slice(0, 1000))
    .query(`
      INSERT cacsms.ProductionLifecycleStageCompletions(WorkspaceId,LifecycleStage,EntityType,EntityId,Status,ValidatedChecksJson,CompletedByUserId,Message)
      VALUES(@workspace,@stage,@entityType,@entityId,@status,@checks,@userId,@message)
    `);

  if (input.entityType === "production" && input.entityId) {
    await pool
      .request()
      .input("production", sql.UniqueIdentifier, input.entityId)
      .input("stage", sql.NVarChar(100), input.stageId)
      .input("message", sql.NVarChar(1000), input.message ?? `Lifecycle stage ${input.stageId} marked ready.`)
      .query(`
        UPDATE cacsms.ProductionStageHistory SET ExitedAt=SYSUTCDATETIME() WHERE ProductionId=@production AND ExitedAt IS NULL;
        INSERT cacsms.ProductionStageHistory(ProductionId,Stage,Status,Progress,Message) VALUES(@production,@stage,N'approved',100,@message);
      `);
  }

  return { status: "ready", validationErrors: [] };
}

export async function isAutoAdvanceEnabled(): Promise<boolean> {
  const settings = await getLifecycleSettings();
  return settings.autoAdvanceEnabled;
}
=======
import fs from "node:fs/promises";
import path from "node:path";
import sql from "mssql";
import {
  productionLifecycleStages,
  type WorkflowStage
} from "@cacsms/contracts";
import { getMssqlPool } from "@/lib/database/mssql";
import { getActiveProductionsData } from "@/lib/active-productions-data";
import { getDiscoveryData, getOpportunityDashboard } from "@/lib/opportunity-intelligence-data";
import type {
  LifecycleChecklistItem,
  LifecycleStageStatus,
  ProductionLifecycleSettings,
  ProductionLifecycleSnapshot
} from "@/types/production-lifecycle";

const checklistItems: LifecycleChecklistItem[] = [
  "required-work-completed",
  "validation-checks-passed",
  "exceptions-resolved",
  "stage-output-recorded",
  "next-stage-ready"
];

const dataDirectory = path.join(process.cwd(), ".data");
const settingsPath = path.join(dataDirectory, "production-lifecycle.json");

function defaultStageState() {
  return {
    checklist: {
      "required-work-completed": false,
      "validation-checks-passed": false,
      "exceptions-resolved": false,
      "stage-output-recorded": false,
      "next-stage-ready": false
    },
    ready: false,
    completedAt: null as string | null
  };
}

function defaultSettings(): ProductionLifecycleSettings {
  return {
    autoAdvance: true,
    currentStageId: "discover",
    stages: {},
    updatedAt: new Date().toISOString()
  };
}

async function readSettings(): Promise<ProductionLifecycleSettings> {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as ProductionLifecycleSettings;
    return {
      ...defaultSettings(),
      ...parsed,
      stages: parsed.stages ?? {}
    };
  } catch {
    return defaultSettings();
  }
}

async function writeSettings(settings: ProductionLifecycleSettings) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}

function stageState(settings: ProductionLifecycleSettings, stageId: WorkflowStage) {
  return settings.stages[stageId] ?? defaultStageState();
}

function fallbackCounts(): Record<WorkflowStage, { count: number | null; label: string }> {
  return productionLifecycleStages.reduce(
    (acc, stage) => {
      acc[stage.id] = { count: null, label: stage.statusLabel };
      return acc;
    },
    {} as Record<WorkflowStage, { count: number | null; label: string }>
  );
}

async function liveStageCounts(): Promise<Record<WorkflowStage, { count: number | null; label: string }>> {
  const counts = fallbackCounts();

  try {
    const [dashboard, discovery, activeProductions] = await Promise.all([
      getOpportunityDashboard(),
      getDiscoveryData(),
      getActiveProductionsData({ pageSize: 100 })
    ]);

    counts.discover = {
      count: discovery.signals.length,
      label: `${discovery.signals.length} New`
    };
    counts.research = {
      count: dashboard.opportunities.filter((item) => /research|progress|validate/i.test(item.status)).length,
      label: `${dashboard.opportunities.filter((item) => /research|progress|validate/i.test(item.status)).length} In Progress`
    };
    counts.evaluate = {
      count: dashboard.metrics.highPriority,
      label: `${dashboard.metrics.highPriority} High Priority`
    };
    counts["pre-plan"] = {
      count: dashboard.opportunities.filter((item) => /ready|pre-plan|initiative/i.test(item.status)).length,
      label: `${dashboard.opportunities.filter((item) => /ready|pre-plan|initiative/i.test(item.status)).length} Ready`
    };
    counts.schedule = {
      count: dashboard.opportunities.filter((item) => /schedul/i.test(item.status)).length || activeProductions.deadlines.length,
      label: `${dashboard.opportunities.filter((item) => /schedul/i.test(item.status)).length || activeProductions.deadlines.length} Scheduled`
    };
    counts.produce = {
      count: activeProductions.total,
      label: `${activeProductions.total} Active`
    };
    counts.assemble = {
      count: activeProductions.stageBreakdown.find((item) => /assembl|timeline/i.test(item.stage))?.count ?? 0,
      label: `${activeProductions.stageBreakdown.find((item) => /assembl|timeline/i.test(item.stage))?.count ?? 0} In Progress`
    };
    counts.quality = {
      count: activeProductions.productions.filter((item) => /review|quality/i.test(item.stage)).length,
      label: `${activeProductions.productions.filter((item) => /review|quality/i.test(item.stage)).length} In Review`
    };
    counts.export = {
      count: activeProductions.productions.filter((item) => /export|render/i.test(item.stage)).length,
      label: `${activeProductions.productions.filter((item) => /export|render/i.test(item.stage)).length} Exporting`
    };
    counts.publish = {
      count: dashboard.opportunities.filter((item) => /publish|released|today/i.test(item.status)).length,
      label: `${dashboard.opportunities.filter((item) => /publish|released|today/i.test(item.status)).length} Today`
    };
    counts.monitor = {
      count: dashboard.metrics.active,
      label: `${dashboard.metrics.active} Monitoring`
    };
    counts.learn = { count: null, label: "AI Learning" };
    counts.repeat = { count: null, label: "Auto Loop" };
  } catch (error) {
    console.error("production-lifecycle.counts.fallback", error);
    return counts;
  }

  return counts;
}

export async function getProductionLifecycleSnapshot(): Promise<ProductionLifecycleSnapshot> {
  const [settings, liveCounts] = await Promise.all([readSettings(), liveStageCounts()]);
  const source = Object.values(liveCounts).some((item) => item.count !== null) ? "live" : "fallback";

  const stages: LifecycleStageStatus[] = productionLifecycleStages.map((stage) => {
    const live = liveCounts[stage.id];
    return {
      id: stage.id,
      order: stage.order,
      label: stage.label,
      count: live.count,
      statusLabel: live.count !== null ? live.label : stage.statusLabel
    };
  });

  return {
    settings,
    stages,
    generatedAt: new Date().toISOString(),
    source
  };
}

export async function saveProductionLifecycleSettings(input: Partial<Pick<ProductionLifecycleSettings, "autoAdvance" | "currentStageId">>) {
  const settings = await readSettings();
  const next: ProductionLifecycleSettings = {
    ...settings,
    autoAdvance: input.autoAdvance ?? settings.autoAdvance,
    currentStageId: input.currentStageId ?? settings.currentStageId,
    updatedAt: new Date().toISOString()
  };
  await writeSettings(next);
  return next;
}

export async function getStageChecklist(stageId: WorkflowStage) {
  const settings = await readSettings();
  return {
    stageId,
    items: checklistItems,
    state: stageState(settings, stageId)
  };
}

export async function updateStageChecklist(stageId: WorkflowStage, checklist: Partial<Record<LifecycleChecklistItem, boolean>>) {
  const settings = await readSettings();
  const current = stageState(settings, stageId);
  const merged = {
    ...current,
    checklist: {
      ...current.checklist,
      ...checklist
    }
  };
  settings.stages[stageId] = merged;
  settings.updatedAt = new Date().toISOString();
  await writeSettings(settings);
  return merged;
}

export async function markStageReady(stageId: WorkflowStage) {
  const settings = await readSettings();
  const current = stageState(settings, stageId);
  const readyState = {
    ...current,
    checklist: checklistItems.reduce(
      (acc, item) => {
        acc[item] = true;
        return acc;
      },
      {} as Record<LifecycleChecklistItem, boolean>
    ),
    ready: true,
    completedAt: new Date().toISOString()
  };
  settings.stages[stageId] = readyState;
  settings.updatedAt = new Date().toISOString();

  const stage = productionLifecycleStages.find((item) => item.id === stageId);
  const nextStage = productionLifecycleStages.find((item) => item.order === (stage?.order ?? 0) + 1);
  if (settings.autoAdvance && nextStage) {
    settings.currentStageId = nextStage.id;
  }

  await writeSettings(settings);

  try {
    const pool = await getMssqlPool();
    await pool.request().input("stageId", sql.NVarChar(40), stageId).input("nextStageId", sql.NVarChar(40), nextStage?.id ?? stageId).query(`
      UPDATE cacsms.Productions
      SET Stage = @nextStageId, UpdatedAt = SYSUTCDATETIME()
      WHERE Status IN (N'active', N'queued', N'in-review') AND Stage = @stageId;
    `);
  } catch (error) {
    console.error("production-lifecycle.mark-ready.db-skip", error);
  }

  return {
    stageId,
    state: readyState,
    advancedTo: settings.autoAdvance ? nextStage?.id ?? null : null,
    settings
  };
}

export async function advanceOpportunityState(stageId: WorkflowStage) {
  const mapping: Partial<Record<WorkflowStage, string>> = {
    discover: "discovered",
    research: "researching",
    evaluate: "prioritized",
    "pre-plan": "preplanned",
    schedule: "scheduled",
    produce: "producing",
    publish: "published",
    learn: "learning"
  };
  const target = mapping[stageId];
  if (!target) return;

  try {
    const pool = await getMssqlPool();
    await pool.request().input("status", sql.NVarChar(40), target).query(`
      UPDATE TOP (1) cacsms.Opportunities
      SET Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE IsArchived = 0
      ORDER BY OpportunityScore DESC, CreatedAt DESC;
    `);
  } catch (error) {
    console.error("production-lifecycle.advance-opportunity.db-skip", error);
  }
}

export { checklistItems };
>>>>>>> Stashed changes
