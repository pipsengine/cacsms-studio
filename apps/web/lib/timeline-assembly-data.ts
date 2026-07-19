import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

export type TimelineProduction = {
  id: string;
  code: string;
  title: string;
  stage: string;
  status: string;
  progress: number;
  renderingJobs: Array<{
    id: string;
    assetName: string;
    engine: string;
    status: string;
    progress: number;
    updatedAt: string;
  }>;
  agentRuns: Array<{ role: string; name: string; status: string }>;
  updatedAt: string;
};

export async function getTimelineAssemblyData(): Promise<{
  productions: TimelineProduction[];
  summary: { inAssembly: number; rendering: number; ready: number };
}> {
  const pool = await getMssqlPool();
  const workspace = await pool.request().query<{ WorkspaceId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt`
  );
  const workspaceId = workspace.recordset[0]?.WorkspaceId;
  if (!workspaceId) return { productions: [], summary: { inAssembly: 0, rendering: 0, ready: 0 } };

  const productions = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(`
    SELECT CONVERT(nvarchar(36), p.ProductionId) id, p.Code code, p.Title title, p.Stage stage, p.Status status, p.Progress progress, CONVERT(nvarchar(40), p.UpdatedAt, 127) updatedAt
    FROM cacsms.Productions p
    WHERE p.WorkspaceId=@workspace AND p.Stage IN(N'assembly',N'scripting',N'storyboard',N'visual-generation',N'audio-generation')
    ORDER BY CASE WHEN p.Stage=N'assembly' THEN 0 ELSE 1 END, p.UpdatedAt DESC
  `);

  const items: TimelineProduction[] = [];
  for (const row of productions.recordset) {
    const productionId = String(row.id);
    const jobs = await pool.request().input("production", sql.UniqueIdentifier, productionId).query(`
      SELECT CONVERT(nvarchar(36), RenderingJobId) id, AssetName assetName, Engine engine, Status status, Progress progress, CONVERT(nvarchar(40), UpdatedAt, 127) updatedAt
      FROM cacsms.RenderingJobs WHERE ProductionId=@production ORDER BY UpdatedAt DESC
    `);
    const agents = await pool.request().input("production", sql.UniqueIdentifier, productionId).query(`
      SELECT AgentRole role, AgentName name, Status status FROM cacsms.AgentRuns WHERE ProductionId=@production
    `);
    items.push({
      id: productionId,
      code: String(row.code),
      title: String(row.title),
      stage: String(row.stage),
      status: String(row.status),
      progress: Number(row.progress),
      renderingJobs: jobs.recordset.map((job) => ({
        id: String(job.id),
        assetName: String(job.assetName ?? "Master render"),
        engine: String(job.engine),
        status: String(job.status),
        progress: Number(job.progress),
        updatedAt: String(job.updatedAt)
      })),
      agentRuns: agents.recordset.map((agent) => ({
        role: String(agent.role),
        name: String(agent.name),
        status: String(agent.status)
      })),
      updatedAt: String(row.updatedAt)
    });
  }

  const summary = {
    inAssembly: items.filter((item) => item.stage === "assembly").length,
    rendering: items.reduce((sum, item) => sum + item.renderingJobs.filter((j) => j.status === "running").length, 0),
    ready: items.filter((item) => item.stage === "assembly" && item.progress >= 80).length
  };

  return { productions: items, summary };
}
