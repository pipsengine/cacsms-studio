import sql from "mssql";
import {getMssqlPool} from "@/lib/database/mssql";

export const KNOWLEDGE_ALGORITHM_VERSION = "evidence-fusion-semantic-linking-v3";

type SettingsRow = {
  WorkspaceId: string; Enabled: boolean; RunIntervalSeconds: number; AutoVerifyThreshold: number;
  AutoLinkThreshold: number; ReviewThreshold: number; MaxRecordsPerRun: number;
  LastRunAt: Date | null; NextRunAt: Date | null;
};
type CandidateRow = {
  ContentRecordId: string; PageSlug: string; Title: string; Subtitle: string | null; Category: string;
  Score: number; Status: string; AttributesJson: string; UpdatedAt: Date;
};
type ExistingRow = {KnowledgeRecordId:string;Title:string;Slug:string;RecordType:string;DomainId:string|null;Confidence:number;QualityScore:number;MetadataJson:string|null};
type DomainRow = {KnowledgeDomainId:string;Slug:string;Name:string};
type FeatureVector = {
  authority:number; evidenceDepth:number; corroboration:number; freshness:number; completeness:number;
  provenance:number; consistency:number; diversity:number; confidence:number; quality:number;
};

export type KnowledgeAutonomyStatus = {
  enabled:boolean; state:"running"|"healthy"|"paused"|"waiting"|"failed"; algorithmVersion:string;
  intervalSeconds:number; lastRunAt:string|null; nextRunAt:string|null;
  thresholds:{verify:number;link:number;enrichment:number};
  lastRun:null|{id:string;status:string;trigger:string;scanned:number;created:number;updated:number;verified:number;flagged:number;links:number;averageConfidence:number;startedAt:string;completedAt:string|null;error:string|null};
  recentDecisions:Array<{id:number;type:string;action:string;score:number;title:string|null;rationale:Record<string,unknown>;createdAt:string}>;
};

const globalEngine = globalThis as typeof globalThis & {__knowledgeCycle?:Promise<KnowledgeCycleResult>};

export type KnowledgeCycleResult = {
  runId:string;status:"completed"|"skipped";scanned:number;created:number;updated:number;
  verified:number;flagged:number;links:number;averageConfidence:number;
};

const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const round=(value:number)=>Math.round(clamp(value)*10)/10;
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,210);
const words=(value:string)=>new Set(value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(token=>token.length>2&&!STOP_WORDS.has(token)));
const STOP_WORDS=new Set(["the","and","for","with","from","into","that","this","2025","2026","report","study"]);

function jaccard(left:string,right:string){const a=words(left),b=words(right);if(!a.size||!b.size)return 0;let overlap=0;for(const token of a)if(b.has(token))overlap++;return overlap/(a.size+b.size-overlap);}
function trigrams(value:string){const clean=`  ${value.toLowerCase().replace(/[^a-z0-9]/g," ").replace(/\s+/g," ")}  `;const set=new Set<string>();for(let i=0;i<clean.length-2;i++)set.add(clean.slice(i,i+3));return set;}
function dice(left:string,right:string){const a=trigrams(left),b=trigrams(right);if(!a.size||!b.size)return 0;let overlap=0;for(const gram of a)if(b.has(gram))overlap++;return (2*overlap)/(a.size+b.size);}
export function semanticSimilarity(left:string,right:string){return clamp((jaccard(left,right)*0.58+dice(left,right)*0.42)*100);}

function numberAttribute(attributes:Record<string,unknown>,names:string[],fallback:number){for(const name of names){const value=Number(attributes[name]);if(Number.isFinite(value))return clamp(value);}return clamp(fallback);}
function parseAttributes(value:string){try{return JSON.parse(value) as Record<string,unknown>;}catch{return {};}}
function sourceDiversity(attributes:Record<string,unknown>){const mix=String(attributes.sourceMix??attributes.agentRoute??"");const explicit=Number(attributes.sourceCount??attributes.sources);if(Number.isFinite(explicit))return clamp(45+Math.log2(Math.max(1,explicit))*9);return clamp(45+new Set(mix.toLowerCase().split(/\+|,|->/).map(x=>x.trim()).filter(Boolean)).size*11);}
function freshnessScore(updatedAt:Date){const ageDays=Math.max(0,(Date.now()-updatedAt.getTime())/86_400_000);return clamp(100*Math.pow(0.5,ageDays/180));}

