import sql from "mssql";
import {getMssqlPool} from "@/lib/database/mssql";

export const EDITORIAL_AUTONOMY_ALGORITHM="evidence-editorial-orchestrator-v5";

type Settings={WorkspaceId:string;Enabled:boolean;RunIntervalSeconds:number;CurateThreshold:number;VerifyThreshold:number;ApproveThreshold:number;NextRunAt:Date|null};
type Candidate={OpportunityId:string;Title:string;Subtitle:string|null;Category:string;EstimatedValue:number;Confidence:number;OpportunityScore:number;MarketDemand:number;StrategicFit:number;ExecutionReadiness:number;CompetitiveWhitespace:number;IsAtRisk:boolean;SourceSignalId:string|null};
type EditorialRecord={RecordId:string;Title:string;MetadataJson:string|null};
export type EditorialCycleResult={runId:string;status:"completed"|"skipped";scanned:number;ingested:number;updated:number;verified:number;approved:number;held:number;duplicates:number;editorialHealth:number;averageConfidence:number};

const editorialGlobal=globalThis as typeof globalThis&{__editorialCycle?:Promise<EditorialCycleResult>};
const clamp=(value:number)=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
const round=(value:number)=>Math.round(clamp(value)*10)/10;
const tokens=(text:string)=>new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(token=>token.length>2));
function similarity(left:string,right:string){const a=tokens(left),b=tokens(right);if(!a.size||!b.size)return 0;let common=0;for(const token of a)if(b.has(token))common++;return common/(a.size+b.size-common)*100;}
function parse(value:string|null){try{return value?JSON.parse(value) as Record<string,unknown>:{};}catch{return {};}}

async function configuration(){const pool=await getMssqlPool();const result=await pool.request().query<Settings>(`SELECT TOP(1) s.* FROM cacsms.EditorialAutonomySettings s JOIN cacsms.Workspaces w ON w.WorkspaceId=s.WorkspaceId WHERE w.Status=N'active' ORDER BY w.CreatedAt`);if(!result.recordset[0])throw new Error("Autonomous editorial board is not configured.");return {pool,settings:result.recordset[0]};}

export async function runAutonomousEditorialCycle(trigger="scheduler",force=false){
  if(editorialGlobal.__editorialCycle)return editorialGlobal.__editorialCycle;
  const operation=execute(trigger,force).finally(()=>{editorialGlobal.__editorialCycle=undefined;});
  editorialGlobal.__editorialCycle=operation;
  return operation;
}

