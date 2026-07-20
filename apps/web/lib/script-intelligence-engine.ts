import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

type ProductionRow = {
  ProductionId: string;
  Code: string;
  Title: string;
  Stage: string;
  Status: string;
  Priority: string;
  UpdatedAt: Date;
  MetadataJson: string | null;
};

type ScriptVersionRow = {
  Content: string;
  CreatedAt: Date;
};

export type ScriptEntity = {
  label: string;
  mentions: number;
};

export type ScriptSceneBoundary = {
  label: string;
  index: number;
};

export type ScriptIntelligenceManifest = {
  generatedAt: string;
  method: string;
  scriptUpdatedAt: string | null;
  wordCount: number;
  characters: ScriptEntity[];
  locations: ScriptEntity[];
  timePeriods: ScriptEntity[];
  props: ScriptEntity[];
  emotions: ScriptEntity[];
  visualOpportunities: Array<{ excerpt: string; index: number }>;
  sceneBoundaries: ScriptSceneBoundary[];
};

export type ScriptIntelligenceProduction = {
  id: string;
  code: string;
  title: string;
  stage: string;
  status: string;
  priority: string;
  updatedAt: string;
  wordCount: number;
  method: string;
  generatedAt: string;
  stored: boolean;
  manifest: ScriptIntelligenceManifest | null;
};

export type ScriptIntelligencePayload = {
  generatedAt: string;
  productions: ScriptIntelligenceProduction[];
  summary: {
    total: number;
    withScripts: number;
    withManifest: number;
    averageWordCount: number;
  };
};

function parseJson(value: string | null): Record<string, unknown> {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function wordCount(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function tallyEntities(tokens: string[]) {
  const map = new Map<string, number>();
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, mentions]) => ({ label, mentions }))
    .sort((a, b) => b.mentions - a.mentions || a.label.localeCompare(b.label))
    .slice(0, 14);
}

function extractEntities(pattern: RegExp, text: string) {
  const matches = Array.from(text.matchAll(pattern)).map((match) => match[1] ?? "").filter(Boolean);
  return tallyEntities(matches);
}

function extractEmotions(text: string) {
  const emotions = [
    "curious",
    "hopeful",
    "urgent",
    "serious",
    "calm",
    "inspired",
    "concerned",
    "excited",
    "skeptical",
    "empathetic",
    "confident",
    "reflective"
  ];
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const emotion of emotions) {
    const regex = new RegExp(`\\b${emotion}\\b`, "g");
    const count = lower.match(regex)?.length ?? 0;
    for (let i = 0; i < count; i += 1) hits.push(emotion);
  }
  return tallyEntities(hits);
}

function extractVisualOpportunities(text: string) {
  const cues = /(shot|camera|close-up|wide|establishing|cut to|b-roll|visual|graphic|overlay|diagram|map)/i;
  const lines = text.split(/\r?\n/);
  const results: Array<{ excerpt: string; index: number }> = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    if (!cues.test(line)) return;
    results.push({ excerpt: line.trim().slice(0, 240), index });
  });
  return results.slice(0, 18);
}

function extractSceneBoundaries(text: string) {
  const matches = Array.from(text.matchAll(/^\s*(scene\s+\d+[^\n]*)$/gim));
  return matches.slice(0, 40).map((match, index) => ({
    label: String(match[1] ?? "").trim(),
    index
  }));
}

