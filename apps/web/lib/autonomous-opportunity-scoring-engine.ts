import sql from "mssql";
import {getMssqlPool} from "@/lib/database/mssql";
import {getGapData} from "@/lib/gap-scoring-data";

export const OPPORTUNITY_SCORING_ALGORITHM = "adaptive-opportunity-ensemble-v4";

type Settings = {WorkspaceId:string;Enabled:boolean;RunIntervalSeconds:number;AlgorithmVersion:string;AutoPromoteThreshold:number;AutoPrioritizeThreshold:number;MaxCandidatesPerRun:number;NextRunAt:Date|null};
type Candidate = {IntelligenceItemId:string;Title:string;Subtitle:string|null;Category:string;Score:number;AttributesJson:string;UpdatedAt:Date};
type Weight = {FactorKey:string;Weight:number};
type Factors = {demand:number;gap:number;momentum:number;resonance:number;strategicFit:number;feasibility:number};
export type AutonomousScoringResult={runId:string;status:"completed"|"skipped";scanned:number;created:number;updated:number;promoted:number;enriching:number;averageScore:number;averageConfidence:number};

const globalScoring=globalThis as typeof globalThis&{__opportunityScoringCycle?:Promise<AutonomousScoringResult>};
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const round=(value:number)=>Math.round(clamp(value)*10)/10;
const numeric=(attributes:Record<string,unknown>,keys:string[],fallback:number)=>{for(const key of keys){const value=Number(attributes[key]);if(Number.isFinite(value))return clamp(value);}return clamp(fallback);};
const parse=(value:string)=>{try{return JSON.parse(value) as Record<string,unknown>;}catch{return {};}};
const competition=(value:unknown)=>String(value??"").toLowerCase()==="low"?92:String(value??"").toLowerCase()==="medium"?70:48;
const demandLabel=(value:unknown)=>String(value??"").toLowerCase().includes("very")?94:String(value??"").toLowerCase().includes("high")?84:68;
const sigmoid=(value:number)=>100/(1+Math.exp(-(value-50)/15));

export function scoreOpportunity(candidate:Pick<Candidate,"Score"|"Title"|"Category"|"AttributesJson">,configuredWeights:Weight[]){
  const attributes=parse(candidate.AttributesJson);
  const evidence=numeric(attributes,["evidence","confidence"],candidate.Score*.88);
  const demand=numeric(attributes,["demandScore","demand"],demandLabel(attributes.demand));
  const gap=numeric(attributes,["coverageWeakness","gap","potential"],candidate.Score);
  const momentum=numeric(attributes,["trend","momentum"],candidate.Score*.9);
  const strategicFit=numeric(attributes,["brandFit","strategicFit"],candidate.Score*.92);
  const marketAdvantage=competition(attributes.competition);
  const resonance=numeric(attributes,["resonance"],demand*.46+evidence*.31+momentum*.23);
  const feasibility=numeric(attributes,["feasibility"],marketAdvantage*.45+evidence*.35+strategicFit*.2);
  const factors:Factors={demand:round(demand),gap:round(gap),momentum:round(momentum),resonance:round(resonance),strategicFit:round(strategicFit),feasibility:round(feasibility)};
  const values=Object.values(factors);const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  const deviation=Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length);
  const completeness=clamp(45+Object.keys(attributes).length*4);
  const agreement=clamp(100-deviation*2.1);
  const confidence=round(evidence*.48+completeness*.22+agreement*.3);
  const base=Object.fromEntries(configuredWeights.map(weight=>[weight.FactorKey,Number(weight.Weight)]));
  const reliability:Factors={demand:round(.72+confidence/360),gap:round(.72+evidence/360),momentum:round(.68+confidence/400),resonance:round(.65+agreement/420),strategicFit:round(.7+completeness/400),feasibility:round(.68+evidence/420)};
  const rawWeights=Object.fromEntries(Object.keys(factors).map(key=>[key,(Number(base[key])||1)*(Number(reliability[key as keyof Factors])||1)]));
  const weightTotal=Object.values(rawWeights).reduce((sum,value)=>sum+value,0);
  const adaptiveWeights=Object.fromEntries(Object.entries(rawWeights).map(([key,value])=>[key,round(value/weightTotal*100)]));
  const ensemble=Object.entries(factors).reduce((sum,[key,value])=>sum+(value*.68+sigmoid(value)*.32)*(Number(adaptiveWeights[key])||0)/100,0);
  const interaction=Math.sqrt(factors.demand*factors.gap)*.045+Math.sqrt(factors.momentum*factors.resonance)*.025;
  const uncertaintyPenalty=(100-confidence)*.075;
  const saturationPenalty=Math.max(0,70-marketAdvantage)*.06;
  const finalScore=round(ensemble+interaction-6.5-uncertaintyPenalty-saturationPenalty);
  return {factors,adaptiveWeights,reliability,confidence,agreement,completeness,evidence,marketAdvantage,finalScore};
}

