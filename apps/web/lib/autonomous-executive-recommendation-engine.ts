import sql from "mssql";
import {getMssqlPool} from "@/lib/database/mssql";

export const EXECUTIVE_AUTONOMY_ALGORITHM="risk-adjusted-executive-orchestrator-v5";

type Settings={WorkspaceId:string;Enabled:boolean;RunIntervalSeconds:number;CommitThreshold:number;ExecuteThreshold:number;MaximumRisk:number;AllocationRate:number;NextRunAt:Date|null};
type Candidate={RecordId:string;Title:string;Description:string|null;Category:string|null;Score:number;Progress:number;Amount:number;MetadataJson:string|null;UpdatedAt:Date};
type Recommendation={RecordId:string;Title:string;MetadataJson:string|null};
export type ExecutiveCycleResult={runId:string;status:"completed"|"skipped";scanned:number;ingested:number;updated:number;committed:number;executing:number;deferred:number;duplicates:number;strategicValue:number;averageConfidence:number;investmentCommitted:number};

const executiveGlobal=globalThis as typeof globalThis&{__executiveCycle?:Promise<ExecutiveCycleResult>};
const clamp=(value:number)=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
const round=(value:number)=>Math.round(clamp(value)*10)/10;
const tokens=(text:string)=>new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(token=>token.length>2));
function similarity(left:string,right:string){const a=tokens(left),b=tokens(right);if(!a.size||!b.size)return 0;let common=0;for(const token of a)if(b.has(token))common++;return common/(a.size+b.size-common)*100;}
function parse(value:string|null){try{return value?JSON.parse(value) as Record<string,unknown>:{};}catch{return {};}}
function numeric(metadata:Record<string,unknown>,key:string,fallback:number){const value=Number(metadata[key]);return Number.isFinite(value)?clamp(value):clamp(fallback);}

async function configuration(){const pool=await getMssqlPool();const result=await pool.request().query<Settings>(`SELECT TOP(1) s.* FROM cacsms.ExecutiveRecommendationAutonomySettings s JOIN cacsms.Workspaces w ON w.WorkspaceId=s.WorkspaceId WHERE w.Status=N'active' ORDER BY w.CreatedAt`);if(!result.recordset[0])throw new Error("Autonomous executive recommendations are not configured.");return {pool,settings:result.recordset[0]};}

export async function runAutonomousExecutiveRecommendationCycle(trigger="scheduler",force=false){
  if(executiveGlobal.__executiveCycle)return executiveGlobal.__executiveCycle;
  const operation=execute(trigger,force).finally(()=>{executiveGlobal.__executiveCycle=undefined;});
  executiveGlobal.__executiveCycle=operation;
  return operation;
}

