import { createHash, randomBytes } from "node:crypto";
import sql from "mssql";
import { getMssqlPool } from "@/lib/database/mssql";

export type StudioRole = "administrator" | "manager" | "editor" | "reviewer" | "member" | "viewer";

export type StudioSession = {
  sessionId: string;
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: StudioRole;
  expiresAt: string;
};

const SESSION_COOKIE = "cacsms_session";
const SESSION_TTL_HOURS = 12;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export async function getOrCreateBootstrapUserId(): Promise<string | null> {
  const pool = await getMssqlPool();
  const existing = await pool.request().query<{ UserId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), UserId) UserId
     FROM cacsms.Users
     WHERE IsActive=1
     ORDER BY CASE Role WHEN N'administrator' THEN 0 WHEN N'manager' THEN 1 ELSE 2 END, CreatedAt`
  );
  const existingUserId = existing.recordset[0]?.UserId;
  if (existingUserId) return existingUserId;

  const workspace = await pool.request().query<{ WorkspaceId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), WorkspaceId) WorkspaceId
     FROM cacsms.Workspaces
     WHERE Status=N'active'
     ORDER BY CreatedAt`
  );
  const workspaceId = workspace.recordset[0]?.WorkspaceId;
  if (!workspaceId) return null;

  const seeded = await pool
    .request()
    .input("workspaceId", sql.UniqueIdentifier, workspaceId)
    .input("email", sql.NVarChar(320), "administrator@cacsms.local")
    .input("displayName", sql.NVarChar(200), "CACSMS Administrator")
    .query<{ UserId: string }>(`
      IF EXISTS (
        SELECT 1
        FROM cacsms.Users
        WHERE WorkspaceId=@workspaceId AND Email=@email
      )
        SELECT TOP(1) CONVERT(nvarchar(36), UserId) UserId
        FROM cacsms.Users
        WHERE WorkspaceId=@workspaceId AND Email=@email;
      ELSE
        INSERT cacsms.Users (WorkspaceId, Email, DisplayName, Role, IsActive)
        OUTPUT CONVERT(nvarchar(36), inserted.UserId) UserId
        VALUES (@workspaceId, @email, @displayName, N'administrator', 1);
    `);

  return seeded.recordset[0]?.UserId ?? null;
}

export async function createSession(userId: string): Promise<{ token: string; session: StudioSession }> {
  const pool = await getMssqlPool();
  const user = await pool.request().input("userId", sql.UniqueIdentifier, userId).query<{
    UserId: string;
    WorkspaceId: string;
    Email: string;
    DisplayName: string;
    Role: StudioRole;
  }>(`SELECT CONVERT(nvarchar(36), UserId) UserId, CONVERT(nvarchar(36), WorkspaceId) WorkspaceId, Email, DisplayName, Role FROM cacsms.Users WHERE UserId=@userId AND IsActive=1`);

  const row = user.recordset[0];
  if (!row) throw new Error("User not found or inactive.");

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  const inserted = await pool
    .request()
    .input("userId", sql.UniqueIdentifier, row.UserId)
    .input("workspaceId", sql.UniqueIdentifier, row.WorkspaceId)
    .input("tokenHash", sql.NVarChar(128), tokenHash)
    .input("role", sql.NVarChar(50), row.Role)
    .input("expiresAt", sql.DateTimeOffset, expiresAt)
    .query<{ SessionId: string }>(
      `INSERT cacsms.UserSessions(UserId,WorkspaceId,TokenHash,Role,ExpiresAt) OUTPUT CONVERT(nvarchar(36), inserted.SessionId) SessionId VALUES(@userId,@workspaceId,@tokenHash,@role,@expiresAt)`
    );

  return {
    token,
    session: {
      sessionId: inserted.recordset[0].SessionId,
      userId: row.UserId,
      workspaceId: row.WorkspaceId,
      email: row.Email,
      displayName: row.DisplayName,
      role: row.Role,
      expiresAt: expiresAt.toISOString()
    }
  };
}

export async function resolveSession(token: string | null | undefined): Promise<StudioSession | null> {
  if (!token?.trim()) return null;
  const pool = await getMssqlPool();
  const tokenHash = hashToken(token.trim());
  const result = await pool.request().input("tokenHash", sql.NVarChar(128), tokenHash).query<{
    SessionId: string;
    UserId: string;
    WorkspaceId: string;
    Email: string;
    DisplayName: string;
    Role: StudioRole;
    ExpiresAt: Date;
  }>(`
    SELECT CONVERT(nvarchar(36), s.SessionId) SessionId, CONVERT(nvarchar(36), s.UserId) UserId,
      CONVERT(nvarchar(36), s.WorkspaceId) WorkspaceId, u.Email, u.DisplayName, s.Role, s.ExpiresAt
    FROM cacsms.UserSessions s JOIN cacsms.Users u ON u.UserId=s.UserId
    WHERE s.TokenHash=@tokenHash AND s.ExpiresAt>SYSUTCDATETIME()
  `);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    sessionId: row.SessionId,
    userId: row.UserId,
    workspaceId: row.WorkspaceId,
    email: row.Email,
    displayName: row.DisplayName,
    role: row.Role,
    expiresAt: row.ExpiresAt.toISOString()
  };
}

export async function getDefaultSessionUser(): Promise<StudioSession | null> {
  const userId = await getOrCreateBootstrapUserId();
  if (!userId) return null;
  const { session } = await createSession(userId);
  return session;
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function getRequestSession(request: Request): Promise<StudioSession | null> {
  return resolveSession(readSessionToken(request));
}