export function evidenceFeatures(candidate:Pick<CandidateRow,"Score"|"Title"|"Subtitle"|"Category"|"AttributesJson"|"UpdatedAt">):FeatureVector{
  const attributes=parseAttributes(candidate.AttributesJson);
  const base=clamp(candidate.Score);
  const authority=numberAttribute(attributes,["authority","sourceAuthority","provenance"],base);
  const evidenceDepth=numberAttribute(attributes,["evidenceDepth","claimCoverage","sourceCount","linkedClaims"],base*0.82);
  const corroboration=numberAttribute(attributes,["corroboration","sourceAgreement","relationConfidence"],base*0.84);
  const provenance=numberAttribute(attributes,["provenance","provenanceDepth","linkIntegrity"],base*0.9);
  const consistency=100-numberAttribute(attributes,["contradictionRisk","duplicateRisk","riskScore"],Math.max(4,100-base));
  const diversity=sourceDiversity(attributes);
  const freshness=numberAttribute(attributes,["recency","freshness","citationFreshness"],freshnessScore(candidate.UpdatedAt));
  const completeness=clamp(45+(candidate.Title?18:0)+(candidate.Subtitle?12:0)+(candidate.Category?10:0)+Math.min(15,Object.keys(attributes).length*2));
  // Calibrated evidence ensemble: quality rewards provenance and corroboration; confidence is risk-adjusted.
  const quality=round(authority*0.17+evidenceDepth*0.17+corroboration*0.16+freshness*0.1+completeness*0.1+provenance*0.16+consistency*0.08+diversity*0.06);
  const evidenceLogit=(quality-50)/12+(base-50)/18+(consistency-50)/24;
  const confidence=round(100/(1+Math.exp(-evidenceLogit)));
  return {authority,evidenceDepth,corroboration,freshness,completeness,provenance,consistency,diversity,confidence,quality};
}

function recordType(page:string){if(["topic-discovery","trend-intelligence","content-gap-analysis"].includes(page))return "topic";if(["knowledge-extraction","knowledge-base"].includes(page))return "entity";return "source";}
function domainFor(candidate:CandidateRow,domains:DomainRow[]){const text=`${candidate.Title} ${candidate.Subtitle??""} ${candidate.Category}`.toLowerCase();const scores:Record<string,number>={
  "technology-innovation":["ai","digital","technology","robot","automation","cyber","data"].filter(x=>text.includes(x)).length,
  "industry-manufacturing":["industry","factory","manufactur","maintenance","operations","twin"].filter(x=>text.includes(x)).length,
  "africa-emerging-markets":["africa","nigeria","regional","sme","market"].filter(x=>text.includes(x)).length,
  "society-future":["work","skills","education","policy","society","human"].filter(x=>text.includes(x)).length
};
  const slug=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[1]>0?Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0]:"technology-innovation";
  return domains.find(domain=>domain.Slug===slug)?.KnowledgeDomainId??domains[0]?.KnowledgeDomainId??null;
}
function summary(candidate:CandidateRow){return `${candidate.Subtitle??candidate.Category}. Autonomously ingested from ${candidate.PageSlug.replaceAll("-"," ")} and evaluated by the CACSMS evidence fusion pipeline.`.slice(0,2000);}

async function settings(pool:sql.ConnectionPool){const result=await pool.request().query<SettingsRow>(`SELECT TOP(1) s.* FROM cacsms.KnowledgeAutonomySettings s JOIN cacsms.Workspaces w ON w.WorkspaceId=s.WorkspaceId WHERE w.Status=N'active' ORDER BY w.CreatedAt`);if(!result.recordset[0])throw new Error("Autonomous knowledge settings are not configured.");return result.recordset[0];}

export async function runAutonomousKnowledgeCycle(trigger="scheduler",force=false):Promise<KnowledgeCycleResult>{
  if(globalEngine.__knowledgeCycle)return globalEngine.__knowledgeCycle;
  const operation=executeCycle(trigger,force).finally(()=>{globalEngine.__knowledgeCycle=undefined;});
  globalEngine.__knowledgeCycle=operation;
  return operation;
}

