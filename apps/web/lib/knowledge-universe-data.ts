import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

export const knowledgeRecordTypes = ["entity", "relationship", "collection", "topic", "event", "location", "person", "organization", "source", "priority"] as const;
export const knowledgeStatuses = ["active", "verified", "review", "processing", "draft", "quarantined", "archived"] as const;
export type KnowledgeRecordType = (typeof knowledgeRecordTypes)[number];
export type KnowledgeStatus = (typeof knowledgeStatuses)[number];

export interface KnowledgeRecord {
  id: string;
  type: KnowledgeRecordType;
  title: string;
  slug: string;
  summary: string;
  status: KnowledgeStatus;
  source: string;
  confidence: number;
  qualityScore: number;
  domainId: string | null;
  domain: string | null;
  location: string | null;
  eventDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDomainRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "review" | "archived";
  confidence: number;
  itemCount: number;
  quality: number;
}

export interface KnowledgeLinkRow {
  id: string;
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  relationshipType: string;
  status: string;
  confidence: number;
}

export interface KnowledgeListResult {
  records: KnowledgeRecord[];
  domains: KnowledgeDomainRow[];
  links: KnowledgeLinkRow[];
  total: number;
  page: number;
  pageSize: number;
  metrics: { total: number; verified: number; review: number; processing: number; averageConfidence: number; averageQuality: number; relationships: number };
}

export interface KnowledgeListQuery {
  type?: string;
  search?: string;
  status?: string;
  domain?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface KnowledgeRecordInput {
  type: KnowledgeRecordType;
  title: string;
  summary: string;
  status: KnowledgeStatus;
  source: string;
  confidence: number;
  qualityScore: number;
  domainId?: string | null;
  location?: string | null;
  eventDate?: string | null;
  metadata?: Record<string, unknown>;
}

const selectRecord = `
  SELECT CONVERT(nvarchar(36), r.KnowledgeRecordId) id, r.RecordType type, r.Title title, r.Slug slug,
    r.Summary summary, r.Status status, r.Source source, CONVERT(float,r.Confidence) confidence,
    CONVERT(float,r.QualityScore) qualityScore, CONVERT(nvarchar(36),r.DomainId) domainId, d.Name domain,
    r.LocationName location, CONVERT(nvarchar(10),r.EventDate,23) eventDate, r.MetadataJson metadataJson,
    CONVERT(nvarchar(40),r.CreatedAt,127) createdAt, CONVERT(nvarchar(40),r.UpdatedAt,127) updatedAt
  FROM cacsms.KnowledgeRecords r LEFT JOIN cacsms.KnowledgeDomains d ON d.KnowledgeDomainId=r.DomainId`;

function cleanText(value: unknown, name: string, max: number, required = true) {
  const text = typeof value === "string" ? value.replace(/[<>\u0000-\u001f]/g, "").trim() : "";
  if (required && !text) throw new KnowledgeValidationError(`${name} is required.`, name);
  if (text.length > max) throw new KnowledgeValidationError(`${name} must be ${max} characters or fewer.`, name);
  return text;
}

function numericScore(value: unknown, name: string) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new KnowledgeValidationError(`${name} must be between 0 and 100.`, name);
  return Math.round(score * 10) / 10;
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 210);
}

export class KnowledgeValidationError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}

export function validateKnowledgeInput(value: unknown): KnowledgeRecordInput {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (!knowledgeRecordTypes.includes(input.type as KnowledgeRecordType)) throw new KnowledgeValidationError("A valid record type is required.", "type");
  if (!knowledgeStatuses.includes(input.status as KnowledgeStatus)) throw new KnowledgeValidationError("A valid status is required.", "status");
  const eventDate = cleanText(input.eventDate, "eventDate", 10, false) || null;
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new KnowledgeValidationError("Event date must use YYYY-MM-DD.", "eventDate");
  return {
    type: input.type as KnowledgeRecordType,
    title: cleanText(input.title, "title", 300),
    summary: cleanText(input.summary, "summary", 2000),
    status: input.status as KnowledgeStatus,
    source: cleanText(input.source, "source", 200),
    confidence: numericScore(input.confidence, "confidence"),
    qualityScore: numericScore(input.qualityScore, "qualityScore"),
    domainId: cleanText(input.domainId, "domainId", 36, false) || null,
    location: cleanText(input.location, "location", 200, false) || null,
    eventDate,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata as Record<string, unknown> : {}
  };
}

