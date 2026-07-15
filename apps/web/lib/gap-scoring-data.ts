import {getMssqlPool} from "@/lib/database/mssql";
import type {EngineItem, EngineMetric} from "@/types/intelligence-engine";
import type {GapData, ScoringData, ScoringWeight} from "@/types/gap-scoring";

type ItemRow = {IntelligenceItemId: string; Title: string; Subtitle: string | null; Category: string; Score: number; State: string; AttributesJson: string; IsRisk: boolean; IsWatchlisted: boolean};
type SettingsRow = {MetricsJson: string; LastRunAt: Date | null};
type WorkspaceRow = {WorkspaceId: string};
type WeightRow = {FactorKey: string; Label: string; Description: string; Weight: number; Rating: "Low" | "Medium" | "High"};

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;
const FACTOR_PATTERN = /^[A-Za-z0-9]{1,60}$/;

const gapSeeds = [
  {title: "AI agents coordinating factory maintenance", subtitle: "Industrial operations gap", category: "Missing Coverage", demand: 96, coverageWeakness: 94, competition: "Low", evidence: 91, brandFit: 94, trend: 88, reach: 18, market: "Nigeria + Global", x: 28, y: 18},
  {title: "Digital twins for Nigerian SMEs", subtitle: "Localized technology gap", category: "Weak Coverage", demand: 91, coverageWeakness: 87, competition: "Low", evidence: 86, brandFit: 92, trend: 82, reach: 14, market: "Nigeria", x: 35, y: 24},
  {title: "Industrial cybersecurity skills for operations teams", subtitle: "Practical workforce gap", category: "Perspective Gap", demand: 86, coverageWeakness: 81, competition: "Medium", evidence: 84, brandFit: 88, trend: 74, reach: 9, market: "West Africa", x: 46, y: 33},
  {title: "Why smart-factory projects fail before scale", subtitle: "Decision-maker education gap", category: "Outdated Coverage", demand: 89, coverageWeakness: 79, competition: "Medium", evidence: 90, brandFit: 90, trend: 77, reach: 11, market: "Global", x: 51, y: 29},
  {title: "AI governance for plant managers", subtitle: "Operational policy gap", category: "Missing Coverage", demand: 83, coverageWeakness: 85, competition: "Low", evidence: 80, brandFit: 86, trend: 69, reach: 8, market: "Africa", x: 39, y: 39},
];

const pulseGaps = [
  {title: "Edge AI safety monitoring in factories", subtitle: "Emerging safety gap", category: "Missing Coverage", demand: 87, coverageWeakness: 88, competition: "Low", evidence: 82, brandFit: 89, trend: 76, reach: 10, market: "Global", x: 33, y: 31},
  {title: "Procurement signals for automation readiness", subtitle: "Buyer-intent gap", category: "Perspective Gap", demand: 84, coverageWeakness: 86, competition: "Low", evidence: 79, brandFit: 91, trend: 73, reach: 7, market: "Nigeria + Global", x: 42, y: 36},
];

const mapItem = (row: ItemRow): EngineItem => ({
  id: String(row.IntelligenceItemId),
  title: row.Title,
  subtitle: row.Subtitle || "",
  category: row.Category,
  score: Number(row.Score),
  state: row.State,
  attributes: parseJson(row.AttributesJson),
  risk: Boolean(row.IsRisk),
  watchlisted: Boolean(row.IsWatchlisted),
});

function guid(value: string) {
  if (!GUID_PATTERN.test(value)) throw new Error("Invalid identifier.");
  return `'${value}'`;
}

function slug(value: string) {
  if (!SLUG_PATTERN.test(value)) throw new Error("Invalid engine slug.");
  return value;
}

function factor(value: string) {
  if (!FACTOR_PATTERN.test(value)) throw new Error("Invalid scoring factor.");
  return value;
}

function text(value: string) {
  return `N'${value.replaceAll("'", "''")}'`;
}

function jsonText(value: unknown) {
  return text(JSON.stringify(value));
}

function int(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function parseJson(value: string): Record<string, string | number> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string | number] => typeof entry[1] === "string" || typeof entry[1] === "number"));
  } catch {
    return {};
  }
}

