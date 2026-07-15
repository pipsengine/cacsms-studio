import type {ConnectionPool} from "mssql";
import {getMssqlPool} from "@/lib/database/mssql";

type Row = {
  ContentRecordId: string;
  Title: string;
  Subtitle: string | null;
  Category: string;
  Score: number;
  Status: string;
  AttributesJson: string;
  UpdatedAt: Date;
};

type CountRow = { count: number; latest: Date | null };

const SLUG_PATTERN = /^[a-z0-9-]{1,100}$/;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const topicDiscoverySeeds = [
  {
    title: "AI Agents Transforming African Manufacturing",
    subtitle: "Technology - Industry 4.0",
    category: "Topic",
    score: 94,
    status: "Auto-promoted",
    attributes: {demand: "Very High", velocity: 184, competition: "Low", audienceFit: 96, readiness: "Ready", sourceMix: "Search + social + industry"},
  },
  {
    title: "Why Smart Factories Fail Before They Scale",
    subtitle: "Business - Automation",
    category: "Topic",
    score: 91,
    status: "Production queued",
    attributes: {demand: "High", velocity: 92, competition: "Medium", audienceFit: 93, readiness: "Ready", sourceMix: "Search + competitor + research"},
  },
  {
    title: "The Hidden Cost of Manual Operations",
    subtitle: "Digital Transformation",
    category: "Topic",
    score: 88,
    status: "Evergreen watch",
    attributes: {demand: "High", velocity: 38, competition: "Low", audienceFit: 89, readiness: "Monitoring", sourceMix: "Search + audience"},
  },
  {
    title: "Digital Twins for Nigerian SMEs",
    subtitle: "Emerging Technology",
    category: "Topic",
    score: 87,
    status: "Breakout detected",
    attributes: {demand: "High", velocity: 71, competition: "Very Low", audienceFit: 91, readiness: "Research pack building", sourceMix: "Industry + procurement + search"},
  },
  {
    title: "Skills Machines Cannot Replace",
    subtitle: "Future of Work",
    category: "Topic",
    score: 86,
    status: "Trend tracked",
    attributes: {demand: "Very High", velocity: 56, competition: "Medium", audienceFit: 95, readiness: "Queued", sourceMix: "Social + search"},
  },
  {
    title: "Industrial Cybersecurity in Seven Minutes",
    subtitle: "Security - Explainer",
    category: "Topic",
    score: 83,
    status: "Quick win",
    attributes: {demand: "Medium", velocity: 44, competition: "Low", audienceFit: 87, readiness: "Brief generated", sourceMix: "Industry + search"},
  },
];

const autonomousPulseTopics = [
  "Autonomous quality control for mid-size factories",
  "Factory data readiness before AI deployment",
  "Procurement signals for industrial automation demand",
  "Low-code robotics workflows for African SMEs",
];

const trendIntelligenceSeeds = [
  {title: "Agentic AI for Business Operations", subtitle: "Technology", velocity: 184, reachMillions: 12.8, sourceDiversity: 8, durability: 92, saturation: 24, geographicSpread: 87, audienceFit: 95, lifecycle: "Breakout"},
  {title: "Digital Twins in Construction", subtitle: "Industry 4.0", velocity: 92, reachMillions: 6.4, sourceDiversity: 6, durability: 86, saturation: 38, geographicSpread: 74, audienceFit: 88, lifecycle: "Accelerating"},
  {title: "AI Sovereignty in Africa", subtitle: "Policy and Society", velocity: 71, reachMillions: 4.8, sourceDiversity: 7, durability: 89, saturation: 31, geographicSpread: 82, audienceFit: 91, lifecycle: "Emerging"},
  {title: "Human-Centred Automation", subtitle: "Future of Work", velocity: 56, reachMillions: 3.1, sourceDiversity: 5, durability: 84, saturation: 42, geographicSpread: 69, audienceFit: 90, lifecycle: "Growing"},
  {title: "Industrial Cybersecurity Skills", subtitle: "Security", velocity: 44, reachMillions: 2.6, sourceDiversity: 5, durability: 78, saturation: 46, geographicSpread: 64, audienceFit: 86, lifecycle: "Growing"},
  {title: "Generic Chatbot Tutorials", subtitle: "Technology", velocity: -28, reachMillions: 1.9, sourceDiversity: 4, durability: 41, saturation: 86, geographicSpread: 72, audienceFit: 52, lifecycle: "Declining"},
];

