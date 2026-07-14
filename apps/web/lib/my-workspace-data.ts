// @ts-nocheck -- mssql multi-recordset typing is narrower than its runtime shape.
import { getDatabaseHealth, getMssqlPool } from "@/lib/database/mssql";
import type { CalendarDay, MyWorkspaceResponse, Priority } from "@/types/my-workspace";

export async function getMyWorkspaceData(): Promise<MyWorkspaceResponse> {
  const now = new Date();
  const health = await getDatabaseHealth();
  if (health.status !== "connected") {
    return fallbackMyWorkspaceData(now, health.message);
  }

  const pool = await getMssqlPool();
  const result = await pool.request().query<any>(`
    DECLARE @w uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    SELECT TOP(1) UserId,DisplayName,Role FROM cacsms.Users WHERE WorkspaceId=@w AND IsActive=1 ORDER BY CreatedAt;
    SELECT TOP(12) ProductionId,Title,ProductionType,Stage,Progress,DueAt,Priority,Status FROM cacsms.Productions WHERE WorkspaceId=@w ORDER BY UpdatedAt DESC;
    SELECT TOP(12) NotificationId,Title,Body,IsRead,Severity,CreatedAt FROM cacsms.Notifications WHERE WorkspaceId=@w ORDER BY CreatedAt DESC;
    SELECT CalendarEventId,Title,EventType,StartsAt,Status FROM cacsms.CalendarEvents WHERE WorkspaceId=@w AND StartsAt>=DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1) AND StartsAt<DATEADD(MONTH,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1));
    SELECT TOP(12) AuditEventId,EventType,EntityType,CreatedAt FROM cacsms.AuditEvents WHERE WorkspaceId=@w ORDER BY CreatedAt DESC;
  `);

  const user = result.recordsets[0][0] || { DisplayName: "Administrator", Role: "administrator" };
  const prods = result.recordsets[1] as any[];
  const notifications = result.recordsets[2] as any[];
  const events = result.recordsets[3] as any[];
  const audits = result.recordsets[4] as any[];
  const active = prods.filter((x) => !["completed", "published", "archived", "failed"].includes(x.Status));
  const reviews = prods.filter((x) => x.Status === "in-review");
  const drafts = prods.filter((x) => x.Status === "draft");
  const deadlines = prods.filter((x) => x.DueAt);
  const metric = metricFactory("Live");

  return {
    generatedAt: now.toISOString(),
    user: {
      displayName: user.DisplayName,
      initials: initials(user.DisplayName),
      role: user.Role
    },
    metrics: [
      metric("my-tasks", "My Tasks", active.length, "purple", "tasks"),
      metric("active-productions", "Active Productions", active.length, "blue", "production"),
      metric("pending-approvals", "Pending Approvals", reviews.length, "green", "approval"),
      metric("reviews", "Reviews", reviews.length, "orange", "review"),
      metric("drafts", "Drafts", drafts.length, "cyan", "drafts"),
      metric("deadlines", "Deadlines", deadlines.length, "red", "deadline")
    ],
    tasks: reviews.map((x) => ({
      id: String(x.ProductionId),
      title: x.Title,
      module: "Production Studio",
      type: x.ProductionType,
      priority: normalizePriority(x.Priority),
      dueDate: x.DueAt ? new Date(x.DueAt).toISOString() : now.toISOString(),
      status: "review" as const
    })),
    productions: active.map((x) => ({
      id: String(x.ProductionId),
      title: x.Title,
      subtitle: x.ProductionType,
      stage: x.Stage,
      progress: Number(x.Progress),
      deadline: x.DueAt ? new Date(x.DueAt).toISOString() : "-",
      priority: normalizePriority(x.Priority)
    })),
    calendar: {
      monthLabel: new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(now),
      days: buildCalendar(now, events),
      summary: { deadlines: deadlines.length, reviews: reviews.length, events: events.length }
    },
    contentPerformance: { summary: [], points: [] },
    activity: audits.map((x) => ({
      id: String(x.AuditEventId),
      title: x.EventType,
      module: x.EntityType || "System",
      timeAgo: new Date(x.CreatedAt).toLocaleString(),
      icon: "document" as const,
      tone: "blue" as const
    })),
    notifications: notifications.map((x) => ({
      id: String(x.NotificationId),
      title: x.Title,
      subtitle: x.Body || "",
      timeAgo: new Date(x.CreatedAt).toLocaleString(),
      unread: !x.IsRead,
      tone: x.Severity === "critical" ? "red" as const : x.Severity === "warning" ? "orange" as const : "blue" as const
    })),
    deadlines: deadlines.map((x) => ({
      id: String(x.ProductionId),
      date: new Date(x.DueAt).toLocaleDateString(),
      title: x.Title,
      module: "Production Studio",
      remaining: `${Math.ceil((new Date(x.DueAt).getTime() - Date.now()) / 86400000)} days`,
      priority: normalizePriority(x.Priority)
    })),
    fileAccess: [],
    storage: { usedGb: 0, totalGb: 100, slices: [] }
  };
}

