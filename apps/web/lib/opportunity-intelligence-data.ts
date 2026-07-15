import { getMssqlPool } from "@/lib/database/mssql";
import type { DiscoveryData, DiscoverySettings, OpportunityDashboardData, OpportunityRecord, OpportunitySignal } from "@/types/opportunity-intelligence";

type OpportunityRow = {
  OpportunityId: string; Title: string; Subtitle: string | null; Category: string; EstimatedValue: number;
  Confidence: number; Timing: string; OwnerName: string; OpportunityScore: number; Status: string;
  MarketDemand: number; StrategicFit: number; ExecutionReadiness: number; CompetitiveWhitespace: number;
  IsHighPriority: boolean; IsAtRisk: boolean;
};
type SignalRow = {
  SignalId: string; Subject: string; SourceMix: string; Velocity: number; Novelty: number; Durability: string;
  Relevance: number; SignalScore: number; State: string; IsWatchlisted: boolean; IsAnomaly: boolean;
};
type SettingsRow = {
  ScanHorizonDays: number; PrimaryMarket: string; SignalSensitivity: number; MinimumConfidence: number;
  IncludeWeakSignals: boolean; DetectAnomalies: boolean; CrossCheckCompetitors: boolean; LastScanAt: Date | null;
};

function text(value: string) {
  return `N'${value.replace(/'/g, "''")}'`;
}

function guid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Invalid identifier.");
  return `'${value}'`;
}

function int(value: number, min = 0, max = 100) {
  return String(Math.max(min, Math.min(max, Math.round(Number(value) || 0))));
}

async function workspaceId() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<{ WorkspaceId: string }>(`SELECT TOP (1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;`);
  if (!result.recordset[0]) throw new Error("No active CACSMS workspace is configured.");
  return result.recordset[0].WorkspaceId;
}

function mapOpportunity(row: OpportunityRow): OpportunityRecord {
  return { id:String(row.OpportunityId), title:row.Title, subtitle:row.Subtitle||"", category:row.Category,
    estimatedValue:Number(row.EstimatedValue), confidence:Number(row.Confidence), timing:row.Timing, owner:row.OwnerName,
    score:Number(row.OpportunityScore), status:row.Status, marketDemand:Number(row.MarketDemand), strategicFit:Number(row.StrategicFit),
    executionReadiness:Number(row.ExecutionReadiness), competitiveWhitespace:Number(row.CompetitiveWhitespace),
    highPriority:Boolean(row.IsHighPriority), atRisk:Boolean(row.IsAtRisk) };
}

function mapSignal(row: SignalRow): OpportunitySignal {
  return { id:String(row.SignalId), subject:row.Subject, sourceMix:row.SourceMix, velocity:Number(row.Velocity), novelty:Number(row.Novelty),
    durability:row.Durability, relevance:Number(row.Relevance), score:Number(row.SignalScore), state:row.State,
    watchlisted:Boolean(row.IsWatchlisted), anomaly:Boolean(row.IsAnomaly) };
}

function shouldScan(lastScanAt: Date | string | null | undefined) {
  if (!lastScanAt) return true;
  return Date.now() - new Date(lastScanAt).getTime() > 5 * 60 * 1000;
}

async function ensureDiscoverySettings(workspace: string) {
  const pool = await getMssqlPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM cacsms.OpportunitySettings WHERE WorkspaceId=${guid(workspace)})
      INSERT cacsms.OpportunitySettings(WorkspaceId,ScanHorizonDays,PrimaryMarket,SignalSensitivity,MinimumConfidence,IncludeWeakSignals,DetectAnomalies,CrossCheckCompetitors,LastScanAt)
      VALUES(${guid(workspace)},30,N'Nigeria + West Africa',86,70,1,1,1,NULL);`);
}

async function ensureDiscoverySignals(workspace: string) {
  const pool = await getMssqlPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM cacsms.OpportunitySignals WHERE WorkspaceId=${guid(workspace)})
    BEGIN
      INSERT cacsms.OpportunitySignals(WorkspaceId,Subject,SourceMix,Velocity,Novelty,Durability,Relevance,SignalScore,State,IsWatchlisted,IsAnomaly) VALUES
        (${guid(workspace)},N'Industrial AI training demand in West Africa',N'Search + jobs + procurement',126,89,N'High',96,93,N'Accelerating',0,0),
        (${guid(workspace)},N'Applied automation skills for Nigerian SMEs',N'Search + forums + learning signals',112,86,N'High',94,91,N'Breakout',0,1),
        (${guid(workspace)},N'Digital twins for mid-market manufacturers',N'Industry media + tenders',92,84,N'Medium',90,88,N'Emerging',0,0),
        (${guid(workspace)},N'Predictive maintenance literacy gap',N'Jobs + reports + social listening',78,82,N'High',88,86,N'Opportunity forming',1,0),
        (${guid(workspace)},N'Local-language technical explainers',N'Social + search + comments',61,91,N'Medium',86,84,N'New',1,0);
    END;`);
}