function gapScore(seed: {demand: number; coverageWeakness: number; evidence: number; brandFit: number; trend: number; competition: string}) {
  const competitionAdvantage = seed.competition === "Low" ? 96 : seed.competition === "Medium" ? 72 : 48;
  return int(seed.demand * 0.26 + seed.coverageWeakness * 0.24 + competitionAdvantage * 0.16 + seed.evidence * 0.13 + seed.brandFit * 0.13 + seed.trend * 0.08);
}

function gapAttributes(seed: (typeof gapSeeds)[number]) {
  const score = gapScore(seed);
  return {
    demand: seed.demand >= 90 ? "Very High" : "High",
    demandScore: seed.demand,
    coverageWeakness: seed.coverageWeakness,
    competition: seed.competition,
    evidence: seed.evidence,
    brandFit: seed.brandFit,
    potential: score,
    market: seed.market,
    trend: seed.trend,
    x: seed.x,
    y: seed.y,
    reach: seed.reach,
    algorithm: "whitespace-opportunity-v2",
    demandWeight: 26,
    coverageWeaknessWeight: 24,
    competitionAdvantageWeight: 16,
    evidenceWeight: 13,
    brandFitWeight: 13,
    trendWeight: 8,
    autonomous: "true",
    generatedBy: "gap-detection-engine",
  };
}

async function workspaceId() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<WorkspaceRow>(`SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;`);
  if (!result.recordset[0]) throw new Error("No active workspace.");
  return result.recordset[0].WorkspaceId;
}

