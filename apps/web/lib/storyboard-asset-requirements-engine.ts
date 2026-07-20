import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import { getStoryboardWorkspaceData, type StoryboardProduction, type StoryboardScene, type StoryboardShot } from "@/lib/storyboard-engine";

type SceneRequirementCategory =
  | "establishing"
  | "character"
  | "object"
  | "background"
  | "diagram"
  | "map"
  | "graphic"
  | "other";

export type AssetRequirementCategory = {
  category: SceneRequirementCategory;
  required: number;
  satisfied: number;
};

export type AssetRequirementScene = {
  sceneId: string;
  number: number;
  title: string;
  shotCount: number;
  required: number;
  satisfied: number;
  categories: AssetRequirementCategory[];
};

export type AssetRequirementManifest = {
  generatedAt: string;
  method: string;
  productionId: string;
  productionCode: string;
  versionLabel: string;
  scenes: AssetRequirementScene[];
  totals: {
    required: number;
    satisfied: number;
  };
};

export type AssetRequirementsProduction = {
  id: string;
  code: string;
  title: string;
  stage: string;
  status: string;
  updatedAt: string;
  routingLocked: boolean;
  manifest: AssetRequirementManifest | null;
};

export type AssetRequirementsPayload = {
  generatedAt: string;
  productions: AssetRequirementsProduction[];
  summary: {
    total: number;
    withManifest: number;
    requiredAssets: number;
    satisfiedAssets: number;
  };
};

function parseMetadata(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function categorizeShot(shot: StoryboardShot): SceneRequirementCategory {
  const text = `${shot.assetExpectation} ${shot.title} ${shot.summary} ${shot.visualFocus}`.toLowerCase();
  if (/establishing|wide establishing|opening wide/.test(text)) return "establishing";
  if (/background|environment|plate/.test(text)) return "background";
  if (/character|presenter|teacher|engineer|person/.test(text)) return "character";
  if (/prop|object|device|equipment|tool|instrument|close-up/.test(text)) return "object";
  if (/diagram|schematic|infographic|chart/.test(text)) return "diagram";
  if (/\bmap\b|geographic|satellite/.test(text)) return "map";
  if (/overlay|lower third|graphic|title card|caption/.test(text)) return "graphic";
  if (!text.trim()) return "other";
  return "other";
}

function combine(categories: Map<SceneRequirementCategory, { required: number; satisfied: number }>) {
  return (Array.from(categories.entries()) as Array<[SceneRequirementCategory, { required: number; satisfied: number }]>) //
    .map(([category, counts]) => ({ category, required: counts.required, satisfied: counts.satisfied }))
    .sort((a, b) => b.required - a.required);
}

function buildScene(scene: StoryboardScene) {
  const categories = new Map<SceneRequirementCategory, { required: number; satisfied: number }>();
  let required = 0;
  let satisfied = 0;
  for (const shot of scene.shots) {
    const category = categorizeShot(shot);
    const current = categories.get(category) ?? { required: 0, satisfied: 0 };
    current.required += 1;
    required += 1;
    if (shot.previewAssetId) {
      current.satisfied += 1;
      satisfied += 1;
    }
    categories.set(category, current);
  }
  return {
    sceneId: scene.id,
    number: scene.number,
    title: scene.title,
    shotCount: scene.shots.length,
    required,
    satisfied,
    categories: combine(categories)
  } satisfies AssetRequirementScene;
}

function manifestFromProduction(production: StoryboardProduction) {
  const scenes = production.scenes.map(buildScene);
  const totals = scenes.reduce(
    (acc, scene) => {
      acc.required += scene.required;
      acc.satisfied += scene.satisfied;
      return acc;
    },
    { required: 0, satisfied: 0 }
  );
  return {
    generatedAt: new Date().toISOString(),
    method: "storyboard-asset-requirements-v1",
    productionId: production.id,
    productionCode: production.code,
    versionLabel: production.versionLabel,
    scenes,
    totals
  } satisfies AssetRequirementManifest;
}

async function persistManifest(pool: sql.ConnectionPool, productionId: string, manifest: AssetRequirementManifest) {
  const result = await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .query<{ MetadataJson: string | null }>(
      "SELECT TOP(1) MetadataJson FROM cacsms.Productions WHERE CONVERT(nvarchar(36), ProductionId)=@production;"
    );
  const current = result.recordset[0]?.MetadataJson ?? null;
  const metadata = parseMetadata(current);
  const merged = {
    ...metadata,
    assetRequirementManifest: manifest
  };
  await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query("UPDATE cacsms.Productions SET MetadataJson=@metadata, UpdatedAt=SYSUTCDATETIME() WHERE CONVERT(nvarchar(36), ProductionId)=@production;");
}

function storedManifest(metadataJson: string | null) {
  const metadata = parseMetadata(metadataJson);
  const stored = asObject(metadata.assetRequirementManifest);
  const generatedAt = typeof stored.generatedAt === "string" ? stored.generatedAt : null;
  if (!generatedAt) return null;
  return stored as unknown as AssetRequirementManifest;
}

async function loadMetadata(pool: sql.ConnectionPool, productionId: string) {
  const result = await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .query<{ MetadataJson: string | null; UpdatedAt: Date }>(
      "SELECT TOP(1) MetadataJson, UpdatedAt FROM cacsms.Productions WHERE CONVERT(nvarchar(36), ProductionId)=@production;"
    );
  return result.recordset[0] ?? null;
}

export async function getAssetRequirementsWorkspaceData(): Promise<AssetRequirementsPayload> {
  const storyboard = await getStoryboardWorkspaceData();
  const pool = await getMssqlPool();
  const productions: AssetRequirementsProduction[] = [];
  for (const production of storyboard.productions) {
    const row = await loadMetadata(pool, production.id);
    const stored = row ? storedManifest(row.MetadataJson) : null;
    const manifest = manifestFromProduction(production);
    const storedSameVersion = stored?.versionLabel === manifest.versionLabel;
    if (!storedSameVersion) {
      await persistManifest(pool, production.id, manifest);
    }
    productions.push({
      id: production.id,
      code: production.code,
      title: production.title,
      stage: production.stage,
      status: production.state,
      updatedAt: production.updatedAt,
      routingLocked: !production.routing.approved,
      manifest
    });
  }
  const totals = productions.reduce(
    (acc, item) => {
      acc.withManifest += item.manifest ? 1 : 0;
      acc.requiredAssets += item.manifest?.totals.required ?? 0;
      acc.satisfiedAssets += item.manifest?.totals.satisfied ?? 0;
      return acc;
    },
    { withManifest: 0, requiredAssets: 0, satisfiedAssets: 0 }
  );
  return {
    generatedAt: new Date().toISOString(),
    productions,
    summary: {
      total: productions.length,
      withManifest: totals.withManifest,
      requiredAssets: totals.requiredAssets,
      satisfiedAssets: totals.satisfiedAssets
    }
  };
}