async function executeCycle(trigger:string,force:boolean):Promise<KnowledgeCycleResult>{
  const pool=await getMssqlPool();const config=await settings(pool);const now=Date.now();
  if(!config.Enabled||(!force&&config.NextRunAt&&config.NextRunAt.getTime()>now))return {runId:"",status:"skipped",scanned:0,created:0,updated:0,verified:0,flagged:0,links:0,averageConfidence:0};
  const run=await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).input("trigger",sql.NVarChar(40),trigger.slice(0,40)).input("algorithm",sql.NVarChar(80),KNOWLEDGE_ALGORITHM_VERSION).query<{id:string}>(`INSERT cacsms.KnowledgeAutonomyRuns(WorkspaceId,TriggerSource,AlgorithmVersion,Status) OUTPUT CONVERT(nvarchar(36),inserted.KnowledgeAutonomyRunId) id VALUES(@workspace,@trigger,@algorithm,N'running')`);
  const runId=run.recordset[0].id;let created=0,updated=0,verified=0,flagged=0,links=0;const scores:number[]=[];
  try{
    const candidates=(await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).input("max",sql.Int,config.MaxRecordsPerRun).query<CandidateRow>(`SELECT TOP(@max) CONVERT(nvarchar(36),ContentRecordId) ContentRecordId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson,UpdatedAt FROM cacsms.ContentIntelligenceRecords WHERE WorkspaceId=@workspace ORDER BY UpdatedAt DESC,Score DESC`)).recordset;
    const existing=(await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).query<ExistingRow>(`SELECT CONVERT(nvarchar(36),KnowledgeRecordId) KnowledgeRecordId,Title,Slug,RecordType,CONVERT(nvarchar(36),DomainId) DomainId,CONVERT(float,Confidence) Confidence,CONVERT(float,QualityScore) QualityScore,MetadataJson FROM cacsms.KnowledgeRecords WHERE WorkspaceId=@workspace AND ArchivedAt IS NULL`)).recordset;
    const domains=(await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).query<DomainRow>(`SELECT CONVERT(nvarchar(36),KnowledgeDomainId) KnowledgeDomainId,Slug,Name FROM cacsms.KnowledgeDomains WHERE WorkspaceId=@workspace AND Status<>N'archived'`)).recordset;
    for(const candidate of candidates){
      const feature=evidenceFeatures(candidate);scores.push(feature.confidence);const type=recordType(candidate.PageSlug);const slug=slugify(candidate.Title);const domain=domainFor(candidate,domains);
      const nearest=existing.map(record=>({record,similarity:semanticSimilarity(candidate.Title,record.Title)})).sort((a,b)=>b.similarity-a.similarity)[0];
      const duplicate=nearest&&nearest.similarity>=86?nearest:null;
      // A second autonomous adjudication pass combines evidence quality with cross-record corroboration.
      // Records that are not yet safe to verify remain machine-owned "processing" work; none are sent to a human queue.
      const corroborationBoost=Math.min(8,(nearest?.similarity??0)*0.08);
      const adjudicatedConfidence=round(feature.confidence*0.72+Math.min(100,feature.quality+corroborationBoost)*0.28);
      const status=adjudicatedConfidence>=Number(config.AutoVerifyThreshold)&&feature.quality>=75?"verified":"processing";
      const metadata={autonomous:true,humanInputRequired:false,algorithm:KNOWLEDGE_ALGORITHM_VERSION,originalContentRecordId:candidate.ContentRecordId,originPage:candidate.PageSlug,originStatus:candidate.Status,features:feature,adjudication:{confidence:adjudicatedConfidence,corroborationBoost,nextAction:status==="verified"?"continuous-monitoring":"autonomous-enrichment"},semanticDuplicateScore:round(duplicate?.similarity??0),processedAt:new Date().toISOString()};
      let recordId:string;
      if(duplicate){
        recordId=duplicate.record.KnowledgeRecordId;await pool.request().input("id",sql.UniqueIdentifier,recordId).input("domain",sql.UniqueIdentifier,domain).input("summary",sql.NVarChar(2000),summary(candidate)).input("status",sql.NVarChar(30),status).input("confidence",sql.Decimal(5,2),adjudicatedConfidence).input("quality",sql.Decimal(5,2),feature.quality).input("metadata",sql.NVarChar(sql.MAX),JSON.stringify(metadata)).query(`UPDATE cacsms.KnowledgeRecords SET DomainId=COALESCE(DomainId,@domain),Summary=@summary,Status=@status,Confidence=@confidence,QualityScore=@quality,MetadataJson=@metadata,UpdatedAt=SYSUTCDATETIME() WHERE KnowledgeRecordId=@id`);updated++;
      }else{
        const inserted=await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).input("domain",sql.UniqueIdentifier,domain).input("type",sql.NVarChar(40),type).input("title",sql.NVarChar(300),candidate.Title.slice(0,300)).input("slug",sql.NVarChar(220),slug).input("summary",sql.NVarChar(2000),summary(candidate)).input("status",sql.NVarChar(30),status).input("source",sql.NVarChar(200),`Autonomous ${candidate.PageSlug}`.slice(0,200)).input("confidence",sql.Decimal(5,2),adjudicatedConfidence).input("quality",sql.Decimal(5,2),feature.quality).input("metadata",sql.NVarChar(sql.MAX),JSON.stringify(metadata)).query<{id:string}>(`INSERT cacsms.KnowledgeRecords(WorkspaceId,DomainId,RecordType,Title,Slug,Summary,Status,Source,Confidence,QualityScore,MetadataJson) OUTPUT CONVERT(nvarchar(36),inserted.KnowledgeRecordId) id VALUES(@workspace,@domain,@type,@title,@slug,@summary,@status,@source,@confidence,@quality,@metadata)`);recordId=inserted.recordset[0].id;existing.push({KnowledgeRecordId:recordId,Title:candidate.Title,Slug:slug,RecordType:type,DomainId:domain,Confidence:adjudicatedConfidence,QualityScore:feature.quality,MetadataJson:JSON.stringify(metadata)});created++;
      }
      if(status==="verified")verified++;else flagged++;
      await pool.request().input("run",sql.UniqueIdentifier,runId).input("record",sql.UniqueIdentifier,recordId).input("type",sql.NVarChar(40),duplicate?"deduplication":"classification").input("action",sql.NVarChar(60),status==="verified"?(duplicate?"merge-rescore-verify":"auto-verify"):(duplicate?"merge-enrich-autonomously":"continue-autonomous-enrichment")).input("score",sql.Decimal(5,2),adjudicatedConfidence).input("rationale",sql.NVarChar(sql.MAX),JSON.stringify({feature,adjudicatedConfidence,humanInputRequired:false,similarity:round(duplicate?.similarity??0),thresholds:{verify:config.AutoVerifyThreshold,enrichment:config.ReviewThreshold}})).query(`INSERT cacsms.KnowledgeAutonomyDecisions(KnowledgeAutonomyRunId,KnowledgeRecordId,DecisionType,Action,Score,RationaleJson) VALUES(@run,@record,@type,@action,@score,@rationale)`);
    }
    const recent=existing.slice(-80);
    for(let i=0;i<recent.length&&links<100;i++)for(let j=i+1;j<recent.length&&links<100;j++){
      const similarity=semanticSimilarity(recent[i].Title,recent[j].Title);const sameDomain=Boolean(recent[i].DomainId&&recent[i].DomainId===recent[j].DomainId);const confidence=round(sameDomain?Math.max(similarity,72+Math.min(18,(recent[i].QualityScore+recent[j].QualityScore-140)*0.15)):similarity);if(confidence<Number(config.AutoLinkThreshold)||recent[i].KnowledgeRecordId===recent[j].KnowledgeRecordId)continue;const relationship=sameDomain?"DOMAIN EVIDENCE":"SEMANTICALLY RELATED";
      const result=await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).input("source",sql.UniqueIdentifier,recent[i].KnowledgeRecordId).input("target",sql.UniqueIdentifier,recent[j].KnowledgeRecordId).input("relationship",sql.NVarChar(80),relationship).input("confidence",sql.Decimal(5,2),confidence).query(`IF EXISTS(SELECT 1 FROM cacsms.KnowledgeLinks WHERE SourceRecordId=@source AND TargetRecordId=@target AND RelationshipType=@relationship) UPDATE cacsms.KnowledgeLinks SET Status=N'verified',Source=N'Autonomous semantic-domain linker',Confidence=@confidence,UpdatedAt=SYSUTCDATETIME() WHERE SourceRecordId=@source AND TargetRecordId=@target AND RelationshipType=@relationship; ELSE BEGIN INSERT cacsms.KnowledgeLinks(WorkspaceId,SourceRecordId,TargetRecordId,RelationshipType,Status,Source,Confidence) VALUES(@workspace,@source,@target,@relationship,N'verified',N'Autonomous semantic-domain linker',@confidence); SELECT 1 created; END`);if(result.recordset?.length)links++;
    }
    const average=scores.length?round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
    await pool.request().input("run",sql.UniqueIdentifier,runId).input("scanned",sql.Int,candidates.length).input("created",sql.Int,created).input("updated",sql.Int,updated).input("verified",sql.Int,verified).input("flagged",sql.Int,flagged).input("links",sql.Int,links).input("average",sql.Decimal(5,2),average).input("workspace",sql.UniqueIdentifier,config.WorkspaceId).input("interval",sql.Int,config.RunIntervalSeconds).query(`UPDATE cacsms.KnowledgeAutonomyRuns SET Status=N'completed',CandidatesScanned=@scanned,RecordsCreated=@created,RecordsUpdated=@updated,RecordsVerified=@verified,RecordsFlagged=@flagged,LinksCreated=@links,AverageConfidence=@average,CompletedAt=SYSUTCDATETIME() WHERE KnowledgeAutonomyRunId=@run; UPDATE cacsms.KnowledgeAutonomySettings SET LastRunAt=SYSUTCDATETIME(),NextRunAt=DATEADD(SECOND,@interval,SYSUTCDATETIME()),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace`);
    return {runId,status:"completed",scanned:candidates.length,created,updated,verified,flagged,links,averageConfidence:average};
  }catch(error){const message=error instanceof Error?error.message:"Autonomous cycle failed";await pool.request().input("run",sql.UniqueIdentifier,runId).input("error",sql.NVarChar(1000),message.slice(0,1000)).query(`UPDATE cacsms.KnowledgeAutonomyRuns SET Status=N'failed',ErrorMessage=@error,CompletedAt=SYSUTCDATETIME() WHERE KnowledgeAutonomyRunId=@run`);throw error;}
}