function mapRecord(row: Record<string, unknown>): KnowledgeRecord {
  let metadata: Record<string, unknown> = {};
  try { metadata = row.metadataJson ? JSON.parse(String(row.metadataJson)) : {}; } catch { metadata = {}; }
  return { ...(row as unknown as Omit<KnowledgeRecord, "metadata">), metadata };
}

async function workspaceId(transaction?: sql.Transaction) {
  const request = transaction ? new sql.Request(transaction) : (await getMssqlPool()).request();
  const result = await request.query<{ id: string }>(`SELECT TOP (1) CONVERT(nvarchar(36),WorkspaceId) id FROM cacsms.Workspaces ORDER BY CreatedAt`);
  if (!result.recordset[0]) throw new Error("No CACSMS workspace is configured.");
  return result.recordset[0].id;
}

export async function listKnowledgeRecords(query: KnowledgeListQuery = {}): Promise<KnowledgeListResult> {
  const pool = await getMssqlPool();
  const request = pool.request();
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
  const filters = ["r.ArchivedAt IS NULL"];
  if (query.type && knowledgeRecordTypes.includes(query.type as KnowledgeRecordType)) { request.input("type",sql.NVarChar(40),query.type); filters.push("r.RecordType=@type"); }
  if (query.status && knowledgeStatuses.includes(query.status as KnowledgeStatus)) { request.input("status",sql.NVarChar(30),query.status); filters.push("r.Status=@status"); }
  if (query.domain) { request.input("domain",sql.UniqueIdentifier,query.domain); filters.push("r.DomainId=@domain"); }
  if (query.search) { request.input("search",sql.NVarChar(310),`%${query.search.replace(/[%_[\]]/g," ").trim().slice(0,300)}%`); filters.push("(r.Title LIKE @search OR r.Summary LIKE @search OR r.Source LIKE @search)"); }
  const order = query.sort === "confidence" ? "r.Confidence DESC" : query.sort === "title" ? "r.Title ASC" : query.sort === "oldest" ? "r.UpdatedAt ASC" : "r.UpdatedAt DESC";
  request.input("offset",sql.Int,(page-1)*pageSize).input("pageSize",sql.Int,pageSize);
  const where = `WHERE ${filters.join(" AND ")}`;
  const result = await request.query(`${selectRecord} ${where} ORDER BY ${order} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    SELECT COUNT_BIG(*) total FROM cacsms.KnowledgeRecords r ${where};
    SELECT COUNT_BIG(*) total, SUM(CASE WHEN Status=N'verified' THEN 1 ELSE 0 END) verified, SUM(CASE WHEN Status=N'review' THEN 1 ELSE 0 END) review,
      SUM(CASE WHEN Status=N'processing' THEN 1 ELSE 0 END) processing,
      ISNULL(AVG(CONVERT(float,Confidence)),0) averageConfidence, ISNULL(AVG(CONVERT(float,QualityScore)),0) averageQuality
      FROM cacsms.KnowledgeRecords WHERE ArchivedAt IS NULL;
    SELECT COUNT_BIG(*) relationships FROM cacsms.KnowledgeLinks WHERE Status<>N'archived';
    SELECT CONVERT(nvarchar(36),d.KnowledgeDomainId) id,d.Name name,d.Slug slug,d.Description description,d.Status status,CONVERT(float,d.Confidence) confidence,
      COUNT(r.KnowledgeRecordId) itemCount,ISNULL(AVG(CONVERT(float,r.QualityScore)),0) quality
      FROM cacsms.KnowledgeDomains d LEFT JOIN cacsms.KnowledgeRecords r ON r.DomainId=d.KnowledgeDomainId AND r.ArchivedAt IS NULL
      GROUP BY d.KnowledgeDomainId,d.Name,d.Slug,d.Description,d.Status,d.Confidence ORDER BY d.Name;
    SELECT CONVERT(nvarchar(36),l.KnowledgeLinkId) id,CONVERT(nvarchar(36),l.SourceRecordId) sourceId,s.Title sourceTitle,
      CONVERT(nvarchar(36),l.TargetRecordId) targetId,t.Title targetTitle,l.RelationshipType relationshipType,l.Status status,CONVERT(float,l.Confidence) confidence
      FROM cacsms.KnowledgeLinks l JOIN cacsms.KnowledgeRecords s ON s.KnowledgeRecordId=l.SourceRecordId
      JOIN cacsms.KnowledgeRecords t ON t.KnowledgeRecordId=l.TargetRecordId WHERE l.Status<>N'archived' ORDER BY l.UpdatedAt DESC;`);
  const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
  const metric = sets[2][0] as unknown as Record<string, number>;
  return {
    records: sets[0].map(mapRecord), total:Number(sets[1][0].total), page,pageSize,
    metrics:{total:Number(metric.total),verified:Number(metric.verified),review:Number(metric.review),processing:Number(metric.processing),averageConfidence:Number(metric.averageConfidence),averageQuality:Number(metric.averageQuality),relationships:Number(sets[3][0].relationships)},
    domains: sets[4] as unknown as KnowledgeDomainRow[], links: sets[5] as unknown as KnowledgeLinkRow[]
  };
}

