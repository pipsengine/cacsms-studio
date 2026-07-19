import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

export type PublishingJobItem = {
  id: string;
  productionId: string;
  productionTitle: string;
  channel: string;
  accountName: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export async function getPublishingCenterData(): Promise<{
  jobs: PublishingJobItem[];
  summary: { publishing: number; published: number; scheduled: number };
}> {
  const pool = await getMssqlPool();
  const workspace = await pool.request().query<{ WorkspaceId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt`
  );
  const workspaceId = workspace.recordset[0]?.WorkspaceId;
  if (!workspaceId) return { jobs: [], summary: { publishing: 0, published: 0, scheduled: 0 } };

  const result = await pool.request().input("workspace", sql.UniqueIdentifier, workspaceId).query(`
    SELECT CONVERT(nvarchar(36), j.PublishingJobId) id, CONVERT(nvarchar(36), p.ProductionId) productionId, p.Title productionTitle,
      j.Channel channel, j.AccountName accountName, j.Status status, CONVERT(nvarchar(40), j.ScheduledAt, 127) scheduledAt,
      CONVERT(nvarchar(40), j.PublishedAt, 127) publishedAt, CONVERT(nvarchar(40), j.UpdatedAt, 127) updatedAt
    FROM cacsms.PublishingJobs j JOIN cacsms.Productions p ON p.ProductionId=j.ProductionId
    WHERE p.WorkspaceId=@workspace ORDER BY j.UpdatedAt DESC
  `);

  const jobs = result.recordset.map((row) => ({
    id: String(row.id),
    productionId: String(row.productionId),
    productionTitle: String(row.productionTitle),
    channel: String(row.channel),
    accountName: String(row.accountName),
    status: String(row.status),
    scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
    publishedAt: row.publishedAt ? String(row.publishedAt) : null,
    updatedAt: String(row.updatedAt)
  }));

  return {
    jobs,
    summary: {
      publishing: jobs.filter((j) => j.status === "publishing").length,
      published: jobs.filter((j) => j.status === "published").length,
      scheduled: jobs.filter((j) => j.status === "scheduled" || j.status === "queued").length
    }
  };
}
