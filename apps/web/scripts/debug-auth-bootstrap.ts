import { getMssqlPool } from "@/lib/database/mssql";

async function main() {
  const pool = await getMssqlPool();

  const users = await pool.request().query<{
    UserId: string;
    WorkspaceId: string;
    Email: string;
    DisplayName: string;
    Role: string;
    IsActive: boolean;
  }>(
    "SELECT TOP(10) CONVERT(nvarchar(36), UserId) UserId, CONVERT(nvarchar(36), WorkspaceId) WorkspaceId, Email, DisplayName, Role, IsActive FROM cacsms.Users ORDER BY CASE Role WHEN N'administrator' THEN 0 WHEN N'manager' THEN 1 ELSE 2 END, CreatedAt"
  );

  const workspaces = await pool.request().query<{
    WorkspaceId: string;
    Name: string;
    Status: string;
  }>(
    "SELECT TOP(10) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId, Name, Status FROM cacsms.Workspaces ORDER BY CreatedAt"
  );

  const sessions = await pool.request().query<{
    SessionId: string;
    UserId: string;
    WorkspaceId: string;
    Role: string;
    ExpiresAt: Date;
  }>(
    "SELECT TOP(10) CONVERT(nvarchar(36), SessionId) SessionId, CONVERT(nvarchar(36), UserId) UserId, CONVERT(nvarchar(36), WorkspaceId) WorkspaceId, Role, ExpiresAt FROM cacsms.UserSessions ORDER BY CreatedAt DESC"
  );

  console.log(
    JSON.stringify(
      {
        users: users.recordset,
        workspaces: workspaces.recordset,
        sessions: sessions.recordset
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown auth bootstrap diagnostic error";
  console.error(message);
  process.exit(1);
});