export async function createKnowledgeRecord(value: unknown) {
  const input=validateKnowledgeInput(value); const pool=await getMssqlPool(); const transaction=new sql.Transaction(pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const workspace=await workspaceId(transaction); const slug=slugify(input.title); const request=new sql.Request(transaction);
    request.input("workspace",sql.UniqueIdentifier,workspace).input("domain",sql.UniqueIdentifier,input.domainId).input("type",sql.NVarChar(40),input.type).input("title",sql.NVarChar(300),input.title).input("slug",sql.NVarChar(220),slug).input("summary",sql.NVarChar(2000),input.summary).input("status",sql.NVarChar(30),input.status).input("source",sql.NVarChar(200),input.source).input("confidence",sql.Decimal(5,2),input.confidence).input("quality",sql.Decimal(5,2),input.qualityScore).input("location",sql.NVarChar(200),input.location).input("eventDate",sql.Date,input.eventDate).input("metadata",sql.NVarChar(sql.MAX),JSON.stringify(input.metadata));
    const duplicate=await request.query(`SELECT 1 found FROM cacsms.KnowledgeRecords WITH (UPDLOCK,HOLDLOCK) WHERE WorkspaceId=@workspace AND RecordType=@type AND Slug=@slug`); if(duplicate.recordset.length) throw new KnowledgeValidationError("A record with this title and type already exists.","title");
    const inserted=await request.query<{id:string}>(`INSERT cacsms.KnowledgeRecords (WorkspaceId,DomainId,RecordType,Title,Slug,Summary,Status,Source,Confidence,QualityScore,LocationName,EventDate,MetadataJson) OUTPUT CONVERT(nvarchar(36),inserted.KnowledgeRecordId) id VALUES (@workspace,@domain,@type,@title,@slug,@summary,@status,@source,@confidence,@quality,@location,@eventDate,@metadata)`);
    const id=inserted.recordset[0].id; const selected=await new sql.Request(transaction).input("id",sql.UniqueIdentifier,id).query(`${selectRecord} WHERE r.KnowledgeRecordId=@id`); const record=mapRecord(selected.recordset[0]); await new sql.Request(transaction).input("workspace",sql.UniqueIdentifier,workspace).input("id",sql.UniqueIdentifier,record.id).input("after",sql.NVarChar(sql.MAX),JSON.stringify(record)).query(`INSERT cacsms.KnowledgeAuditHistory(WorkspaceId,KnowledgeRecordId,Action,AfterJson) VALUES(@workspace,@id,N'create',@after)`); await transaction.commit(); return record;
  } catch(error) { await transaction.rollback(); throw error; }
}