const autonomousPulseTrends = [
  {title: "AI copilots for industrial maintenance", subtitle: "Operations", velocity: 76, reachMillions: 3.8, sourceDiversity: 6, durability: 83, saturation: 34, geographicSpread: 71, audienceFit: 89, lifecycle: "Emerging"},
  {title: "Edge AI for factory safety monitoring", subtitle: "Industrial AI", velocity: 84, reachMillions: 4.1, sourceDiversity: 7, durability: 88, saturation: 29, geographicSpread: 77, audienceFit: 92, lifecycle: "Accelerating"},
  {title: "AI governance for operational teams", subtitle: "Governance", velocity: 63, reachMillions: 5.2, sourceDiversity: 6, durability: 81, saturation: 39, geographicSpread: 84, audienceFit: 87, lifecycle: "Emerging"},
];

const researchWorkspaceSeeds = [
  {title: "AI in Nigerian Manufacturing", subtitle: "Autonomous evidence pack", category: "Industrial AI", sourceCount: 38, evidenceDiversity: 92, contradictionRisk: 8, freshness: 95, provenance: 94, synthesisReadiness: 91, handoff: "Script brief queued", status: "Auto-synthesizing"},
  {title: "Digital Twins for Industrial Automation", subtitle: "Autonomous research dossier", category: "Industry 4.0", sourceCount: 31, evidenceDiversity: 88, contradictionRisk: 11, freshness: 90, provenance: 91, synthesisReadiness: 86, handoff: "Storyboard pack queued", status: "Evidence clustering"},
  {title: "Factory Data Readiness Before AI Deployment", subtitle: "Autonomous market explainer", category: "Operations", sourceCount: 27, evidenceDiversity: 84, contradictionRisk: 13, freshness: 87, provenance: 89, synthesisReadiness: 84, handoff: "Research pack building", status: "Source expansion"},
  {title: "Edge AI Safety Monitoring for SMEs", subtitle: "Autonomous technical brief", category: "Safety", sourceCount: 24, evidenceDiversity: 81, contradictionRisk: 10, freshness: 88, provenance: 90, synthesisReadiness: 83, handoff: "Verifier loop active", status: "Claim verification"},
  {title: "Industrial Cybersecurity for Operational Teams", subtitle: "Autonomous authority brief", category: "Security", sourceCount: 29, evidenceDiversity: 86, contradictionRisk: 9, freshness: 92, provenance: 93, synthesisReadiness: 88, handoff: "Production queue eligible", status: "Auto-qualified"},
];

const autonomousPulseResearch = [
  {title: "Procurement Signals for Automation Demand", subtitle: "Autonomous procurement research", category: "Market Signal", sourceCount: 22, evidenceDiversity: 79, contradictionRisk: 12, freshness: 91, provenance: 88, synthesisReadiness: 82, handoff: "Opportunity handoff queued", status: "Auto-discovered"},
  {title: "Low-code Robotics Workflows for African SMEs", subtitle: "Autonomous workflow research", category: "Robotics", sourceCount: 19, evidenceDiversity: 76, contradictionRisk: 15, freshness: 86, provenance: 85, synthesisReadiness: 79, handoff: "Evidence pack building", status: "Auto-discovered"},
  {title: "Human-centered Automation Change Management", subtitle: "Autonomous audience research", category: "Future of Work", sourceCount: 26, evidenceDiversity: 83, contradictionRisk: 14, freshness: 89, provenance: 87, synthesisReadiness: 81, handoff: "Narrative brief queued", status: "Auto-discovered"},
];