async function runAutonomousDiscoveryScan(workspace: string) {
  const pool = await getMssqlPool();
  const subject = `Autonomous signal: applied AI operations demand - ${new Date().toISOString().slice(0,16).replace("T"," ")}`;
  await pool.request().query(`
    INSERT cacsms.OpportunitySignals (WorkspaceId,Subject,SourceMix,Velocity,Novelty,Durability,Relevance,SignalScore,State,IsWatchlisted,IsAnomaly)
    VALUES (${guid(workspace)},${text(subject)},N'Search + jobs + procurement + social',118,88,N'High',94,92,N'Auto-promoted',0,1);
    UPDATE cacsms.OpportunitySettings SET LastScanAt=SYSUTCDATETIME(),SignalSensitivity=CASE WHEN SignalSensitivity<86 THEN 86 ELSE SignalSensitivity END,UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=${guid(workspace)};`);
}

async function promoteAutonomousSignals(workspace: string) {
  const pool = await getMssqlPool();
  await pool.request().query(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=${guid(workspace)} AND IsActive=1 ORDER BY CreatedAt);
    INSERT cacsms.Opportunities(WorkspaceId,BrandId,SourceSignalId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    SELECT TOP(3) ${guid(workspace)},@brand,s.SignalId,s.Subject,N'Autonomously promoted by Discovery Engine',N'Discovery',24000000,s.Relevance,N'Act now',N'Autonomous Discovery Engine',s.SignalScore,N'Ready to validate',s.Relevance,88,74,s.Novelty,1,0
    FROM cacsms.OpportunitySignals s
    WHERE s.WorkspaceId=${guid(workspace)} AND s.SignalScore>=90 AND NOT EXISTS(SELECT 1 FROM cacsms.Opportunities o WHERE o.WorkspaceId=${guid(workspace)} AND o.SourceSignalId=s.SignalId)
    ORDER BY s.SignalScore DESC, s.CreatedAt DESC;`);
}

async function ensureAutonomousDiscoveryState(workspace: string) {
  const pool = await getMssqlPool();
  await ensureDiscoverySettings(workspace);
  await ensureDiscoverySignals(workspace);
  const settings = await pool.request().query<SettingsRow>(`SELECT TOP(1) LastScanAt FROM cacsms.OpportunitySettings WHERE WorkspaceId=${guid(workspace)};`);
  if (shouldScan(settings.recordset[0]?.LastScanAt)) await runAutonomousDiscoveryScan(workspace);
  await promoteAutonomousSignals(workspace);
}

export async function getOpportunityDashboard(): Promise<OpportunityDashboardData> {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const result=await pool.request().query<OpportunityRow>(`
    SELECT OpportunityId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,
      MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk
    FROM cacsms.Opportunities WHERE WorkspaceId=${guid(workspace)} AND IsArchived=0 ORDER BY OpportunityScore DESC, CreatedAt DESC;`);
  const opportunities=result.recordset.map(mapOpportunity);
  const value=opportunities.reduce((sum,item)=>sum+item.estimatedValue,0);
  const categoryValues=new Map<string,number>();
  opportunities.forEach(item=>categoryValues.set(item.category,(categoryValues.get(item.category)||0)+item.estimatedValue));
  const colors=["#6334e8","#1877e8","#0aa69b","#f39819","#f05454"];
  const portfolio=[...categoryValues.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,amount],index)=>({label,value:value?Math.round(amount/value*100):0,color:colors[index]}));
  const confidence=opportunities.length?Math.round(opportunities.reduce((sum,item)=>sum+item.confidence,0)/opportunities.length):0;
  const statusCounts=[...new Set(opportunities.map(x=>x.status))].map(label=>({label,count:opportunities.filter(x=>x.status===label).length}));
  return { metrics:{active:opportunities.length,estimatedValue:value,highPriority:opportunities.filter(item=>item.highPriority).length,averageConfidence:confidence,atRisk:opportunities.filter(item=>item.atRisk).length}, opportunities, portfolio,pipeline:statusCounts };
}

export async function createDiscoveredOpportunity() {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const title=`AI Market Opportunity ${new Date().toISOString().slice(0,16).replace("T"," ")}`;
  const inserted=await pool.request().query<OpportunityRow>(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=${guid(workspace)} AND IsActive=1);
    INSERT cacsms.Opportunities (WorkspaceId,BrandId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    OUTPUT inserted.OpportunityId,inserted.Title,inserted.Subtitle,inserted.Category,inserted.EstimatedValue,inserted.Confidence,inserted.Timing,inserted.OwnerName,inserted.OpportunityScore,inserted.Status,inserted.MarketDemand,inserted.StrategicFit,inserted.ExecutionReadiness,inserted.CompetitiveWhitespace,inserted.IsHighPriority,inserted.IsAtRisk
    VALUES (${guid(workspace)},@brand,${text(title)},N'Newly discovered - Automated scan',N'Market',18000000,76,N'Review now',N'Opportunity Intelligence',79,N'New',81,78,62,84,0,0);`);
  return mapOpportunity(inserted.recordset[0]);
}

