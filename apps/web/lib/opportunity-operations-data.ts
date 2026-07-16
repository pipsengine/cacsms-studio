import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import type { OperationalMutation, OperationalPageData, OperationalRecord } from "@/types/opportunity-operations";

export const operationalSlugs = [
  "editorial-board", "opportunity-scheduler", "autonomy-modes", "learning-engine",
  "multi-format-planner", "executive-recommendations", "opportunity-portfolio",
  "campaign-builder", "evergreen-knowledge-bank", "template-dashboard"
] as const;

export function isOperationalSlug(value: string): value is (typeof operationalSlugs)[number] {
  return operationalSlugs.includes(value as (typeof operationalSlugs)[number]);
}

type Row = {
  RecordId: string; RecordType: string; Title: string; Description: string | null; Category: string | null;
  Status: string; OwnerName: string | null; Score: number | null; Progress: number | null; Amount: number | null;
  StartAt: Date | null; DueAt: Date | null; MetadataJson: string | null; UpdatedAt: Date;
};

async function workspaceId() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<{ WorkspaceId: string }>("SELECT TOP (1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;");
  if (!result.recordset[0]) throw new Error("No active CACSMS workspace is configured.");
  return result.recordset[0].WorkspaceId;
}

function parseMetadata(value: string | null) {
  if (!value) return {};
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

function mapRow(row: Row): OperationalRecord {
  return {
    id: String(row.RecordId), type: row.RecordType, title: row.Title, description: row.Description || "",
    category: row.Category || "", status: row.Status, owner: row.OwnerName || "Unassigned",
    score: row.Score === null ? null : Number(row.Score), progress: row.Progress === null ? null : Number(row.Progress),
    amount: row.Amount === null ? null : Number(row.Amount), startAt: row.StartAt ? new Date(row.StartAt).toISOString() : null,
    dueAt: row.DueAt ? new Date(row.DueAt).toISOString() : null, metadata: parseMetadata(row.MetadataJson),
    updatedAt: new Date(row.UpdatedAt).toISOString()
  };
}

async function portfolioRows(workspace: string): Promise<OperationalRecord[]> {
  const pool = await getMssqlPool();
  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspace).query(`
    SELECT OpportunityId RecordId, N'opportunity' RecordType, Title, Subtitle Description, Category,
      Status, OwnerName, OpportunityScore Score, ExecutionReadiness Progress, EstimatedValue Amount,
      CreatedAt StartAt, NULL DueAt,
      (SELECT Confidence confidence, MarketDemand marketDemand, StrategicFit strategicFit,
        CompetitiveWhitespace competitiveWhitespace, IsHighPriority highPriority, IsAtRisk atRisk FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) MetadataJson,
      UpdatedAt
    FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND IsArchived=0 ORDER BY OpportunityScore DESC, UpdatedAt DESC;`);
  return (result.recordset as Row[]).map(mapRow);
}

