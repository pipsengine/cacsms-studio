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
