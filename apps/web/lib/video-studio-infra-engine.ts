import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";
import { getSceneVideoWorkspaceData, type SceneVideoPayload, type SceneVideoProduction } from "@/lib/scene-video-engine";

export type VideoInfraMode = "motion-consistency" | "video-repair-and-enhancement";

type MotionConsistencyManifest = {
  generatedAt: string;
  continuity: {
    previous: string;
    following: string;
    environment: string;
    lighting: string;
    palette: string;
    direction: string;
  };
  motion: {
    start: string;
    end: string;
    focal: string;
    curve: string;
    parallax: string;
    speed: string;
    stabilization: string;
    transition: string;
  };
  temporalScore: number;
  motionScore: number;
  routingApproved: boolean;
};

type VideoRepairManifest = {
  generatedAt: string;
  previewLabel: string;
  assetStatus: string;
  clipUrl: string | null;
  issueTitles: string[];
  failedTakes: string[];
  nextRepairAction: string | null;
};

export type VideoInfraProduction = {
  id: string;
  code: string;
  title: string;
  state: string;
  priority: string;
  updatedAt: string;
  qualityScore: number;
  motionConsistency: MotionConsistencyManifest;
  repair: VideoRepairManifest;
};

export type VideoInfraPayload = {
  generatedAt: string;
  productions: VideoInfraProduction[];
  summary: {
    total: number;
    active: number;
    ready: number;
    blocked: number;
    averageQuality: number;
  };
};

function parseJson(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function metadataByProduction(pool: sql.ConnectionPool, productionIds: string[]) {
  if (!productionIds.length) return new Map<string, string | null>();
  const request = pool.request();
  const placeholders: string[] = [];
  productionIds.forEach((id, index) => {
    const name = `id${index}`;
    request.input(name, sql.NVarChar(36), id);
    placeholders.push(`@${name}`);
  });
  const result = await request.query<{ ProductionId: string; MetadataJson: string | null }>(`
    SELECT CONVERT(nvarchar(36), ProductionId) AS ProductionId, MetadataJson
    FROM cacsms.Productions
    WHERE CONVERT(nvarchar(36), ProductionId) IN (${placeholders.join(", ")});
  `);
  return new Map(result.recordset.map((row) => [row.ProductionId, row.MetadataJson]));
}

function motionManifest(production: SceneVideoProduction): MotionConsistencyManifest {
  return {
    generatedAt: production.updatedAt,
    continuity: production.continuity,
    motion: production.motion,
    temporalScore: production.quality.temporal,
    motionScore: production.quality.motion,
    routingApproved: production.routing.approved
  };
}

function repairManifest(production: SceneVideoProduction): VideoRepairManifest {
  return {
    generatedAt: production.updatedAt,
    previewLabel: production.preview.label,
    assetStatus: production.preview.assetStatus,
    clipUrl: production.preview.clipUrl ?? null,
    issueTitles: production.issues.map((item) => item.title),
    failedTakes: production.takes.filter((take) => /fail|reject/i.test(take.status)).map((take) => take.label),
    nextRepairAction: production.recovery
  };
}

async function persistManifests(pool: sql.ConnectionPool, productionId: string, production: VideoInfraProduction, currentMetadata: string | null) {
  const metadata = parseJson(currentMetadata);
  const merged = {
    ...metadata,
    videoStudioInfra: {
      motionConsistency: production.motionConsistency,
      videoRepairAndEnhancement: production.repair
    }
  };
  await pool
    .request()
    .input("production", sql.NVarChar(36), productionId)
    .input("metadata", sql.NVarChar(sql.MAX), JSON.stringify(merged))
    .query("UPDATE cacsms.Productions SET MetadataJson=@metadata WHERE CONVERT(nvarchar(36), ProductionId)=@production;");
}

export async function getVideoStudioInfrastructureData(): Promise<VideoInfraPayload> {
  const [scenePayload, pool] = await Promise.all([getSceneVideoWorkspaceData(), getMssqlPool()]);
  const metadataMap = await metadataByProduction(pool, scenePayload.productions.map((item) => item.id));
  const productions: VideoInfraProduction[] = [];
  for (const production of scenePayload.productions) {
    const item: VideoInfraProduction = {
      id: production.id,
      code: production.code,
      title: production.title,
      state: production.state,
      priority: production.priority,
      updatedAt: production.updatedAt,
      qualityScore: Math.round(
        (production.quality.storyboard +
          production.quality.temporal +
          production.quality.motion +
          production.quality.subject +
          production.quality.frameQuality +
          production.quality.audio +
          production.quality.brand +
          production.quality.safety) / 8
      ),
      motionConsistency: motionManifest(production),
      repair: repairManifest(production)
    };
    await persistManifests(pool, production.id, item, metadataMap.get(production.id) ?? null);
    productions.push(item);
  }
  return {
    generatedAt: scenePayload.generatedAt,
    productions,
    summary: scenePayload.summary
  };
}