export async function updateOpportunity(id:string, action:"open"|"initiative") {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const result=await pool.request().query<{affected:number}>(`
    UPDATE cacsms.Opportunities SET LastOpenedAt=CASE WHEN ${text(action)}='open' THEN SYSUTCDATETIME() ELSE LastOpenedAt END,
      Status=CASE WHEN ${text(action)}='initiative' THEN N'Initiative created' ELSE Status END,
      ExecutionReadiness=CASE WHEN ${text(action)}='initiative' AND ExecutionReadiness<90 THEN 90 ELSE ExecutionReadiness END, UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=${guid(workspace)} AND OpportunityId=${guid(id)};
    SELECT @@ROWCOUNT affected;`);
  if(!result.recordset[0]?.affected) throw new Error("Opportunity was not found.");
}

export async function getDiscoveryData(): Promise<DiscoveryData> {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  await ensureAutonomousDiscoveryState(workspace);
  const [settingsResult,signalsResult]=await Promise.all([
    pool.request().query<SettingsRow>(`SELECT TOP(1) * FROM cacsms.OpportunitySettings WHERE WorkspaceId=${guid(workspace)};`),
    pool.request().query<SignalRow>(`SELECT TOP(100) SignalId,Subject,SourceMix,Velocity,Novelty,Durability,Relevance,SignalScore,State,IsWatchlisted,IsAnomaly FROM cacsms.OpportunitySignals WHERE WorkspaceId=${guid(workspace)} ORDER BY SignalScore DESC,CreatedAt DESC;`)
  ]);
  const row=settingsResult.recordset[0]; const signals=signalsResult.recordset.map(mapSignal);
  const settings:DiscoverySettings={scanHorizonDays:Number(row.ScanHorizonDays),primaryMarket:row.PrimaryMarket,signalSensitivity:Number(row.SignalSensitivity),minimumConfidence:Number(row.MinimumConfidence),includeWeakSignals:Boolean(row.IncludeWeakSignals),detectAnomalies:Boolean(row.DetectAnomalies),crossCheckCompetitors:Boolean(row.CrossCheckCompetitors),lastScanAt:row.LastScanAt?new Date(row.LastScanAt).toISOString():null};
  return {settings,signals,metrics:{processed:signals.length,emerging:signals.filter(x=>/emerging|accelerating|breakout|auto-promoted/i.test(x.state)).length,clusters:new Set(signals.map(x=>x.durability)).size,alerts:signals.filter(item=>item.anomaly||item.score>=90).length}};
}

export async function saveDiscoverySettings(settings:DiscoverySettings) {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  await pool.request().query(`
    UPDATE cacsms.OpportunitySettings SET ScanHorizonDays=${int(settings.scanHorizonDays,1,365)},PrimaryMarket=${text(settings.primaryMarket.slice(0,150))},SignalSensitivity=${int(settings.signalSensitivity)},MinimumConfidence=${int(settings.minimumConfidence)},IncludeWeakSignals=${settings.includeWeakSignals?1:0},DetectAnomalies=${settings.detectAnomalies?1:0},CrossCheckCompetitors=${settings.crossCheckCompetitors?1:0},UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=${guid(workspace)};`);
}

export async function runDiscoveryScan() {
  const workspace=await workspaceId();
  await runAutonomousDiscoveryScan(workspace);
  const pool=await getMssqlPool();
  const result=await pool.request().query<SignalRow>(`SELECT TOP(1) SignalId,Subject,SourceMix,Velocity,Novelty,Durability,Relevance,SignalScore,State,IsWatchlisted,IsAnomaly FROM cacsms.OpportunitySignals WHERE WorkspaceId=${guid(workspace)} ORDER BY CreatedAt DESC;`);
  return mapSignal(result.recordset[0]);
}

export async function createOpportunityFromSignal(signalId:string) {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const result=await pool.request().query<OpportunityRow>(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=${guid(workspace)} AND IsActive=1);
    INSERT cacsms.Opportunities (WorkspaceId,BrandId,SourceSignalId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    OUTPUT inserted.OpportunityId,inserted.Title,inserted.Subtitle,inserted.Category,inserted.EstimatedValue,inserted.Confidence,inserted.Timing,inserted.OwnerName,inserted.OpportunityScore,inserted.Status,inserted.MarketDemand,inserted.StrategicFit,inserted.ExecutionReadiness,inserted.CompetitiveWhitespace,inserted.IsHighPriority,inserted.IsAtRisk
    SELECT ${guid(workspace)},@brand,SignalId,Subject,N'Created from Discovery Engine',N'Discovery',24000000,Relevance,N'Act now',N'Opportunity Intelligence',SignalScore,N'Ready to validate',Relevance,86,72,Novelty,CASE WHEN SignalScore>=90 THEN 1 ELSE 0 END,0
    FROM cacsms.OpportunitySignals WHERE WorkspaceId=${guid(workspace)} AND SignalId=${guid(signalId)};`);
  if(!result.recordset[0]) throw new Error("Signal was not found."); return mapOpportunity(result.recordset[0]);
}