export async function updateKnowledgeRecord(id:string,value:unknown) {
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw new KnowledgeValidationError("Invalid record identifier."); const input=validateKnowledgeInput(value); const pool=await getMssqlPool(); const transaction=new sql.Transaction(pool); await transaction.begin();
  try { const workspace=await workspaceId(transaction); const request=new sql.Request(transaction); request.input("id",sql.UniqueIdentifier,id).input("workspace",sql.UniqueIdentifier,workspace).input("domain",sql.UniqueIdentifier,input.domainId).input("type",sql.NVarChar(40),input.type).input("title",sql.NVarChar(300),input.title).input("slug",sql.NVarChar(220),slugify(input.title)).input("summary",sql.NVarChar(2000),input.summary).input("status",sql.NVarChar(30),input.status).input("source",sql.NVarChar(200),input.source).input("confidence",sql.Decimal(5,2),input.confidence).input("quality",sql.Decimal(5,2),input.qualityScore).input("location",sql.NVarChar(200),input.location).input("eventDate",sql.Date,input.eventDate).input("metadata",sql.NVarChar(sql.MAX),JSON.stringify(input.metadata));
    const before=await request.query(`${selectRecord} WHERE r.KnowledgeRecordId=@id AND r.WorkspaceId=@workspace`); if(!before.recordset.length) throw new KnowledgeValidationError("Knowledge record was not found.");
    await request.query(`UPDATE cacsms.KnowledgeRecords SET DomainId=@domain,RecordType=@type,Title=@title,Slug=@slug,Summary=@summary,Status=@status,Source=@source,Confidence=@confidence,QualityScore=@quality,LocationName=@location,EventDate=@eventDate,MetadataJson=@metadata,ArchivedAt=CASE WHEN @status=N'archived' THEN SYSUTCDATETIME() ELSE NULL END,UpdatedAt=SYSUTCDATETIME() WHERE KnowledgeRecordId=@id AND WorkspaceId=@workspace`);
    const after=await request.query(`${selectRecord} WHERE r.KnowledgeRecordId=@id`); const record=mapRecord(after.recordset[0]); await request.input("before",sql.NVarChar(sql.MAX),JSON.stringify(mapRecord(before.recordset[0]))).input("after",sql.NVarChar(sql.MAX),JSON.stringify(record)).query(`INSERT cacsms.KnowledgeAuditHistory(WorkspaceId,KnowledgeRecordId,Action,BeforeJson,AfterJson) VALUES(@workspace,@id,N'update',@before,@after)`); await transaction.commit(); return record;
  } catch(error) { await transaction.rollback(); throw error; }
}

export async function archiveKnowledgeRecords(ids:string[]) {
  const clean=[...new Set(ids.filter(id=>/^[0-9a-f-]{36}$/i.test(id)))]; if(!clean.length) throw new KnowledgeValidationError("Select at least one valid record."); const pool=await getMssqlPool(); const transaction=new sql.Transaction(pool); await transaction.begin();
  try { const workspace=await workspaceId(transaction); for(const id of clean) { const request=new sql.Request(transaction).input("workspace",sql.UniqueIdentifier,workspace).input("id",sql.UniqueIdentifier,id); await request.query(`UPDATE cacsms.KnowledgeRecords SET Status=N'archived',ArchivedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE WorkspaceId=@workspace AND KnowledgeRecordId=@id; INSERT cacsms.KnowledgeAuditHistory(WorkspaceId,KnowledgeRecordId,Action) SELECT @workspace,@id,N'archive' WHERE @@ROWCOUNT>0;`); } await transaction.commit(); return {archived:clean.length}; } catch(error) { await transaction.rollback(); throw error; }
}