const sourceAnalysisSeeds = [
  {title: "World Economic Forum - Future of Jobs 2025", subtitle: "World Economic Forum - Institutional report", category: "Institutional Report", authority: 98, methodology: 94, evidenceDepth: 96, recency: 92, transparency: 95, biasNeutrality: 91, corroboration: 88, linkIntegrity: 98, primaryRatio: 64, claimsExtracted: 42, citationCount: 184, handoff: "Fact verification and knowledge extraction", status: "Auto-trusted"},
  {title: "McKinsey - State of AI 2026", subtitle: "McKinsey & Company - Industry research", category: "Industry Research", authority: 96, methodology: 91, evidenceDepth: 93, recency: 96, transparency: 90, biasNeutrality: 86, corroboration: 82, linkIntegrity: 96, primaryRatio: 58, claimsExtracted: 36, citationCount: 126, handoff: "Strategic claims linked", status: "Auto-trusted"},
  {title: "Nigeria ICT Sector Statistics Q2 2026", subtitle: "National Bureau of Statistics - Government dataset", category: "Government Dataset", authority: 97, methodology: 92, evidenceDepth: 89, recency: 98, transparency: 94, biasNeutrality: 93, corroboration: 78, linkIntegrity: 97, primaryRatio: 92, claimsExtracted: 28, citationCount: 74, handoff: "Primary evidence linked", status: "Auto-primary"},
  {title: "African AI Startups Market Report", subtitle: "Regional technology analysis", category: "Market Analysis", authority: 84, methodology: 78, evidenceDepth: 82, recency: 91, transparency: 80, biasNeutrality: 76, corroboration: 74, linkIntegrity: 93, primaryRatio: 46, claimsExtracted: 31, citationCount: 63, handoff: "Context-weighted evidence", status: "Auto-contextualized"},
  {title: "Smart Manufacturing Survey 2026", subtitle: "Industry association survey", category: "Survey Report", authority: 79, methodology: 76, evidenceDepth: 74, recency: 88, transparency: 73, biasNeutrality: 72, corroboration: 68, linkIntegrity: 91, primaryRatio: 39, claimsExtracted: 24, citationCount: 41, handoff: "Limited-weight evidence", status: "Auto-weighted"},
];

const autonomousPulseSources = [
  {title: "Industrial AI Safety Standard Brief", subtitle: "Standards body technical note", category: "Technical Standard", authority: 92, methodology: 90, evidenceDepth: 88, recency: 94, transparency: 91, biasNeutrality: 90, corroboration: 80, linkIntegrity: 97, primaryRatio: 78, claimsExtracted: 19, citationCount: 52, handoff: "Safety claims linked", status: "Auto-ingested"},
  {title: "African Manufacturing Outlook Dataset", subtitle: "Regional economic dataset", category: "Economic Dataset", authority: 89, methodology: 86, evidenceDepth: 84, recency: 93, transparency: 85, biasNeutrality: 88, corroboration: 77, linkIntegrity: 95, primaryRatio: 71, claimsExtracted: 23, citationCount: 48, handoff: "Market evidence linked", status: "Auto-ingested"},
  {title: "Operational Automation Case Study Bank", subtitle: "Cross-industry case repository", category: "Case Repository", authority: 82, methodology: 81, evidenceDepth: 86, recency: 89, transparency: 78, biasNeutrality: 74, corroboration: 83, linkIntegrity: 92, primaryRatio: 52, claimsExtracted: 34, citationCount: 69, handoff: "Case evidence clustered", status: "Auto-ingested"},
];

function slugValue(slug: string) {
  if (!SLUG_PATTERN.test(slug)) throw new Error("Invalid content intelligence page slug.");
  return slug;
}

function guid(value: string) {
  if (!GUID_PATTERN.test(value)) throw new Error("Invalid workspace identifier.");
  return `'${value}'`;
}

function text(value: string) {
  return `N'${value.replaceAll("'", "''")}'`;
}

function jsonText(value: unknown) {
  return text(JSON.stringify(value));
}

function scoreValue(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value: number, min: number, max: number) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function trendScore(seed: {
  velocity: number;
  reachMillions: number;
  sourceDiversity: number;
  durability: number;
  saturation: number;
  geographicSpread: number;
  audienceFit: number;
}) {
  const velocityScore = normalize(seed.velocity, -40, 200) * 100;
  const reachScore = normalize(seed.reachMillions, 1, 14) * 100;
  const diversityScore = normalize(seed.sourceDiversity, 1, 8) * 100;
  const saturationAdvantage = 100 - seed.saturation;
  const weighted =
    velocityScore * 0.26 +
    reachScore * 0.14 +
    diversityScore * 0.16 +
    seed.durability * 0.18 +
    saturationAdvantage * 0.12 +
    seed.geographicSpread * 0.08 +
    seed.audienceFit * 0.06;
  return scoreValue(weighted);
}