function fallbackMyWorkspaceData(now: Date, message: string): MyWorkspaceResponse {
  const metric = metricFactory("Offline");
  return {
    generatedAt: now.toISOString(),
    user: { displayName: "Administrator", initials: "AD", role: "administrator" },
    metrics: [
      metric("my-tasks", "My Tasks", 0, "purple", "tasks"),
      metric("active-productions", "Active Productions", 0, "blue", "production"),
      metric("pending-approvals", "Pending Approvals", 0, "green", "approval"),
      metric("reviews", "Reviews", 0, "orange", "review"),
      metric("drafts", "Drafts", 0, "cyan", "drafts"),
      metric("deadlines", "Deadlines", 0, "red", "deadline")
    ],
    tasks: [],
    productions: [],
    calendar: {
      monthLabel: new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(now),
      days: buildCalendar(now, []),
      summary: { deadlines: 0, reviews: 0, events: 0 }
    },
    contentPerformance: { summary: [{ label: "Database", value: "Offline", delta: message }], points: [] },
    activity: [{
      id: "offline-mode",
      title: "Workspace loaded in offline mode",
      module: message,
      timeAgo: now.toLocaleString(),
      icon: "document",
      tone: "orange"
    }],
    notifications: [{
      id: "database-offline",
      title: "Database unavailable",
      subtitle: message,
      timeAgo: now.toLocaleString(),
      unread: true,
      tone: "orange"
    }],
    deadlines: [],
    fileAccess: [],
    storage: { usedGb: 0, totalGb: 100, slices: [] }
  };
}

function metricFactory(trendLabel: string) {
  return (
    key: string,
    label: string,
    value: number,
    tone: "purple" | "blue" | "green" | "orange" | "red" | "cyan",
    icon: "tasks" | "production" | "approval" | "review" | "drafts" | "deadline"
  ) => ({ key, label, value: String(value), trendLabel, trendDirection: "flat" as const, tone, icon, sparkline: [] });
}

function initials(value: string) {
  return String(value).split(/\s+/).map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();
}

function normalizePriority(value: string): Priority {
  return (["low", "medium", "high", "critical"].includes(value) ? value : "medium") as Priority;
}

function buildCalendar(now: Date, events: any[]): CalendarDay[] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const matches = events.filter((x) => new Date(x.StartsAt).toDateString() === d.toDateString());
    return {
      day: d.getDate(),
      isCurrentMonth: d.getMonth() === now.getMonth(),
      isToday: d.toDateString() === now.toDateString(),
      eventKinds: matches.map((x) => x.EventType.toLowerCase().includes("review") ? "review" : x.EventType.toLowerCase().includes("deadline") ? "deadline" : "event")
    };
  });
}
