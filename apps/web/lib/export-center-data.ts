import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

export type ExportJob = {
  id: string;
  productionId: string;
  productionTitle: string;
  assetName: string;
  engine: string;
  preset: string | null;
  status: string;
  progress: number;
  attemptCount: number;
  updatedAt: string;
};

export async function getExportCenterData(): Promise<{
  jobs: ExportJob[];
  summary: { exporting: number; completed: number; failed: number };
}> {
  const pool = await getMssqlPool();
  const workspace = await pool.request().query<{ WorkspaceId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt`
  );
  const workspaceId = workspace.recordset[0]?.WorkspaceId;
  if (!workspaceId) return { jobs: [], summary: { exporting: 0, completed: 0, failed: 0 } };

  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(`
    SELECT CONVERT(nvarchar(36), r.RenderingJobId) id, CONVERT(nvarchar(36), p.ProductionId) productionId, p.Title productionTitle,
      r.AssetName assetName, r.Engine engine, r.Preset preset, r.Status status, r.Progress progress, r.AttemptCount attemptCount, CONVERT(nvarchar(40), r.UpdatedAt, 127) updatedAt
    FROM cacsms.RenderingJobs r JOIN cacsms.Productions p ON p.ProductionId=r.ProductionId
    WHERE p.WorkspaceId=@workspace ORDER BY r.UpdatedAt DESC
  `);

  const jobs = result.recordset.map((row) => ({
    id: String(row.id),
    productionId: String(row.productionId),
    productionTitle: String(row.productionTitle),
    assetName: String(row.assetName ?? "Export"),
    engine: String(row.engine),
    preset: row.preset ? String(row.preset) : null,
    status: String(row.status),
    progress: Number(row.progress),
    attemptCount: Number(row.attemptCount),
    updatedAt: String(row.updatedAt)
  }));

  return {
    jobs,
    summary: {
      exporting: jobs.filter((j) => j.status === "running" || j.status === "queued").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length
    }
  };
}