async function execute(trigger:string,force:boolean):Promise<ExecutiveCycleResult>{
  const {pool,settings}=await configuration();
  if(!settings.Enabled||(!force&&settings.NextRunAt&&settings.NextRunAt.getTime()>Date.now()))return {runId:"",status:"skipped",scanned:0,ingested:0,updated:0,committed:0,executing:0,deferred:0,duplicates:0,strategicValue:0,averageConfidence:0,investmentCommitted:0};
  const started=await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("trigger",sql.NVarChar(40),trigger.slice(0,40)).input("algorithm",sql.NVarChar(100),EXECUTIVE_AUTONOMY_ALGORITHM).query<{id:string}>(`INSERT cacsms.ExecutiveRecommendationAutonomyRuns(WorkspaceId,TriggerSource,AlgorithmVersion,Status) OUTPUT CONVERT(nvarchar(36),inserted.ExecutiveRecommendationRunId) id VALUES(@workspace,@trigger,@algorithm,N'running')`);
  const runId=started.recordset[0].id;let ingested=0,updated=0,committed=0,executing=0,deferred=0,duplicates=0,investmentCommitted=0;const utilities:number[]=[];const confidences:number[]=[];
  try{
    const candidates=(await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).query<Candidate>(`
      SELECT CONVERT(nvarchar(36),RecordId) RecordId,Title,Description,Category,ISNULL(Score,0) Score,ISNULL(Progress,0) Progress,CONVERT(float,ISNULL(Amount,0)) Amount,MetadataJson,UpdatedAt
      FROM cacsms.OpportunityOperationalRecords WHERE WorkspaceId=@workspace AND PageSlug=N'editorial-board' AND Status=N'Auto-approved for production'
      ORDER BY Score DESC,UpdatedAt DESC;`)).recordset;
    const existing=(await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).query<Recommendation>(`
      SELECT CONVERT(nvarchar(36),RecordId) RecordId,Title,MetadataJson FROM cacsms.OpportunityOperationalRecords
      WHERE WorkspaceId=@workspace AND PageSlug=N'executive-recommendations';`)).recordset;
    const bySource=new Map<string,Recommendation>();for(const record of existing){const source=String(parse(record.MetadataJson).sourceEditorialRecordId??"");if(source)bySource.set(source.toLowerCase(),record);}
    const titles=existing.map(record=>record.Title);const maximumValue=Math.max(1,...candidates.map(candidate=>candidate.Amount));
    const categories=new Map<string,number>();for(const candidate of candidates){const category=candidate.Category||"Uncategorized";categories.set(category,(categories.get(category)??0)+1);}

    for(const candidate of candidates){
      let record=bySource.get(candidate.RecordId.toLowerCase());
      if(!record){const nearest=titles.reduce((best,title)=>Math.max(best,similarity(candidate.Title,title)),0);if(nearest>=88){duplicates++;continue;}
        const initialMetadata=JSON.stringify({sourceEditorialRecordId:candidate.RecordId,algorithm:EXECUTIVE_AUTONOMY_ALGORITHM,humanInputRequired:false});
        const inserted=await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("title",sql.NVarChar(300),candidate.Title).input("description",sql.NVarChar(1000),candidate.Description??"Autonomously generated from an evidence-approved editorial opportunity.").input("category",sql.NVarChar(120),candidate.Category??"Strategic opportunity").input("score",sql.TinyInt,Math.round(candidate.Score)).input("metadata",sql.NVarChar(sql.MAX),initialMetadata).query<{RecordId:string}>(`INSERT cacsms.OpportunityOperationalRecords(WorkspaceId,PageSlug,RecordType,Title,Description,Category,Status,OwnerName,Score,Progress,Amount,StartAt,MetadataJson) OUTPUT CONVERT(nvarchar(36),inserted.RecordId) RecordId VALUES(@workspace,N'executive-recommendations',N'autonomous-recommendation',@title,@description,@category,N'Autonomous monitoring',N'Executive Autonomy Engine',@score,25,0,SYSUTCDATETIME(),@metadata)`);
        record={RecordId:inserted.recordset[0].RecordId,Title:candidate.Title,MetadataJson:initialMetadata};bySource.set(candidate.RecordId.toLowerCase(),record);titles.push(candidate.Title);ingested++;
      }
      const metadata=parse(candidate.MetadataJson);const evidence=numeric(metadata,"evidenceScore",candidate.Score);const editorialConfidence=numeric(metadata,"decisionConfidence",candidate.Score);const agreement=numeric(metadata,"agreement",evidence);const sourceStrength=numeric(metadata,"sourceStrength",70);const category=candidate.Category||"Uncategorized";const concentration=(categories.get(category)??1)/Math.max(1,candidates.length)*100;const concentrationRisk=Math.max(0,concentration-30)*.35;const sourceRisk=(100-sourceStrength)*.15;const freshness=round(100-Math.max(0,(Date.now()-new Date(candidate.UpdatedAt).getTime())/86_400_000)*2);const normalizedValue=round(candidate.Amount/maximumValue*100);const diversification=round(100-concentration);
      const riskScore=round((100-evidence)*.28+(100-editorialConfidence)*.22+(100-agreement)*.15+concentrationRisk+sourceRisk+(candidate.Score<75?12:0));
      const expectedUtility=round(candidate.Score*.24+evidence*.19+editorialConfidence*.17+candidate.Progress*.1+normalizedValue*.12+diversification*.08+freshness*.1-riskScore*.16);
      const decisionConfidence=round(editorialConfidence*.42+evidence*.3+agreement*.18+sourceStrength*.1);
      const action=riskScore>settings.MaximumRisk?"auto-defer-risk":expectedUtility>=settings.ExecuteThreshold&&decisionConfidence>=80?"auto-execute":expectedUtility>=settings.CommitThreshold?"auto-commit":"autonomous-monitor";
      const status=action==="auto-defer-risk"?"Auto-deferred by risk":action==="auto-execute"?"Auto-executing":action==="auto-commit"?"Auto-committed":"Autonomous monitoring";
      const progress=action==="auto-execute"?100:action==="auto-commit"?80:action==="auto-defer-risk"?0:50;
      const allocation=action==="auto-execute"||action==="auto-commit"?Math.round(candidate.Amount*Number(settings.AllocationRate)*(expectedUtility/100)*(1-riskScore/100)*100)/100:0;
      const rationale={algorithm:EXECUTIVE_AUTONOMY_ALGORITHM,expectedUtility,riskScore,decisionConfidence,evidence,agreement,sourceStrength,normalizedValue,diversification,freshness,concentrationRisk,action,allocation,humanInputRequired:false};
      await pool.request().input("record",sql.UniqueIdentifier,record.RecordId).input("status",sql.NVarChar(60),status).input("score",sql.TinyInt,Math.round(expectedUtility)).input("progress",sql.TinyInt,progress).input("amount",sql.Decimal(18,2),allocation).input("description",sql.NVarChar(1000),candidate.Description??"Autonomously generated from an evidence-approved editorial opportunity.").input("metadata",sql.NVarChar(sql.MAX),JSON.stringify({...rationale,sourceEditorialRecordId:candidate.RecordId,sourceOpportunityId:metadata.sourceOpportunityId??null})).query(`UPDATE cacsms.OpportunityOperationalRecords SET Description=@description,Status=@status,OwnerName=N'Executive Autonomy Engine',Score=@score,Progress=@progress,Amount=@amount,MetadataJson=@metadata,UpdatedAt=SYSUTCDATETIME() WHERE RecordId=@record`);
      await pool.request().input("run",sql.UniqueIdentifier,runId).input("record",sql.UniqueIdentifier,record.RecordId).input("source",sql.UniqueIdentifier,candidate.RecordId).input("action",sql.NVarChar(60),action).input("utility",sql.Decimal(5,2),expectedUtility).input("risk",sql.Decimal(5,2),riskScore).input("confidence",sql.Decimal(5,2),decisionConfidence).input("allocation",sql.Decimal(18,2),allocation).input("rationale",sql.NVarChar(sql.MAX),JSON.stringify(rationale)).query(`INSERT cacsms.ExecutiveRecommendationAutonomyDecisions(ExecutiveRecommendationRunId,RecordId,SourceEditorialRecordId,Action,UtilityScore,RiskScore,Confidence,InvestmentAllocation,RationaleJson) VALUES(@run,@record,@source,@action,@utility,@risk,@confidence,@allocation,@rationale)`);
      updated++;if(action==="auto-execute")executing++;if(action==="auto-commit")committed++;if(action==="auto-defer-risk")deferred++;investmentCommitted+=allocation;utilities.push(expectedUtility);confidences.push(decisionConfidence);
    }
    const strategicValue=utilities.length?round(utilities.reduce((a,b)=>a+b,0)/utilities.length):0;const averageConfidence=confidences.length?round(confidences.reduce((a,b)=>a+b,0)/confidences.length):0;
    await pool.request().input("run",sql.UniqueIdentifier,runId).input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("scanned",sql.Int,candidates.length).input("ingested",sql.Int,ingested).input("updated",sql.Int,updated).input("committed",sql.Int,committed).input("executing",sql.Int,executing).input("deferred",sql.Int,deferred).input("duplicates",sql.Int,duplicates).input("value",sql.Decimal(5,2),strategicValue).input("confidence",sql.Decimal(5,2),averageConfidence).input("investment",sql.Decimal(18,2),investmentCommitted).input("interval",sql.Int,settings.RunIntervalSeconds).query(`UPDATE cacsms.ExecutiveRecommendationAutonomyRuns SET Status=N'completed',CandidatesScanned=@scanned,RecordsIngested=@ingested,RecordsUpdated=@updated,RecordsCommitted=@committed,RecordsExecuting=@executing,RecordsDeferred=@deferred,DuplicatesSuppressed=@duplicates,StrategicValue=@value,AverageConfidence=@confidence,InvestmentCommitted=@investment,CompletedAt=SYSUTCDATETIME() WHERE ExecutiveRecommendationRunId=@run; UPDATE cacsms.ExecutiveRecommendationAutonomySettings SET Enabled=1,LastRunAt=SYSUTCDATETIME(),NextRunAt=DATEADD(SECOND,@interval,SYSUTCDATETIME()),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace`);
    return {runId,status:"completed",scanned:candidates.length,ingested,updated,committed,executing,deferred,duplicates,strategicValue,averageConfidence,investmentCommitted};
  }catch(error){const message=error instanceof Error?error.message:"Autonomous executive recommendation cycle failed";await pool.request().input("run",sql.UniqueIdentifier,runId).input("error",sql.NVarChar(1000),message.slice(0,1000)).query(`UPDATE cacsms.ExecutiveRecommendationAutonomyRuns SET Status=N'failed',ErrorMessage=@error,CompletedAt=SYSUTCDATETIME() WHERE ExecutiveRecommendationRunId=@run`);throw error;}
}