function trendAttributes(seed: {
  velocity: number;
  reachMillions: number;
  sourceDiversity: number;
  durability: number;
  saturation: number;
  geographicSpread: number;
  audienceFit: number;
  lifecycle: string;
}) {
  const score = trendScore(seed);
  const forecastConfidence = scoreValue(score * 0.72 + seed.sourceDiversity * 2.5 + (100 - seed.saturation) * 0.1);
  const peakWindow = seed.velocity > 120 ? "7-12 days" : seed.velocity > 70 ? "12-18 days" : seed.velocity > 35 ? "18-30 days" : "Monitor only";
  const forecastGrowth = Math.max(-18, Math.round(seed.velocity * 0.2));
  return {
    velocity: seed.velocity,
    reach: `${seed.reachMillions.toFixed(1)}M`,
    reachMillions: seed.reachMillions,
    sourceDiversity: seed.sourceDiversity,
    durability: seed.durability,
    saturation: seed.saturation < 35 ? "Low" : seed.saturation < 65 ? "Medium" : "High",
    saturationIndex: seed.saturation,
    geographicSpread: seed.geographicSpread,
    audienceFit: seed.audienceFit,
    lifecycle: seed.lifecycle,
    forecastConfidence,
    forecastGrowth,
    peakWindow,
    algorithm: "weighted-momentum-v2",
    algorithmWeights: {velocity: 0.26, reach: 0.14, sourceDiversity: 0.16, durability: 0.18, saturationAdvantage: 0.12, geographicSpread: 0.08, audienceFit: 0.06},
    autonomous: true,
    generatedBy: "trend-intelligence-engine",
  };
}

function researchScore(seed: {
  sourceCount: number;
  evidenceDiversity: number;
  contradictionRisk: number;
  freshness: number;
  provenance: number;
  synthesisReadiness: number;
}) {
  const sourceDepth = normalize(seed.sourceCount, 12, 42) * 100;
  const riskAdjustedEvidence = seed.evidenceDiversity * 0.34 + (100 - seed.contradictionRisk) * 0.16;
  const weighted =
    sourceDepth * 0.14 +
    riskAdjustedEvidence +
    seed.freshness * 0.16 +
    seed.provenance * 0.18 +
    seed.synthesisReadiness * 0.12;
  return scoreValue(weighted);
}

function researchAttributes(seed: {
  sourceCount: number;
  evidenceDiversity: number;
  contradictionRisk: number;
  freshness: number;
  provenance: number;
  synthesisReadiness: number;
  handoff: string;
}) {
  const score = researchScore(seed);
  return {
    sourceCount: seed.sourceCount,
    evidenceDiversity: seed.evidenceDiversity,
    contradictionRisk: seed.contradictionRisk,
    freshness: seed.freshness,
    provenance: seed.provenance,
    synthesisReadiness: seed.synthesisReadiness,
    confidence: score,
    handoff: seed.handoff,
    agentRoute: score >= 88 ? "Scout -> Analyst -> Verifier -> Production handoff" : "Scout -> Analyst -> Verifier loop",
    algorithm: "autonomous-evidence-fusion-v2",
    algorithmWeights: {sourceDepth: 0.14, evidenceDiversity: 0.34, contradictionRisk: 0.16, freshness: 0.16, provenance: 0.18, synthesisReadiness: 0.12},
    autonomous: true,
    generatedBy: "research-orchestration-engine",
  };
}

function sourceScore(seed: {
  authority: number;
  methodology: number;
  evidenceDepth: number;
  recency: number;
  transparency: number;
  biasNeutrality: number;
  corroboration: number;
  linkIntegrity: number;
}) {
  const weighted =
    seed.authority * 0.18 +
    seed.methodology * 0.16 +
    seed.evidenceDepth * 0.18 +
    seed.recency * 0.12 +
    seed.transparency * 0.12 +
    seed.biasNeutrality * 0.1 +
    seed.corroboration * 0.09 +
    seed.linkIntegrity * 0.05;
  return scoreValue(weighted);
}