export async function getKnowledgeAutonomyStatus():Promise<KnowledgeAutonomyStatus>{
  const pool=await getMssqlPool();const config=await settings(pool);
  const result=await pool.request().input("workspace",sql.UniqueIdentifier,config.WorkspaceId).query(`SELECT TOP(1) CONVERT(nvarchar(36),KnowledgeAutonomyRunId) id,Status status,TriggerSource [trigger],CandidatesScanned scanned,RecordsCreated created,RecordsUpdated updated,RecordsVerified verified,RecordsFlagged flagged,LinksCreated links,CONVERT(float,AverageConfidence) averageConfidence,CONVERT(nvarchar(40),StartedAt,127) startedAt,CONVERT(nvarchar(40),CompletedAt,127) completedAt,ErrorMessage error FROM cacsms.KnowledgeAutonomyRuns WHERE WorkspaceId=@workspace ORDER BY StartedAt DESC; SELECT TOP(12) d.KnowledgeAutonomyDecisionId id,d.DecisionType type,d.Action action,CONVERT(float,d.Score) score,r.Title title,d.RationaleJson rationaleJson,CONVERT(nvarchar(40),d.CreatedAt,127) createdAt FROM cacsms.KnowledgeAutonomyDecisions d LEFT JOIN cacsms.KnowledgeRecords r ON r.KnowledgeRecordId=d.KnowledgeRecordId JOIN cacsms.KnowledgeAutonomyRuns run ON run.KnowledgeAutonomyRunId=d.KnowledgeAutonomyRunId WHERE run.WorkspaceId=@workspace ORDER BY d.CreatedAt DESC;`);
  const sets=result.recordsets as unknown as Array<Array<Record<string,unknown>>>;const last=sets[0][0];const decisions=sets[1].map(row=>{let rationale={};try{rationale=JSON.parse(String(row.rationaleJson));}catch{}return {id:Number(row.id),type:String(row.type),action:String(row.action),score:Number(row.score),title:row.title?String(row.title):null,rationale,createdAt:String(row.createdAt)};});
  const state=!config.Enabled?"paused":last?.status==="running"?"running":last?.status==="failed"?"failed":last?"healthy":"waiting";
  return {enabled:Boolean(config.Enabled),state,algorithmVersion:KNOWLEDGE_ALGORITHM_VERSION,intervalSeconds:Number(config.RunIntervalSeconds),lastRunAt:config.LastRunAt?.toISOString()??null,nextRunAt:config.NextRunAt?.toISOString()??null,thresholds:{verify:Number(config.AutoVerifyThreshold),link:Number(config.AutoLinkThreshold),enrichment:Number(config.ReviewThreshold)},lastRun:last?{id:String(last.id),status:String(last.status),trigger:String(last.trigger),scanned:Number(last.scanned),created:Number(last.created),updated:Number(last.updated),verified:Number(last.verified),flagged:Number(last.flagged),links:Number(last.links),averageConfidence:Number(last.averageConfidence),startedAt:String(last.startedAt),completedAt:last.completedAt?String(last.completedAt):null,error:last.error?String(last.error):null}:null,recentDecisions:decisions};
}