async function loadSettings(){const pool=await getMssqlPool();const result=await pool.request().query<Settings>(`SELECT TOP(1) s.* FROM cacsms.OpportunityScoringAutonomySettings s JOIN cacsms.Workspaces w ON w.WorkspaceId=s.WorkspaceId WHERE w.Status=N'active' ORDER BY w.CreatedAt`);if(!result.recordset[0])throw new Error("Autonomous opportunity scoring is not configured.");return {pool,settings:result.recordset[0]};}

export async function runAutonomousOpportunityScoringCycle(trigger="scheduler",force=false):Promise<AutonomousScoringResult>{
  if(globalScoring.__opportunityScoringCycle)return globalScoring.__opportunityScoringCycle;
  const operation=execute(trigger,force).finally(()=>{globalScoring.__opportunityScoringCycle=undefined;});globalScoring.__opportunityScoringCycle=operation;return operation;
}

async function execute(trigger:string,force:boolean):Promise<AutonomousScoringResult>{
  await getGapData();
  const {pool,settings}=await loadSettings();
  if(!settings.Enabled||(!force&&settings.NextRunAt&&settings.NextRunAt.getTime()>Date.now()))return {runId:"",status:"skipped",scanned:0,created:0,updated:0,promoted:0,enriching:0,averageScore:0,averageConfidence:0};
  const started=await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("trigger",sql.NVarChar(40),trigger.slice(0,40)).input("algorithm",sql.NVarChar(100),OPPORTUNITY_SCORING_ALGORITHM).query<{id:string}>(`INSERT cacsms.OpportunityScoringAutonomyRuns(WorkspaceId,TriggerSource,AlgorithmVersion,Status) OUTPUT CONVERT(nvarchar(36),inserted.OpportunityScoringRunId) id VALUES(@workspace,@trigger,@algorithm,N'running')`);
  const runId=started.recordset[0].id;let created=0,updated=0,promoted=0,enriching=0;const scores:number[]=[];const confidences:number[]=[];
  try{
    const candidates=(await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("max",sql.Int,settings.MaxCandidatesPerRun).query<Candidate>(`SELECT TOP(@max) CONVERT(nvarchar(36),IntelligenceItemId) IntelligenceItemId,Title,Subtitle,Category,Score,AttributesJson,UpdatedAt FROM cacsms.IntelligenceItems WHERE WorkspaceId=@workspace AND EngineSlug=N'gap-detection' ORDER BY UpdatedAt DESC,Score DESC`)).recordset;
    const weights=(await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).query<Weight>(`SELECT FactorKey,Weight FROM cacsms.OpportunityScoringWeights WHERE WorkspaceId=@workspace AND ModelName=N'Opportunity v3.2'`)).recordset;
    for(const candidate of candidates){
      const result=scoreOpportunity(candidate,weights);scores.push(result.finalScore);confidences.push(result.confidence);
      const action=result.finalScore>=Number(settings.AutoPromoteThreshold)?"auto-promote":result.finalScore>=Number(settings.AutoPrioritizeThreshold)?"auto-prioritize":"autonomous-enrichment";
      const state=action==="auto-promote"?"Auto-promoted":action==="auto-prioritize"?"Auto-prioritized":"Autonomous enrichment";
      const category=action==="auto-promote"?"High Value":action==="auto-prioritize"?"Priority":"Developing";
      const metadata={...result.factors,confidence:result.confidence,algorithm:OPPORTUNITY_SCORING_ALGORITHM,adaptiveWeights:result.adaptiveWeights,reliability:result.reliability,evidenceAgreement:result.agreement,featureCompleteness:result.completeness,sourceGapId:candidate.IntelligenceItemId,decision:action,humanInputRequired:false,processedAt:new Date().toISOString()};
      const upsert=await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("title",sql.NVarChar(300),candidate.Title).input("subtitle",sql.NVarChar(300),(candidate.Subtitle??candidate.Category).slice(0,300)).input("category",sql.NVarChar(120),category).input("score",sql.TinyInt,Math.round(result.finalScore)).input("state",sql.NVarChar(60),state).input("attributes",sql.NVarChar(sql.MAX),JSON.stringify(metadata)).input("risk",sql.Bit,result.confidence<55).query<{id:string;created:number}>(`DECLARE @id uniqueidentifier=(SELECT TOP(1) IntelligenceItemId FROM cacsms.IntelligenceItems WHERE WorkspaceId=@workspace AND EngineSlug=N'scoring-engine' AND Title=@title ORDER BY CreatedAt),@created bit=0; IF @id IS NULL BEGIN SET @id=NEWID(); INSERT cacsms.IntelligenceItems(IntelligenceItemId,WorkspaceId,EngineSlug,Title,Subtitle,Category,Score,State,AttributesJson,IsRisk,IsWatchlisted) VALUES(@id,@workspace,N'scoring-engine',@title,@subtitle,@category,@score,@state,@attributes,@risk,1); SET @created=1; END ELSE UPDATE cacsms.IntelligenceItems SET Subtitle=@subtitle,Category=@category,Score=@score,State=@state,AttributesJson=@attributes,IsRisk=@risk,IsWatchlisted=1,UpdatedAt=SYSUTCDATETIME() WHERE IntelligenceItemId=@id; SELECT CONVERT(nvarchar(36),@id) id,CONVERT(int,@created) created;`);
      const itemId=upsert.recordset[0].id;if(upsert.recordset[0].created)created++;else updated++;if(action==="auto-promote")promoted++;if(action==="autonomous-enrichment")enriching++;
      await pool.request().input("run",sql.UniqueIdentifier,runId).input("item",sql.UniqueIdentifier,itemId).input("action",sql.NVarChar(60),action).input("score",sql.Decimal(5,2),result.finalScore).input("confidence",sql.Decimal(5,2),result.confidence).input("rationale",sql.NVarChar(sql.MAX),JSON.stringify({...result,humanInputRequired:false,sourceTitle:candidate.Title})).query(`INSERT cacsms.OpportunityScoringAutonomyDecisions(OpportunityScoringRunId,IntelligenceItemId,Action,Score,Confidence,RationaleJson) VALUES(@run,@item,@action,@score,@confidence,@rationale)`);
    }
    const averageScore=scores.length?round(scores.reduce((a,b)=>a+b,0)/scores.length):0;const averageConfidence=confidences.length?round(confidences.reduce((a,b)=>a+b,0)/confidences.length):0;
    await pool.request().input("run",sql.UniqueIdentifier,runId).input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("scanned",sql.Int,candidates.length).input("created",sql.Int,created).input("updated",sql.Int,updated).input("promoted",sql.Int,promoted).input("enriching",sql.Int,enriching).input("average",sql.Decimal(5,2),averageScore).input("confidence",sql.Decimal(5,2),averageConfidence).input("interval",sql.Int,settings.RunIntervalSeconds).query(`UPDATE cacsms.OpportunityScoringAutonomyRuns SET Status=N'completed',CandidatesScanned=@scanned,RecordsCreated=@created,RecordsUpdated=@updated,RecordsPromoted=@promoted,RecordsEnriching=@enriching,AverageScore=@average,AverageConfidence=@confidence,CompletedAt=SYSUTCDATETIME() WHERE OpportunityScoringRunId=@run; UPDATE cacsms.OpportunityScoringAutonomySettings SET Enabled=1,LastRunAt=SYSUTCDATETIME(),NextRunAt=DATEADD(SECOND,@interval,SYSUTCDATETIME()),AlgorithmVersion=N'adaptive-opportunity-ensemble-v4',UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace; UPDATE cacsms.IntelligenceEngineSettings SET AutoCreateOpportunities=1,LastRunAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace AND EngineSlug=N'scoring-engine'`);
    return {runId,status:"completed",scanned:candidates.length,created,updated,promoted,enriching,averageScore,averageConfidence};
  }catch(error){const message=error instanceof Error?error.message:"Autonomous scoring failed";await pool.request().input("run",sql.UniqueIdentifier,runId).input("error",sql.NVarChar(1000),message.slice(0,1000)).query(`UPDATE cacsms.OpportunityScoringAutonomyRuns SET Status=N'failed',ErrorMessage=@error,CompletedAt=SYSUTCDATETIME() WHERE OpportunityScoringRunId=@run`);throw error;}
}