function buildManifest(input: { content: string; scriptUpdatedAt: string | null }) {
  const content = input.content.replace(/\u0000/g, "").trim();
  const manifest: ScriptIntelligenceManifest = {
    generatedAt: new Date().toISOString(),
    method: "heuristic-script-intelligence-v1",
    scriptUpdatedAt: input.scriptUpdatedAt,
    wordCount: wordCount(content),
    characters: extractEntities(/\b([A-Z][A-Z0-9]{2,}(?:\s+[A-Z][A-Z0-9]{2,})*)\s*:/g, content),
    locations: extractEntities(/\b(?:in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g, content),
    timePeriods: extractEntities(/\b(?:in\s+)?((?:18|19|20)\d{2}s?)\b/g, content),
    props: extractEntities(/\b(?:with|holding|using)\s+([A-Z]?[a-z]+(?:\s+[A-Z]?[a-z]+){0,3})\b/g, content),
    emotions: extractEmotions(content),
    visualOpportunities: extractVisualOpportunities(content),
    sceneBoundaries: extractSceneBoundaries(content)
  };
  return manifest;
}

async function resolveWorkspace(pool: sql.ConnectionPool) {
  const result = await pool.request().query<{ WorkspaceId: string }>(
    "SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;"
  );
  const row = result.recordset[0];
  if (!row) throw new Error("No active workspace.");
  return row.WorkspaceId;
}

async function listProductions(pool: sql.ConnectionPool, workspaceId: string) {
  const result = await pool
    .request()
    .input("workspace", sql.NVarChar(36), workspaceId)
    .query<ProductionRow>(`
      SELECT TOP(12)
        CONVERT(nvarchar(36), p.ProductionId) AS ProductionId,
        p.Code,
        p.Title,
        p.Stage,
        p.Status,
        p.Priority,
        p.UpdatedAt,
        p.MetadataJson
      FROM cacsms.Productions p
      WHERE CONVERT(nvarchar(36), p.WorkspaceId) = @workspace
        AND p.Status NOT IN (N'archived', N'cancelled')
      ORDER BY p.UpdatedAt DESC;
    `);
  return result.recordset;
}

async function loadLatestScript(pool: sql.ConnectionPool, productionId: string) {
  const result = await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .query<ScriptVersionRow>(`
      SELECT TOP(1)
        v.Content,
        v.CreatedAt
      FROM cacsms.ProductionScriptVersions v
      WHERE CONVERT(nvarchar(36), v.ProductionId) = @production
      ORDER BY v.CreatedAt DESC;
    `);
  return result.recordset[0] ?? null;
}

async function persistManifest(pool: sql.ConnectionPool, row: ProductionRow, manifest: ScriptIntelligenceManifest) {
  const metadata = parseJson(row.MetadataJson);
  const merged = {
    ...metadata,
    scriptIntelligence: manifest
  };
  await pool
    .request()
    .input("production", sql.NVarChar(36), row.ProductionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query("UPDATE cacsms.Productions SET MetadataJson=@metadata, UpdatedAt=SYSUTCDATETIME() WHERE CONVERT(nvarchar(36), ProductionId)=@production;");
}

function existingManifest(row: ProductionRow) {
  const metadata = parseJson(row.MetadataJson);
  const stored = asObject(metadata.scriptIntelligence);
  const generatedAt = typeof stored.generatedAt === "string" ? stored.generatedAt : null;
  if (!generatedAt) return null;
  return stored as unknown as ScriptIntelligenceManifest;
}

function shouldRegenerate(existing: ScriptIntelligenceManifest | null, latestScript: ScriptVersionRow | null) {
  if (!existing) return true;
  if (!latestScript) return false;
  const storedAt = existing.scriptUpdatedAt ? new Date(existing.scriptUpdatedAt).getTime() : 0;
  const scriptAt = latestScript.CreatedAt.getTime();
  return scriptAt > storedAt;
}

async function buildProduction(pool: sql.ConnectionPool, row: ProductionRow, mutate: boolean) {
  const latest = await loadLatestScript(pool, row.ProductionId);
  const stored = existingManifest(row);
  if (!latest) {
    return {
      id: row.ProductionId,
      code: row.Code,
      title: row.Title,
      stage: row.Stage,
      status: row.Status,
      priority: row.Priority,
      updatedAt: row.UpdatedAt.toISOString(),
      wordCount: 0,
      method: stored?.method ?? "heuristic-script-intelligence-v1",
      generatedAt: stored?.generatedAt ?? new Date().toISOString(),
      stored: Boolean(stored),
      manifest: stored
    } satisfies ScriptIntelligenceProduction;
  }

  const scriptUpdatedAt = latest.CreatedAt.toISOString();
  const regenerate = shouldRegenerate(stored, latest);
  const manifest = regenerate ? buildManifest({ content: latest.Content, scriptUpdatedAt }) : stored ?? buildManifest({ content: latest.Content, scriptUpdatedAt });
  if (mutate && regenerate) {
    await persistManifest(pool, row, manifest);
  }

  return {
    id: row.ProductionId,
    code: row.Code,
    title: row.Title,
    stage: row.Stage,
    status: row.Status,
    priority: row.Priority,
    updatedAt: row.UpdatedAt.toISOString(),
    wordCount: manifest.wordCount,
    method: manifest.method,
    generatedAt: manifest.generatedAt,
    stored: Boolean(stored) || (mutate && regenerate),
    manifest
  } satisfies ScriptIntelligenceProduction;
}

export async function getScriptIntelligenceWorkspaceData(): Promise<ScriptIntelligencePayload> {
  const pool = await getMssqlPool();
  const workspaceId = await resolveWorkspace(pool);
  const rows = await listProductions(pool, workspaceId);
  const productions = await Promise.all(rows.map((row) => buildProduction(pool, row, true)));
  const withScripts = productions.filter((item) => item.wordCount > 0).length;
  const withManifest = productions.filter((item) => Boolean(item.manifest)).length;
  const averageWordCount = withScripts
    ? Math.round(productions.reduce((total, item) => total + item.wordCount, 0) / Math.max(1, withScripts))
    : 0;
  return {
    generatedAt: new Date().toISOString(),
    productions,
    summary: {
      total: productions.length,
      withScripts,
      withManifest,
      averageWordCount
    }
  };
}

export async function runScriptIntelligenceScheduler(): Promise<ScriptIntelligencePayload> {
  return getScriptIntelligenceWorkspaceData();
}