async function execute(trigger:string,force:boolean):Promise<EditorialCycleResult>{
  const {pool,settings}=await configuration();
  if(!settings.Enabled||(!force&&settings.NextRunAt&&settings.NextRunAt.getTime()>Date.now()))return {runId:"",status:"skipped",scanned:0,ingested:0,updated:0,verified:0,approved:0,held:0,duplicates:0,editorialHealth:0,averageConfidence:0};
  const started=await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("trigger",sql.NVarChar(40),trigger.slice(0,40)).input("algorithm",sql.NVarChar(100),EDITORIAL_AUTONOMY_ALGORITHM).query<{id:string}>(`INSERT cacsms.EditorialAutonomyRuns(WorkspaceId,TriggerSource,AlgorithmVersion,Status) OUTPUT CONVERT(nvarchar(36),inserted.EditorialAutonomyRunId) id VALUES(@workspace,@trigger,@algorithm,N'running')`);
  const runId=started.recordset[0].id;
  let ingested=0,updated=0,verified=0,approved=0,held=0,duplicates=0;
  const healthScores:number[]=[];const confidences:number[]=[];
  try{
    const candidates=(await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("threshold",sql.TinyInt,Math.round(settings.CurateThreshold)).query<Candidate>(`
      SELECT CONVERT(nvarchar(36),OpportunityId) OpportunityId,Title,Subtitle,Category,CONVERT(float,EstimatedValue) EstimatedValue,
        Confidence,OpportunityScore,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsAtRisk,
        CASE WHEN SourceSignalId IS NULL THEN NULL ELSE CONVERT(nvarchar(36),SourceSignalId) END SourceSignalId
      FROM cacsms.Opportunities WHERE WorkspaceId=@workspace AND IsArchived=0 AND OpportunityScore>=@threshold
      ORDER BY OpportunityScore DESC,UpdatedAt DESC;`)).recordset;
    const existing=(await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).query<EditorialRecord>(`
      SELECT CONVERT(nvarchar(36),RecordId) RecordId,Title,MetadataJson FROM cacsms.OpportunityOperationalRecords
      WHERE WorkspaceId=@workspace AND PageSlug=N'editorial-board';`)).recordset;
    const bySource=new Map<string,EditorialRecord>();for(const record of existing){const source=String(parse(record.MetadataJson).sourceOpportunityId??"");if(source)bySource.set(source.toLowerCase(),record);}
    const titles=existing.map(record=>record.Title);
    const categories=new Map<string,number>();for(const candidate of candidates)categories.set(candidate.Category,(categories.get(candidate.Category)??0)+1);

    for(const candidate of candidates){
      let record=bySource.get(candidate.OpportunityId.toLowerCase());
      if(!record){const nearest=titles.reduce((best,title)=>Math.max(best,similarity(candidate.Title,title)),0);if(nearest>=88){duplicates++;continue;}
        const initialMetadata=JSON.stringify({sourceOpportunityId:candidate.OpportunityId,sourceSignalId:candidate.SourceSignalId,algorithm:EDITORIAL_AUTONOMY_ALGORITHM,humanInputRequired:false});
        const inserted=await pool.request().input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("title",sql.NVarChar(300),candidate.Title).input("description",sql.NVarChar(1000),candidate.Subtitle??"Autonomously curated from opportunity intelligence.").input("category",sql.NVarChar(120),candidate.Category).input("score",sql.TinyInt,Math.round(candidate.OpportunityScore)).input("progress",sql.TinyInt,10).input("amount",sql.Decimal(18,2),candidate.EstimatedValue).input("metadata",sql.NVarChar(sql.MAX),initialMetadata).query<{RecordId:string}>(`INSERT cacsms.OpportunityOperationalRecords(WorkspaceId,PageSlug,RecordType,Title,Description,Category,Status,OwnerName,Score,Progress,Amount,StartAt,MetadataJson) OUTPUT CONVERT(nvarchar(36),inserted.RecordId) RecordId VALUES(@workspace,N'editorial-board',N'autonomous-pitch',@title,@description,@category,N'Auto-curated',N'Editorial Autonomy Engine',@score,@progress,@amount,SYSUTCDATETIME(),@metadata)`);
        record={RecordId:inserted.recordset[0].RecordId,Title:candidate.Title,MetadataJson:initialMetadata};bySource.set(candidate.OpportunityId.toLowerCase(),record);titles.push(candidate.Title);ingested++;
      }
      const signals=[candidate.OpportunityScore,candidate.Confidence,candidate.MarketDemand,candidate.StrategicFit,candidate.ExecutionReadiness,candidate.CompetitiveWhitespace];
      const mean=signals.reduce((sum,value)=>sum+value,0)/signals.length;
      const deviation=Math.sqrt(signals.reduce((sum,value)=>sum+(value-mean)**2,0)/signals.length);
      const agreement=round(100-deviation*2);
      const sourceStrength=candidate.SourceSignalId?100:68;
      const evidenceScore=round(candidate.Confidence*.38+agreement*.28+candidate.StrategicFit*.14+candidate.ExecutionReadiness*.1+sourceStrength*.1);
      const concentration=(categories.get(candidate.Category)??1)/Math.max(1,candidates.length)*100;
      const concentrationPenalty=Math.max(0,concentration-35)*.1;
      const riskPenalty=candidate.IsAtRisk?18:0;
      const editorialScore=round(candidate.OpportunityScore*.24+candidate.MarketDemand*.19+candidate.StrategicFit*.17+candidate.CompetitiveWhitespace*.13+candidate.ExecutionReadiness*.12+candidate.Confidence*.15-concentrationPenalty-riskPenalty);
      const decisionConfidence=round(evidenceScore*.52+editorialScore*.3+agreement*.18);
      const action=candidate.IsAtRisk||editorialScore<settings.CurateThreshold?"auto-hold-risk":editorialScore>=settings.ApproveThreshold&&evidenceScore>=settings.VerifyThreshold&&decisionConfidence>=80?"auto-approve-production":evidenceScore>=settings.VerifyThreshold?"auto-verify-evidence":"auto-curate";
      const status=action==="auto-hold-risk"?"Auto-held by risk":action==="auto-approve-production"?"Auto-approved for production":action==="auto-verify-evidence"?"Autonomous evidence verification":"Auto-curated";
      const progress=action==="auto-approve-production"?100:action==="auto-verify-evidence"?Math.round(clamp(55+evidenceScore*.35)):action==="auto-hold-risk"?Math.round(clamp(editorialScore*.45)):Math.round(clamp(editorialScore*.6));
      const rationale={algorithm:EDITORIAL_AUTONOMY_ALGORITHM,editorialScore,evidenceScore,decisionConfidence,agreement,sourceStrength,concentrationPenalty,riskPenalty,action,humanInputRequired:false};
      await pool.request().input("record",sql.UniqueIdentifier,record.RecordId).input("status",sql.NVarChar(60),status).input("score",sql.TinyInt,Math.round(editorialScore)).input("progress",sql.TinyInt,progress).input("description",sql.NVarChar(1000),candidate.Subtitle??"Autonomously curated from opportunity intelligence.").input("amount",sql.Decimal(18,2),candidate.EstimatedValue).input("metadata",sql.NVarChar(sql.MAX),JSON.stringify({...rationale,sourceOpportunityId:candidate.OpportunityId,sourceSignalId:candidate.SourceSignalId,evidenceVerified:action==="auto-approve-production"||action==="auto-verify-evidence"})).query(`UPDATE cacsms.OpportunityOperationalRecords SET Description=@description,Status=@status,OwnerName=N'Editorial Autonomy Engine',Score=@score,Progress=@progress,Amount=@amount,MetadataJson=@metadata,UpdatedAt=SYSUTCDATETIME() WHERE RecordId=@record`);
      await pool.request().input("run",sql.UniqueIdentifier,runId).input("record",sql.UniqueIdentifier,record.RecordId).input("opportunity",sql.UniqueIdentifier,candidate.OpportunityId).input("action",sql.NVarChar(60),action).input("score",sql.Decimal(5,2),editorialScore).input("evidence",sql.Decimal(5,2),evidenceScore).input("confidence",sql.Decimal(5,2),decisionConfidence).input("rationale",sql.NVarChar(sql.MAX),JSON.stringify(rationale)).query(`INSERT cacsms.EditorialAutonomyDecisions(EditorialAutonomyRunId,RecordId,OpportunityId,Action,EditorialScore,EvidenceScore,Confidence,RationaleJson) VALUES(@run,@record,@opportunity,@action,@score,@evidence,@confidence,@rationale)`);
      updated++;if(action==="auto-approve-production")approved++;if(action==="auto-verify-evidence")verified++;if(action==="auto-hold-risk")held++;healthScores.push(editorialScore*.55+evidenceScore*.45);confidences.push(decisionConfidence);
    }
    const editorialHealth=healthScores.length?round(healthScores.reduce((a,b)=>a+b,0)/healthScores.length):0;
    const averageConfidence=confidences.length?round(confidences.reduce((a,b)=>a+b,0)/confidences.length):0;
    await pool.request().input("run",sql.UniqueIdentifier,runId).input("workspace",sql.UniqueIdentifier,settings.WorkspaceId).input("scanned",sql.Int,candidates.length).input("ingested",sql.Int,ingested).input("updated",sql.Int,updated).input("verified",sql.Int,verified).input("approved",sql.Int,approved).input("held",sql.Int,held).input("duplicates",sql.Int,duplicates).input("health",sql.Decimal(5,2),editorialHealth).input("confidence",sql.Decimal(5,2),averageConfidence).input("interval",sql.Int,settings.RunIntervalSeconds).query(`UPDATE cacsms.EditorialAutonomyRuns SET Status=N'completed',CandidatesScanned=@scanned,RecordsIngested=@ingested,RecordsUpdated=@updated,RecordsVerified=@verified,RecordsApproved=@approved,RecordsHeld=@held,DuplicatesSuppressed=@duplicates,EditorialHealth=@health,AverageConfidence=@confidence,CompletedAt=SYSUTCDATETIME() WHERE EditorialAutonomyRunId=@run; UPDATE cacsms.EditorialAutonomySettings SET Enabled=1,LastRunAt=SYSUTCDATETIME(),NextRunAt=DATEADD(SECOND,@interval,SYSUTCDATETIME()),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace`);
    return {runId,status:"completed",scanned:candidates.length,ingested,updated,verified,approved,held,duplicates,editorialHealth,averageConfidence};
  }catch(error){const message=error instanceof Error?error.message:"Autonomous editorial cycle failed";await pool.request().input("run",sql.UniqueIdentifier,runId).input("error",sql.NVarChar(1000),message.slice(0,1000)).query(`UPDATE cacsms.EditorialAutonomyRuns SET Status=N'failed',ErrorMessage=@error,CompletedAt=SYSUTCDATETIME() WHERE EditorialAutonomyRunId=@run`);throw error;}
}