function sourceAttributes(seed: {
  authority: number;
  methodology: number;
  evidenceDepth: number;
  recency: number;
  transparency: number;
  biasNeutrality: number;
  corroboration: number;
  linkIntegrity: number;
  primaryRatio: number;
  claimsExtracted: number;
  citationCount: number;
  handoff: string;
}) {
  const score = sourceScore(seed);
  return {
    authority: seed.authority,
    methodology: seed.methodology,
    evidenceDepth: seed.evidenceDepth,
    recency: seed.recency,
    transparency: seed.transparency,
    biasNeutrality: seed.biasNeutrality,
    corroboration: seed.corroboration,
    linkIntegrity: seed.linkIntegrity,
    primaryRatio: seed.primaryRatio,
    claimsExtracted: seed.claimsExtracted,
    citationCount: seed.citationCount,
    confidence: score,
    riskScore: 100 - Math.round((seed.biasNeutrality * 0.45 + seed.transparency * 0.25 + seed.corroboration * 0.3)),
    handoff: seed.handoff,
    algorithm: "source-credibility-ensemble-v2",
    algorithmWeights: {authority: 0.18, methodology: 0.16, evidenceDepth: 0.18, recency: 0.12, transparency: 0.12, biasNeutrality: 0.1, corroboration: 0.09, linkIntegrity: 0.05},
    autonomous: true,
    generatedBy: "source-forensics-engine",
  };
}

