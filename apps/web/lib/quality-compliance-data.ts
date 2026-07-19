import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

export type QualityProduction = {
  id: string;
  title: string;
  stage: string;
  status: string;
  progress: number;
  readiness: number;
  risk: number;
  confidence: number;
  blockers: string[];
  renderingStatus: string | null;
  decisions: Array<{ action: string; readiness: number; createdAt: string }>;
  updatedAt: string;
};

export async function getQualityComplianceData(): Promise<{
  productions: QualityProduction[];
  summary: { inReview: number; passed: number; blocked: number };
}> {
  const pool = await getMssqlPool();
  const workspace = await pool.request().query<{ WorkspaceId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt`
  );
  const workspaceId = workspace.recordset[0]?.WorkspaceId;
  if (!workspaceId) return { productions: [], summary: { inReview: 0, passed: 0, blocked: 0 } };

  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(`
    SELECT CONVERT(nvarchar(36), p.ProductionId) id, p.Title title, p.Stage stage, p.Status status, p.Progress progress, p.MetadataJson metadataJson, CONVERT(nvarchar(40), p.UpdatedAt, 127) updatedAt
    FROM cacsms.Productions p
    WHERE p.WorkspaceId=@workspace AND p.Stage IN(N'quality-assurance',N'assembly',N'publishing') AND p.Status NOT IN(N'archived',N'failed')
    ORDER BY p.UpdatedAt DESC
  `);

  const productions: QualityProduction[] = [];
  for (const row of result.recordset) {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = row.metadataJson ? JSON.parse(String(row.metadataJson)) : {};
    } catch {
      metadata = {};
    }
    const blockers = Array.isArray(metadata.blockers) ? metadata.blockers.map(String) : [];
    const productionId = String(row.id);
    const render = await pool.request().input("production", sql.UniqueIdentifier, productionId).query(
      `SELECT TOP(1) Status status FROM cacsms.RenderingJobs WHERE ProductionId=@production ORDER BY UpdatedAt DESC`
    );
    const decisions = await pool.request().input("production", sql.UniqueIdentifier, productionId).query(`
      SELECT TOP(5) Action action, CONVERT(float, ReadinessScore) readiness, CONVERT(nvarchar(40), CreatedAt, 127) createdAt
      FROM cacsms.ProductionOrchestrationDecisions WHERE ProductionId=@production ORDER BY CreatedAt DESC
    `);
    productions.push({
      id: productionId,
      title: String(row.title),
      stage: String(row.stage),
      status: String(row.status),
      progress: Number(row.progress),
      readiness: Number(metadata.readiness ?? 0),
      risk: Number(metadata.risk ?? 0),
      confidence: Number(metadata.decisionConfidence ?? 0),
      blockers,
      renderingStatus: render.recordset[0] ? String(render.recordset[0].status) : null,
      decisions: decisions.recordset.map((d) => ({
        action: String(d.action),
        readiness: Number(d.readiness),
        createdAt: String(d.createdAt)
      })),
      updatedAt: String(row.updatedAt)
    });
  }

  return {
    productions,
    summary: {
      inReview: productions.filter((p) => p.stage === "quality-assurance").length,
      passed: productions.filter((p) => p.readiness >= 78 && p.risk <= 32).length,
      blocked: productions.filter((p) => p.blockers.length > 0).length
    }
  };
}