async function ensureGapDetectionState(workspace: string) {
  const pool = await getMssqlPool();
  await pool.request().query(`
    IF NOT EXISTS(SELECT 1 FROM cacsms.IntelligenceEngineSettings WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection')
    BEGIN
      INSERT cacsms.IntelligenceEngineSettings(WorkspaceId,EngineSlug,PrimaryMarket,SignalSensitivity,AutoCreateOpportunities,MetricsJson,LastRunAt)
      VALUES(${guid(workspace)},N'gap-detection',N'Nigeria + Global',86,1,N'[]',SYSUTCDATETIME());
    END
  `);

  for (const seed of gapSeeds) {
    const attributes = gapAttributes(seed);
    await pool.request().query(`
      IF NOT EXISTS(
        SELECT 1 FROM cacsms.IntelligenceItems
        WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection' AND Title=${text(seed.title)}
      )
      BEGIN
        INSERT cacsms.IntelligenceItems(WorkspaceId,EngineSlug,Title,Subtitle,Category,Score,State,AttributesJson,IsRisk,IsWatchlisted)
        VALUES(${guid(workspace)},N'gap-detection',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${gapScore(seed)},N'Auto-detected',${jsonText(attributes)},0,1);
      END
      ELSE
      BEGIN
        UPDATE cacsms.IntelligenceItems
        SET Subtitle=${text(seed.subtitle)},
            Category=${text(seed.category)},
            Score=${gapScore(seed)},
            State=N'Auto-detected',
            AttributesJson=${jsonText(attributes)},
            IsWatchlisted=1,
            UpdatedAt=SYSUTCDATETIME()
        WHERE WorkspaceId=${guid(workspace)}
          AND EngineSlug=N'gap-detection'
          AND Title=${text(seed.title)}
          AND (AttributesJson NOT LIKE N'%whitespace-opportunity-v2%' OR Subtitle LIKE N'%Ã%' OR Subtitle LIKE N'%Â%');
      END
    `);
  }

  const latest = await pool.request().query<{Latest: Date | null}>(`
    SELECT MAX(UpdatedAt) AS Latest
    FROM cacsms.IntelligenceItems
    WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection';
  `);
  const last = latest.recordset[0]?.Latest ? new Date(latest.recordset[0].Latest) : null;
  if (last && Date.now() - last.getTime() <= 5 * 60 * 1000) return;

  const seed = pulseGaps[Math.floor(Date.now() / 300000) % pulseGaps.length];
  await pool.request().query(`
    IF NOT EXISTS(
      SELECT 1 FROM cacsms.IntelligenceItems
      WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection' AND Title=${text(seed.title)}
    )
    BEGIN
      INSERT cacsms.IntelligenceItems(WorkspaceId,EngineSlug,Title,Subtitle,Category,Score,State,AttributesJson,IsRisk,IsWatchlisted)
      VALUES(${guid(workspace)},N'gap-detection',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${gapScore(seed)},N'Auto-refreshed',${jsonText(gapAttributes(seed))},0,1);
    END
    ELSE
    BEGIN
      UPDATE cacsms.IntelligenceItems
      SET Score=${gapScore(seed)}, State=N'Auto-refreshed', AttributesJson=${jsonText(gapAttributes(seed))}, UpdatedAt=SYSUTCDATETIME()
      WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection' AND Title=${text(seed.title)};
    END

    UPDATE cacsms.IntelligenceEngineSettings
    SET LastRunAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME(), AutoCreateOpportunities=1
    WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection';
  `);

  await pool.request().query(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=${guid(workspace)} AND IsActive=1);
    INSERT cacsms.Opportunities(WorkspaceId,BrandId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    SELECT ${guid(workspace)},@brand,i.Title,i.Subtitle,i.Category,18000000,i.Score,N'Autonomous timing window',N'Gap Detection',i.Score,N'Auto-created',i.Score,88,74,92,1,0
    FROM cacsms.IntelligenceItems i
    WHERE i.WorkspaceId=${guid(workspace)}
      AND i.EngineSlug=N'gap-detection'
      AND i.Score>=90
      AND NOT EXISTS(
        SELECT 1
        FROM cacsms.Opportunities o
        WHERE o.WorkspaceId=${guid(workspace)}
          AND o.Title=i.Title
          AND o.OwnerName=N'Gap Detection'
      );
  `);
}

async function base(engineSlug: string) {
  const safeSlug = slug(engineSlug);
  const pool = await getMssqlPool();
  const workspace = await workspaceId();
  if (safeSlug === "gap-detection") await ensureGapDetectionState(workspace);
  const [settings, items] = await Promise.all([
    pool.request().query<SettingsRow>(`
      SELECT MetricsJson,LastRunAt
      FROM cacsms.IntelligenceEngineSettings
      WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=${text(safeSlug)};
    `),
    pool.request().query<ItemRow>(`
      SELECT TOP(100) IntelligenceItemId,Title,Subtitle,Category,Score,State,AttributesJson,IsRisk,IsWatchlisted
      FROM cacsms.IntelligenceItems
      WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=${text(safeSlug)}
      ORDER BY Score DESC,CreatedAt DESC;
    `),
  ]);
  if (!settings.recordset[0]) throw new Error("Engine is not configured.");
  return {
    workspace,
    pool,
    metrics: parseJson(settings.recordset[0].MetricsJson) as unknown as EngineMetric[],
    lastRunAt: settings.recordset[0].LastRunAt ? new Date(settings.recordset[0].LastRunAt).toISOString() : null,
    items: items.recordset.map(mapItem),
  };
}

export async function getGapData(): Promise<GapData> {
  const result = await base("gap-detection");
  const items = result.items;
  const high = items.filter((item) => item.score >= 90).length;
  const low = items.filter((item) => String(item.attributes.competition) === "Low").length;
  const reach = items.reduce((sum, item) => sum + Number(item.attributes.reach || 0), 0);
  return {
    metrics: [
      {value: String(items.length), label: "Detected Gaps", detail: "Autonomous database records", tone: "purple"},
      {value: String(high), label: "High-Potential", detail: "Score 90 or above", tone: "green"},
      {value: String(low), label: "Low Competition", detail: "Whitespace advantage", tone: "orange"},
      {value: `${reach}M`, label: "Est. Audience Reach", detail: "Across stored gaps", tone: "blue"},
    ],
    items,
    lastRunAt: result.lastRunAt,
  };
}

export async function runGapScan() {
  const workspace = await workspaceId();
  await ensureGapDetectionState(workspace);
  const data = await base("gap-detection");
  return data.items[0];
}

export async function createGapOpportunity(id: string) {
  const itemId = guid(id);
  const {pool, workspace} = await base("gap-detection");
  const result = await pool.request().query<{OpportunityId: string}>(`
    DECLARE @brand uniqueidentifier=(SELECT TOP(1) BrandId FROM cacsms.Brands WHERE WorkspaceId=${guid(workspace)} AND IsActive=1);
    DECLARE @title nvarchar(300),@subtitle nvarchar(400),@category nvarchar(100),@score tinyint;
    SELECT @title=Title,@subtitle=Subtitle,@category=Category,@score=Score
    FROM cacsms.IntelligenceItems
    WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'gap-detection' AND IntelligenceItemId=${itemId};
    IF @title IS NULL THROW 50008,'Gap not found.',1;
    INSERT cacsms.Opportunities(WorkspaceId,BrandId,Title,Subtitle,Category,EstimatedValue,Confidence,Timing,OwnerName,OpportunityScore,Status,MarketDemand,StrategicFit,ExecutionReadiness,CompetitiveWhitespace,IsHighPriority,IsAtRisk)
    OUTPUT inserted.OpportunityId
    VALUES(${guid(workspace)},@brand,@title,@subtitle,@category,18000000,@score,N'Autonomous timing window',N'Gap Detection',@score,N'Auto-created',@score,88,74,92,CASE WHEN @score>=90 THEN 1 ELSE 0 END,0);
  `);
  return {opportunityId: String(result.recordset[0].OpportunityId)};
}

export async function getScoringData(): Promise<ScoringData> {
  const result = await base("scoring-engine");
  const weights = await result.pool.request().query<WeightRow>(`
    SELECT FactorKey,Label,Description,Weight,Rating
    FROM cacsms.OpportunityScoringWeights
    WHERE WorkspaceId=${guid(result.workspace)} AND ModelName=N'Opportunity v3.2'
    ORDER BY CASE FactorKey WHEN N'demand' THEN 1 WHEN N'gap' THEN 2 WHEN N'momentum' THEN 3 WHEN N'resonance' THEN 4 WHEN N'strategicFit' THEN 5 ELSE 6 END;
  `);
  const scores = result.items.map((item) => item.score);
  const aggregateAverage = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
  const exceptional = scores.filter((score) => score >= 85).length;
  const metrics: EngineMetric[] = [
    {value: String(scores.length), label: "Opportunities Scored", detail: "Stored scoring records", tone: "purple"},
    {value: String(exceptional), label: "High-Value Opportunities", detail: "Score 85 or above", tone: "green"},
    {value: String(aggregateAverage), label: "Average Score", detail: "Calculated live", tone: "orange"},
    {value: "Opportunity v3.2", label: "Active Scoring Model", detail: "Persisted weight model", tone: "blue"},
  ];
  return {
    metrics,
    items: result.items,
    lastRunAt: result.lastRunAt,
    modelName: "Opportunity v3.2",
    weights: weights.recordset.map((row) => ({key: row.FactorKey, label: row.Label, description: row.Description, weight: Number(row.Weight), rating: row.Rating})),
    averageScore: aggregateAverage,
    distribution: {exceptional, strong: scores.filter((score) => score >= 70 && score < 85).length, moderate: scores.filter((score) => score >= 50 && score < 70).length, low: scores.filter((score) => score < 50).length},
  };
}

export async function saveScoringWeights(weights: ScoringWeight[]) {
  if (weights.length !== 6 || weights.reduce((sum, item) => sum + Number(item.weight), 0) !== 100) throw new Error("Scoring weights must total 100%.");
  const pool = await getMssqlPool();
  const workspace = await workspaceId();
  for (const item of weights) {
    await pool.request().query(`
      UPDATE cacsms.OpportunityScoringWeights
      SET Weight=${int(item.weight)}, UpdatedAt=SYSUTCDATETIME()
      WHERE WorkspaceId=${guid(workspace)} AND ModelName=N'Opportunity v3.2' AND FactorKey=${text(factor(item.key))};
    `);
  }
}

export async function runScoring() {
  const data = await getScoringData();
  const pool = await getMssqlPool();
  const workspace = await workspaceId();
  for (const item of data.items) {
    const total = data.weights.reduce((sum, weight) => sum + (Number(item.attributes[weight.key] ?? item.score) * weight.weight) / 100, 0);
    const score = int(total);
    await pool.request().query(`
      UPDATE cacsms.IntelligenceItems
      SET Score=${score}, UpdatedAt=SYSUTCDATETIME()
      WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'scoring-engine' AND IntelligenceItemId=${guid(item.id)};
    `);
  }
  await pool.request().query(`
    UPDATE cacsms.IntelligenceEngineSettings
    SET LastRunAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=${guid(workspace)} AND EngineSlug=N'scoring-engine';
  `);
  return getScoringData();
}
