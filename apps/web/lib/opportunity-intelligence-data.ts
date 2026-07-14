import sql from "mssql";
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

export async function getOpportunityDashboard(): Promise<OpportunityDashboardData> {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const result=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).query<OpportunityRow>(`
    SELECT OpportunityId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,
      MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk
    FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND IsArchived=0 ORDER BY OpportunityScore DESC, CreatedAt DESC;`);
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
  const inserted=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("title",sql.NVarChar(300),title).query<OpportunityRow>(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=@workspace AND IsActive=1);
    INSERT cacsms.Opportunities (WorkspaceId,BrandId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    OUTPUT inserted.OpportunityId,inserted.Title,inserted.Subtitle,inserted.Category,inserted.EstimatedValue,inserted.Confidence,inserted.Timing,inserted.OwnerName,inserted.OpportunityScore,inserted.Status,inserted.MarketDemand,inserted.StrategicFit,inserted.ExecutionReadiness,inserted.CompetitiveWhitespace,inserted.IsHighPriority,inserted.IsAtRisk
    VALUES (@workspace,@brand,@title,N'Newly discovered · Automated scan',N'Market',18000000,76,N'Review now',N'Opportunity Intelligence',79,N'New',81,78,62,84,0,0);`);
  return mapOpportunity(inserted.recordset[0]);
}

export async function updateOpportunity(id:string, action:"open"|"initiative") {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const result=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("id",sql.UniqueIdentifier,id).input("action",sql.VarChar(20),action).query<{affected:number}>(`
    UPDATE cacsms.Opportunities SET LastOpenedAt=CASE WHEN @action='open' THEN SYSUTCDATETIME() ELSE LastOpenedAt END,
      Status=CASE WHEN @action='initiative' THEN N'Initiative created' ELSE Status END,
      ExecutionReadiness=CASE WHEN @action='initiative' AND ExecutionReadiness<90 THEN 90 ELSE ExecutionReadiness END, UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=@workspace AND OpportunityId=@id;
    SELECT @@ROWCOUNT affected;`);
  if(!result.recordset[0]?.affected) throw new Error("Opportunity was not found.");
}

export async function getDiscoveryData(): Promise<DiscoveryData> {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const [settingsResult,signalsResult]=await Promise.all([
    pool.request().input("workspace",sql.UniqueIdentifier,workspace).query(`SELECT TOP(1) * FROM cacsms.OpportunitySettings WHERE WorkspaceId=@workspace;`),
    pool.request().input("workspace",sql.UniqueIdentifier,workspace).query<SignalRow>(`SELECT TOP(100) SignalId,Subject,SourceMix,Velocity,Novelty,Durability,Relevance,SignalScore,State,IsWatchlisted,IsAnomaly FROM cacsms.OpportunitySignals WHERE WorkspaceId=@workspace ORDER BY SignalScore DESC,CreatedAt DESC;`)
  ]);
  const row=settingsResult.recordset[0]; const signals=signalsResult.recordset.map(mapSignal);
  const settings:DiscoverySettings={scanHorizonDays:Number(row.ScanHorizonDays),primaryMarket:row.PrimaryMarket,signalSensitivity:Number(row.SignalSensitivity),minimumConfidence:Number(row.MinimumConfidence),includeWeakSignals:Boolean(row.IncludeWeakSignals),detectAnomalies:Boolean(row.DetectAnomalies),crossCheckCompetitors:Boolean(row.CrossCheckCompetitors),lastScanAt:row.LastScanAt?new Date(row.LastScanAt).toISOString():null};
  return {settings,signals,metrics:{processed:signals.length,emerging:signals.filter(x=>/emerging|accelerating|breakout/i.test(x.state)).length,clusters:new Set(signals.map(x=>x.durability)).size,alerts:signals.filter(item=>item.anomaly||item.score>=90).length}};
}

export async function saveDiscoverySettings(settings:DiscoverySettings) {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("days",sql.Int,settings.scanHorizonDays).input("market",sql.NVarChar(150),settings.primaryMarket)
    .input("sensitivity",sql.TinyInt,settings.signalSensitivity).input("confidence",sql.TinyInt,settings.minimumConfidence)
    .input("weak",sql.Bit,settings.includeWeakSignals).input("anomalies",sql.Bit,settings.detectAnomalies).input("competitors",sql.Bit,settings.crossCheckCompetitors).query(`
      UPDATE cacsms.OpportunitySettings SET ScanHorizonDays=@days,PrimaryMarket=@market,SignalSensitivity=@sensitivity,MinimumConfidence=@confidence,IncludeWeakSignals=@weak,DetectAnomalies=@anomalies,CrossCheckCompetitors=@competitors,UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace;`);
}

export async function runDiscoveryScan() {
  const pool=await getMssqlPool(); const workspace=await workspaceId(); const subject=`Emerging industrial automation demand · ${new Date().toLocaleDateString("en-GB")}`;
  const result=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("subject",sql.NVarChar(300),subject).query<SignalRow>(`
    INSERT cacsms.OpportunitySignals (WorkspaceId,Subject,SourceMix,Velocity,Novelty,Durability,Relevance,SignalScore,State)
    OUTPUT inserted.SignalId,inserted.Subject,inserted.SourceMix,inserted.Velocity,inserted.Novelty,inserted.Durability,inserted.Relevance,inserted.SignalScore,inserted.State,inserted.IsWatchlisted,inserted.IsAnomaly
    VALUES (@workspace,@subject,N'Search + jobs + procurement',118,88,N'High',92,91,N'Accelerating');
    UPDATE cacsms.OpportunitySettings SET LastScanAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace;`);
  return mapSignal(result.recordset[0]);
}

export async function createOpportunityFromSignal(signalId:string) {
  const pool=await getMssqlPool(); const workspace=await workspaceId();
  const result=await pool.request().input("workspace",sql.UniqueIdentifier,workspace).input("signal",sql.UniqueIdentifier,signalId).query<OpportunityRow>(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=@workspace AND IsActive=1);
    INSERT cacsms.Opportunities (WorkspaceId,BrandId,SourceSignalId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    OUTPUT inserted.OpportunityId,inserted.Title,inserted.Subtitle,inserted.Category,inserted.EstimatedValue,inserted.Confidence,inserted.Timing,inserted.OwnerName,inserted.OpportunityScore,inserted.Status,inserted.MarketDemand,inserted.StrategicFit,inserted.ExecutionReadiness,inserted.CompetitiveWhitespace,inserted.IsHighPriority,inserted.IsAtRisk
    SELECT @workspace,@brand,SignalId,Subject,N'Created from Discovery Engine',N'Discovery',24000000,Relevance,N'Act now',N'Opportunity Intelligence',SignalScore,N'Ready to validate',Relevance,86,72,Novelty,CASE WHEN SignalScore>=90 THEN 1 ELSE 0 END,0
    FROM cacsms.OpportunitySignals WHERE WorkspaceId=@workspace AND SignalId=@signal;`);
  if(!result.recordset[0]) throw new Error("Signal was not found."); return mapOpportunity(result.recordset[0]);
}