export async function getOperationalPage(slug: string): Promise<OperationalPageData> {
  if (!isOperationalSlug(slug)) throw new Error("Unsupported operational page.");
  const pool = await getMssqlPool(); const workspace = await workspaceId();
  const records = slug === "opportunity-portfolio" ? await portfolioRows(workspace) : (await pool.request()
    .input("workspace", sql.UniqueIdentifier, workspace).input("slug", sql.NVarChar(80), slug).query<Row>(`
      SELECT RecordId,RecordType,Title,Description,Category,Status,OwnerName,Score,Progress,Amount,StartAt,DueAt,MetadataJson,UpdatedAt
      FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=@slug ORDER BY UpdatedAt DESC;`)).recordset.map(mapRow);
  const settingRows = await pool.request().input("workspace", sql.UniqueIdentifier, workspace).input("slug", sql.NVarChar(80), slug)
    .query<{SettingKey:string;ValueJson:string}>("SELECT SettingKey,ValueJson FROM cacsms.OpportunityOperationalSettings WHERE WorkspaceId=@workspace AND PageSlug=@slug;");
  const settings: Record<string, unknown> = {};
  settingRows.recordset.forEach(row => { try { settings[row.SettingKey] = JSON.parse(row.ValueJson); } catch { settings[row.SettingKey] = null; } });
  const attention = records.filter(x => /risk|conflict|overdue|review|blocked|attention|rejected/i.test(x.status)).length;
  const ready = records.filter(x => /ready|approved|active|verified|significant|scheduled|promoted|prioritized/i.test(x.status)).length;
  const scored = records.filter(x => x.score !== null);
  let autonomy:OperationalPageData["autonomy"];
  if(slug==="opportunity-portfolio"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.OpportunityPortfolioAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],CandidatesScanned scanned,RecordsIngested ingested,RecordsUpdated updated,RecordsPromoted promoted,RecordsEnriching enriching,DuplicatesSuppressed duplicates,CONVERT(float,PortfolioScore) portfolioScore,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.OpportunityPortfolioAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"adaptive-portfolio-orchestrator-v4"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.ingested),updated:Number(last.updated),promoted:Number(last.promoted),enriching:Number(last.enriching),duplicates:Number(last.duplicates),portfolioScore:Number(last.portfolioScore),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null}:null};
  } else if(slug==="editorial-board"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.EditorialAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],CandidatesScanned scanned,RecordsIngested ingested,RecordsUpdated updated,RecordsVerified verified,RecordsApproved approved,RecordsHeld held,DuplicatesSuppressed duplicates,CONVERT(float,EditorialHealth) editorialHealth,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.EditorialAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"evidence-editorial-orchestrator-v5"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.ingested),updated:Number(last.updated),promoted:Number(last.approved),enriching:Number(last.verified),duplicates:Number(last.duplicates),portfolioScore:Number(last.editorialHealth),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,verified:Number(last.verified),approved:Number(last.approved),held:Number(last.held),editorialHealth:Number(last.editorialHealth)}:null};
  } else if(slug==="executive-recommendations"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.ExecutiveRecommendationAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],CandidatesScanned scanned,RecordsIngested ingested,RecordsUpdated updated,RecordsCommitted committed,RecordsExecuting executing,RecordsDeferred deferred,DuplicatesSuppressed duplicates,CONVERT(float,StrategicValue) strategicValue,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(float,InvestmentCommitted) investmentCommitted,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.ExecutiveRecommendationAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"risk-adjusted-executive-orchestrator-v5"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.ingested),updated:Number(last.updated),promoted:Number(last.executing),enriching:Number(last.committed),duplicates:Number(last.duplicates),portfolioScore:Number(last.strategicValue),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,committed:Number(last.committed),executing:Number(last.executing),deferred:Number(last.deferred),strategicValue:Number(last.strategicValue),investmentCommitted:Number(last.investmentCommitted)}:null};
  } else if(slug==="multi-format-planner"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.MultiFormatAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],MastersScanned masters,VariantsGenerated generated,VariantsUpdated updated,VariantsReady ready,VariantsOptimized optimized,VariantsHeld held,DuplicatesSuppressed duplicates,CONVERT(float,ChannelCoverage) channelCoverage,CONVERT(float,ReuseEfficiency) reuseEfficiency,CONVERT(float,AverageAdaptationQuality) adaptationQuality,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.MultiFormatAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"narrative-consistency-adaptation-orchestrator-v5"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.masters),ingested:Number(last.generated),updated:Number(last.updated),promoted:Number(last.optimized),enriching:Number(last.ready),duplicates:Number(last.duplicates),portfolioScore:Number(last.adaptationQuality),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,masters:Number(last.masters),variants:Number(last.generated)+Number(last.updated),ready:Number(last.ready),optimized:Number(last.optimized),held:Number(last.held),channelCoverage:Number(last.channelCoverage),reuseEfficiency:Number(last.reuseEfficiency),adaptationQuality:Number(last.adaptationQuality)}:null};
  } else if(slug==="campaign-builder"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.CampaignAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],AssetsScanned scanned,CampaignsPlanned campaigns,AssetsGenerated generated,AssetsUpdated updated,AssetsScheduled scheduled,AssetsLaunched launched,AssetsHeld held,DuplicatesSuppressed duplicates,CONVERT(float,ProjectedReach) projectedReach,CONVERT(float,BudgetAllocated) budgetAllocated,CONVERT(float,AverageLaunchReadiness) launchReadiness,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.CampaignAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"multi-objective-campaign-orchestrator-v6"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.generated),updated:Number(last.updated),promoted:Number(last.launched),enriching:Number(last.scheduled),duplicates:Number(last.duplicates),portfolioScore:Number(last.launchReadiness),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,campaigns:Number(last.campaigns),assets:Number(last.generated)+Number(last.updated),scheduled:Number(last.scheduled),launched:Number(last.launched),held:Number(last.held),projectedReach:Number(last.projectedReach),budgetAllocated:Number(last.budgetAllocated),launchReadiness:Number(last.launchReadiness)}:null};
  } else if(slug==="evergreen-knowledge-bank"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.EvergreenAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],RecordsScanned scanned,AssetsGenerated generated,AssetsUpdated updated,AssetsCertified certified,RefreshQueued refreshQueued,DuplicatesSuppressed duplicates,AssetsHeld held,CONVERT(float,AverageFreshness) freshness,CONVERT(float,AverageReuseReadiness) reuseReadiness,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.EvergreenAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"evergreen-retention-reuse-orchestrator-v5"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.generated),updated:Number(last.updated),promoted:Number(last.certified),enriching:Number(last.refreshQueued),duplicates:Number(last.duplicates),portfolioScore:Number(last.reuseReadiness),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,assets:Number(last.generated)+Number(last.updated),certified:Number(last.certified),refreshQueued:Number(last.refreshQueued),held:Number(last.held),freshness:Number(last.freshness),reuseReadiness:Number(last.reuseReadiness)}:null};
  } else if(slug==="opportunity-scheduler"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.OpportunitySchedulerAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],CampaignAssetsScanned scanned,SchedulesGenerated generated,SchedulesUpdated updated,UpcomingCount upcoming,RebalancedCount rebalanced,ConflictsDetected conflicts,HeldCount held,DuplicatesSuppressed duplicates,CONVERT(float,AverageTimingScore) timingScore,CONVERT(float,AverageCapacityScore) capacityScore,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.OpportunitySchedulerAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"capacity-aware-opportunity-scheduler-v5"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.generated),updated:Number(last.updated),promoted:Number(last.upcoming),enriching:Number(last.rebalanced),duplicates:Number(last.duplicates),portfolioScore:Number(last.timingScore),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,scheduledAssets:Number(last.generated),upcoming:Number(last.upcoming),rebalanced:Number(last.rebalanced),conflicts:Number(last.conflicts),held:Number(last.held),timingScore:Number(last.timingScore),capacityScore:Number(last.capacityScore)}:null};
  } else if(slug==="template-dashboard"){
    const telemetry=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) Enabled,RunIntervalSeconds,AlgorithmVersion,CONVERT(nvarchar(40),NextRunAt,127) nextRunAt FROM cacsms.TemplateAutonomySettings WHERE WorkspaceId=@workspace; SELECT TOP(1) Status status,TriggerSource [trigger],ProductionsScanned scanned,TemplatesGenerated generated,TemplatesUpdated updated,TemplatesApproved approved,TemplatesRefreshing refreshing,TemplatesRetired retired,DuplicatesSuppressed duplicates,CONVERT(float,AverageFit) fit,CONVERT(float,AverageReuse) reuse,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.TemplateAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC;`);
    const sets=telemetry.recordsets as unknown as Array<Array<Record<string,unknown>>>;const config=sets[0][0],last=sets[1][0];
    autonomy={enabled:Boolean(config?.Enabled),state:last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting",algorithmVersion:String(config?.AlgorithmVersion??"adaptive-template-intelligence-orchestrator-v5"),intervalSeconds:Number(config?.RunIntervalSeconds??30),nextRunAt:config?.nextRunAt?String(config.nextRunAt):null,lastRun:last?{trigger:String(last.trigger),scanned:Number(last.scanned),ingested:Number(last.generated),updated:Number(last.updated),promoted:Number(last.approved),enriching:Number(last.refreshing),duplicates:Number(last.duplicates),portfolioScore:Number(last.fit),averageConfidence:Number(last.averageConfidence),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null,approved:Number(last.approved),refreshQueued:Number(last.refreshing),retired:Number(last.retired),reuseEfficiency:Number(last.reuse)}:null};
  }
  if(slug==="opportunity-scheduler"&&!autonomy) autonomy={enabled:true,state:"waiting",algorithmVersion:"capacity-aware-opportunity-scheduler-v5",intervalSeconds:30,nextRunAt:null,lastRun:null};
  return { slug, records, settings, autonomy, totals: { count: records.length, active: records.filter(x=>!/^complete|archived$/i.test(x.status)).length,
    ready, attention, averageScore: scored.length ? Math.round(scored.reduce((n,x)=>n+(x.score||0),0)/scored.length) : 0,
    totalAmount: records.reduce((n,x)=>n+(x.amount||0),0) }, generatedAt: new Date().toISOString() };
}

function nullableDate(request: sql.Request, name: string, value: string | null | undefined) {
  return request.input(name, sql.DateTimeOffset, value ? new Date(value) : null);
}

export async function mutateOperationalPage(slug: string, input: OperationalMutation) {
  if (!isOperationalSlug(slug)) throw new Error("Unsupported operational page.");
  const pool = await getMssqlPool(); const workspace = await workspaceId();
  if (input.action === "setting") {
    if (!input.key) throw new Error("A setting key is required.");
    await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("slug",sql.NVarChar(80),slug)
      .input("key",sql.NVarChar(120),input.key).input("value",sql.NVarChar(sql.MAX),JSON.stringify(input.value ?? null)).query(`
        MERGE cacsms.OpportunityOperationalSettings AS target
        USING (SELECT @workspace WorkspaceId,@slug PageSlug,@key SettingKey) source
        ON target.WorkspaceId=source.WorkspaceId AND target.PageSlug=source.PageSlug AND target.SettingKey=source.SettingKey
        WHEN MATCHED THEN UPDATE SET ValueJson=@value,UpdatedAt=SYSUTCDATETIME(),UpdatedBy=N'Web application'
        WHEN NOT MATCHED THEN INSERT(WorkspaceId,PageSlug,SettingKey,ValueJson,UpdatedBy) VALUES(@workspace,@slug,@key,@value,N'Web application');`);
    return;
  }
  if (slug === "opportunity-portfolio") {
    if (input.action === "create") {
      if (!input.title?.trim()) throw new Error("Opportunity title is required.");
      await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("title",sql.NVarChar(300),input.title.trim())
        .input("description",sql.NVarChar(400),input.description||null).input("category",sql.NVarChar(100),input.category||"General")
        .input("status",sql.NVarChar(50),input.status||"Backlog").input("owner",sql.NVarChar(150),input.owner||"Unassigned")
        .input("score",sql.TinyInt,input.score??0).input("progress",sql.TinyInt,input.progress??0).input("amount",sql.Decimal(18,2),input.amount??0).query(`
          DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=@workspace AND IsActive=1);
          INSERT cacsms.Opportunities(WorkspaceId,BrandId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace)
          VALUES(@workspace,@brand,@title,@description,@category,@amount,@score,N'Not scheduled',@owner,@score,@status,@score,@score,@progress,@score);`);
      return;
    }
    if (!input.id) throw new Error("Opportunity id is required.");
    if (input.action === "delete") {
      await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("id",sql.UniqueIdentifier,input.id).query("UPDATE cacsms.Opportunities SET IsArchived=1,UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace AND OpportunityId=@id;"); return;
    }
    await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("id",sql.UniqueIdentifier,input.id)
      .input("status",sql.NVarChar(50),input.status||null).input("progress",sql.TinyInt,input.progress??null).query(`UPDATE cacsms.Opportunities SET Status=COALESCE(@status,Status),ExecutionReadiness=COALESCE(@progress,ExecutionReadiness),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace AND OpportunityId=@id;`); return;
  }
  if (input.action === "create") {
    if (!input.title?.trim()) throw new Error("A title is required.");
    let request=pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("slug",sql.NVarChar(80),slug)
      .input("type",sql.NVarChar(80),input.type||"item").input("title",sql.NVarChar(300),input.title.trim())
      .input("description",sql.NVarChar(1000),input.description||null).input("category",sql.NVarChar(120),input.category||null)
      .input("status",sql.NVarChar(60),input.status||"Draft").input("owner",sql.NVarChar(150),input.owner||null)
      .input("score",sql.TinyInt,input.score??null).input("progress",sql.TinyInt,input.progress??0)
      .input("amount",sql.Decimal(18,2),input.amount??null).input("metadata",sql.NVarChar(sql.MAX),JSON.stringify(input.metadata||{}));
    request=nullableDate(request,"start",input.startAt); request=nullableDate(request,"due",input.dueAt);
    await request.query(`INSERT cacsms.OpportunityOperationalRecords(WorkspaceId,PageSlug,RecordType,Title,Description,Category,Status,OwnerName,Score,Progress,Amount,StartAt,DueAt,MetadataJson)
      VALUES(@workspace,@slug,@type,@title,@description,@category,@status,@owner,@score,@progress,@amount,@start,@due,@metadata);`); return;
  }
  if (!input.id) throw new Error("Record id is required.");
  if (input.action === "delete") {
    await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("slug",sql.NVarChar(80),slug).input("id",sql.UniqueIdentifier,input.id)
      .query("DELETE cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=@slug AND RecordId=@id;"); return;
  }
  await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("slug",sql.NVarChar(80),slug).input("id",sql.UniqueIdentifier,input.id)
    .input("status",sql.NVarChar(60),input.status||null).input("progress",sql.TinyInt,input.progress??null)
    .input("owner",sql.NVarChar(150),input.owner||null).query(`UPDATE cacsms.OpportunityOperationalRecords SET Status=COALESCE(@status,Status),Progress=COALESCE(@progress,Progress),OwnerName=COALESCE(@owner,OwnerName),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace AND PageSlug=@slug AND RecordId=@id;`);
}