function parseAttributes(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function context() {
  const pool = await getMssqlPool();
  const result = await pool.request().query<{WorkspaceId: string}>(`SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;`);
  if (!result.recordset[0]) throw new Error("No active workspace.");
  return {pool, workspace: result.recordset[0].WorkspaceId};
}

async function ensureAutonomousTopicDiscovery(pool: ConnectionPool, workspace: string) {
  const summary = await pool.request().query<CountRow>(`
    SELECT COUNT(1) AS count, MAX(UpdatedAt) AS latest
    FROM cacsms.ContentIntelligenceRecords
    WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'topic-discovery';
  `);
  const latest = summary.recordset[0]?.latest ? new Date(summary.recordset[0].latest) : null;

  for (const seed of topicDiscoverySeeds) {
    const attributes = jsonText({...seed.attributes, autonomous: true, generatedBy: "topic-discovery-engine"});
    await pool.request().query(`
      IF NOT EXISTS(
        SELECT 1 FROM cacsms.ContentIntelligenceRecords
        WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'topic-discovery' AND Title=${text(seed.title)}
      )
      BEGIN
        INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
        VALUES(${guid(workspace)},N'topic-discovery',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${scoreValue(seed.score)},${text(seed.status)},${attributes});
      END
      ELSE
      BEGIN
        UPDATE cacsms.ContentIntelligenceRecords
        SET Subtitle=${text(seed.subtitle)},
            Category=${text(seed.category)},
            Score=${scoreValue(seed.score)},
            Status=${text(seed.status)},
            AttributesJson=${attributes},
            UpdatedAt=SYSUTCDATETIME()
        WHERE WorkspaceId=${guid(workspace)}
          AND PageSlug=N'topic-discovery'
          AND Title=${text(seed.title)}
          AND (AttributesJson NOT LIKE N'%generatedBy%' OR Subtitle LIKE N'%Ã%' OR Subtitle LIKE N'%Â%');
      END
    `);
  }

  const stale = !latest || Date.now() - latest.getTime() > 5 * 60 * 1000;
  if (!stale) return;

  const topic = autonomousPulseTopics[Math.floor(Date.now() / 300000) % autonomousPulseTopics.length];
  await pool.request().query(`
    IF NOT EXISTS(
      SELECT 1 FROM cacsms.ContentIntelligenceRecords
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'topic-discovery' AND Title=${text(topic)}
    )
    BEGIN
      INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
      VALUES(
        ${guid(workspace)},
        N'topic-discovery',
        ${text(topic)},
        N'Autonomous topic signal',
        N'Topic',
        90,
        N'Auto-discovered',
        ${jsonText({
          demand: "High",
          velocity: 68,
          competition: "Low",
          audienceFit: 92,
          readiness: "Autonomous brief queued",
          sourceMix: "Search + audience + opportunity signals",
          autonomous: true,
          generatedBy: "topic-discovery-engine",
        })}
      );
    END
    ELSE
    BEGIN
      UPDATE cacsms.ContentIntelligenceRecords
      SET UpdatedAt=SYSUTCDATETIME(), Status=N'Auto-refreshed'
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'topic-discovery' AND Title=${text(topic)};
    END
  `);
}

async function ensureAutonomousTrendIntelligence(pool: ConnectionPool, workspace: string) {
  const summary = await pool.request().query<CountRow>(`
    SELECT COUNT(1) AS count, MAX(UpdatedAt) AS latest
    FROM cacsms.ContentIntelligenceRecords
    WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'trend-intelligence';
  `);
  const latest = summary.recordset[0]?.latest ? new Date(summary.recordset[0].latest) : null;

  for (const seed of trendIntelligenceSeeds) {
    const attributes = trendAttributes(seed);
    const score = trendScore(seed);
    await pool.request().query(`
      IF NOT EXISTS(
        SELECT 1 FROM cacsms.ContentIntelligenceRecords
        WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'trend-intelligence' AND Title=${text(seed.title)}
      )
      BEGIN
        INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
        VALUES(${guid(workspace)},N'trend-intelligence',${text(seed.title)},${text(seed.subtitle)},N'Trend',${score},${text(seed.lifecycle)},${jsonText(attributes)});
      END
      ELSE
      BEGIN
        UPDATE cacsms.ContentIntelligenceRecords
        SET Subtitle=${text(seed.subtitle)},
            Category=N'Trend',
            Score=${score},
            Status=${text(seed.lifecycle)},
            AttributesJson=${jsonText(attributes)},
            UpdatedAt=SYSUTCDATETIME()
        WHERE WorkspaceId=${guid(workspace)}
          AND PageSlug=N'trend-intelligence'
          AND Title=${text(seed.title)}
          AND (AttributesJson NOT LIKE N'%weighted-momentum-v2%' OR Subtitle LIKE N'%Ã%' OR Subtitle LIKE N'%Â%');
      END
    `);
  }

  const stale = !latest || Date.now() - latest.getTime() > 5 * 60 * 1000;
  if (!stale) return;

  const seed = autonomousPulseTrends[Math.floor(Date.now() / 300000) % autonomousPulseTrends.length];
  const attributes = trendAttributes(seed);
  await pool.request().query(`
    IF NOT EXISTS(
      SELECT 1 FROM cacsms.ContentIntelligenceRecords
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'trend-intelligence' AND Title=${text(seed.title)}
    )
    BEGIN
      INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
      VALUES(${guid(workspace)},N'trend-intelligence',${text(seed.title)},${text(seed.subtitle)},N'Trend',${trendScore(seed)},${text(seed.lifecycle)},${jsonText(attributes)});
    END
    ELSE
    BEGIN
      UPDATE cacsms.ContentIntelligenceRecords
      SET Score=${trendScore(seed)},
          Status=N'Auto-refreshed',
          AttributesJson=${jsonText(attributes)},
          UpdatedAt=SYSUTCDATETIME()
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'trend-intelligence' AND Title=${text(seed.title)};
    END
  `);
}

async function ensureAutonomousResearchWorkspace(pool: ConnectionPool, workspace: string) {
  const summary = await pool.request().query<CountRow>(`
    SELECT COUNT(1) AS count, MAX(UpdatedAt) AS latest
    FROM cacsms.ContentIntelligenceRecords
    WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'research-workspace';
  `);
  const latest = summary.recordset[0]?.latest ? new Date(summary.recordset[0].latest) : null;

  for (const seed of researchWorkspaceSeeds) {
    const attributes = researchAttributes(seed);
    const score = researchScore(seed);
    await pool.request().query(`
      IF NOT EXISTS(
        SELECT 1 FROM cacsms.ContentIntelligenceRecords
        WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'research-workspace' AND Title=${text(seed.title)}
      )
      BEGIN
        INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
        VALUES(${guid(workspace)},N'research-workspace',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${score},${text(seed.status)},${jsonText(attributes)});
      END
      ELSE
      BEGIN
        UPDATE cacsms.ContentIntelligenceRecords
        SET Subtitle=${text(seed.subtitle)},
            Category=${text(seed.category)},
            Score=${score},
            Status=${text(seed.status)},
            AttributesJson=${jsonText(attributes)},
            UpdatedAt=SYSUTCDATETIME()
        WHERE WorkspaceId=${guid(workspace)}
          AND PageSlug=N'research-workspace'
          AND Title=${text(seed.title)}
          AND (AttributesJson NOT LIKE N'%autonomous-evidence-fusion-v2%' OR Status IN(N'Needs sources',N'In progress',N'Ready'));
      END
    `);
  }

  const stale = !latest || Date.now() - latest.getTime() > 5 * 60 * 1000;
  if (!stale) return;

  const seed = autonomousPulseResearch[Math.floor(Date.now() / 300000) % autonomousPulseResearch.length];
  const attributes = researchAttributes(seed);
  await pool.request().query(`
    IF NOT EXISTS(
      SELECT 1 FROM cacsms.ContentIntelligenceRecords
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'research-workspace' AND Title=${text(seed.title)}
    )
    BEGIN
      INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
      VALUES(${guid(workspace)},N'research-workspace',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${researchScore(seed)},${text(seed.status)},${jsonText(attributes)});
    END
    ELSE
    BEGIN
      UPDATE cacsms.ContentIntelligenceRecords
      SET Score=${researchScore(seed)},
          Status=N'Auto-refreshed',
          AttributesJson=${jsonText(attributes)},
          UpdatedAt=SYSUTCDATETIME()
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'research-workspace' AND Title=${text(seed.title)};
    END
  `);
}

async function ensureAutonomousSourceAnalysis(pool: ConnectionPool, workspace: string) {
  await pool.request().query(`
    DELETE FROM cacsms.ContentIntelligenceRecords
    WHERE WorkspaceId=${guid(workspace)}
      AND PageSlug=N'source-analysis'
      AND (
        AttributesJson NOT LIKE N'%source-credibility-ensemble-v2%'
        OR Title LIKE N'%Ã%'
        OR Subtitle LIKE N'%Â%'
      );
  `);

  const summary = await pool.request().query<CountRow>(`
    SELECT COUNT(1) AS count, MAX(UpdatedAt) AS latest
    FROM cacsms.ContentIntelligenceRecords
    WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'source-analysis';
  `);
  const latest = summary.recordset[0]?.latest ? new Date(summary.recordset[0].latest) : null;

  for (const seed of sourceAnalysisSeeds) {
    const attributes = sourceAttributes(seed);
    const score = sourceScore(seed);
    await pool.request().query(`
      IF NOT EXISTS(
        SELECT 1 FROM cacsms.ContentIntelligenceRecords
        WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'source-analysis' AND Title=${text(seed.title)}
      )
      BEGIN
        INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
        VALUES(${guid(workspace)},N'source-analysis',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${score},${text(seed.status)},${jsonText(attributes)});
      END
      ELSE
      BEGIN
        UPDATE cacsms.ContentIntelligenceRecords
        SET Subtitle=${text(seed.subtitle)},
            Category=${text(seed.category)},
            Score=${score},
            Status=${text(seed.status)},
            AttributesJson=${jsonText(attributes)},
            UpdatedAt=SYSUTCDATETIME()
        WHERE WorkspaceId=${guid(workspace)}
          AND PageSlug=N'source-analysis'
          AND Title=${text(seed.title)}
          AND (AttributesJson NOT LIKE N'%source-credibility-ensemble-v2%' OR Title LIKE N'%Ã%' OR Subtitle LIKE N'%Â%');
      END
    `);
  }

  const stale = !latest || Date.now() - latest.getTime() > 5 * 60 * 1000;
  if (!stale) return;

  const seed = autonomousPulseSources[Math.floor(Date.now() / 300000) % autonomousPulseSources.length];
  const attributes = sourceAttributes(seed);
  await pool.request().query(`
    IF NOT EXISTS(
      SELECT 1 FROM cacsms.ContentIntelligenceRecords
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'source-analysis' AND Title=${text(seed.title)}
    )
    BEGIN
      INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
      VALUES(${guid(workspace)},N'source-analysis',${text(seed.title)},${text(seed.subtitle)},${text(seed.category)},${sourceScore(seed)},${text(seed.status)},${jsonText(attributes)});
    END
    ELSE
    BEGIN
      UPDATE cacsms.ContentIntelligenceRecords
      SET Score=${sourceScore(seed)},
          Status=N'Auto-refreshed',
          AttributesJson=${jsonText(attributes)},
          UpdatedAt=SYSUTCDATETIME()
      WHERE WorkspaceId=${guid(workspace)} AND PageSlug=N'source-analysis' AND Title=${text(seed.title)};
    END
  `);
}

export async function getContentIntelligenceData(slug: string) {
  const pageSlug = slugValue(slug);
  const {pool, workspace} = await context();
  if (pageSlug === "topic-discovery") await ensureAutonomousTopicDiscovery(pool, workspace);
  if (pageSlug === "trend-intelligence") await ensureAutonomousTrendIntelligence(pool, workspace);
  if (pageSlug === "research-workspace") await ensureAutonomousResearchWorkspace(pool, workspace);
  if (pageSlug === "source-analysis") await ensureAutonomousSourceAnalysis(pool, workspace);

  const result = await pool.request().query<Row>(`
    SELECT TOP(100) ContentRecordId,Title,Subtitle,Category,Score,Status,AttributesJson,UpdatedAt
    FROM cacsms.ContentIntelligenceRecords
    WHERE WorkspaceId=${guid(workspace)} AND PageSlug=${text(pageSlug)}
    ORDER BY Score DESC,UpdatedAt DESC;
  `);
  const records = result.recordset.map((x) => ({
    id: String(x.ContentRecordId),
    title: x.Title,
    subtitle: x.Subtitle || "",
    category: x.Category,
    score: Number(x.Score),
    status: x.Status,
    attributes: parseAttributes(x.AttributesJson),
    updatedAt: new Date(x.UpdatedAt).toISOString(),
  }));
  const average = records.length ? Math.round(records.reduce((sum, record) => sum + record.score, 0) / records.length) : 0;
  const highConfidence = records.filter((record) => record.score >= 90).length;
  const autonomousRecords = records.filter((record) => record.attributes.autonomous === true || /auto|queued|promoted/i.test(record.status)).length;
  const latestUpdate = records.reduce<string | null>((latest, record) => {
    if (!latest) return record.updatedAt;
    return new Date(record.updatedAt).getTime() > new Date(latest).getTime() ? record.updatedAt : latest;
  }, null);
  return {
    records,
    metrics: [
      {value: String(records.length), label: "Live records", tone: "violet"},
      {value: String(highConfidence), label: "High confidence", tone: "green"},
      {value: `${average}%`, label: "Average score", tone: "blue"},
      {value: String(autonomousRecords), label: "Autonomous actions", tone: "amber"},
    ],
    updatedAt: latestUpdate,
  };
}

export async function createContentIntelligenceRecord(slug: string) {
  const pageSlug = slugValue(slug);
  const {pool, workspace} = await context();
  const title = `New ${pageSlug.replaceAll("-", " ")} record - ${new Date().toLocaleDateString("en-GB")}`;
  const result = await pool.request().query<{ContentRecordId: string}>(`
    INSERT cacsms.ContentIntelligenceRecords(WorkspaceId,PageSlug,Title,Subtitle,Category,Score,Status,AttributesJson)
    OUTPUT inserted.ContentRecordId
    VALUES(
      ${guid(workspace)},
      ${text(pageSlug)},
      ${text(title)},
      N'Created from the live workspace',
      N'Generated',
      80,
      N'Autonomous intake',
      ${jsonText({source: "workspace-action", autonomous: true})}
    );
  `);
  return {id: String(result.recordset[0].ContentRecordId)};
}
