// @ts-nocheck -- mssql multi-recordset typing is narrower than its runtime shape.
import sql from "mssql";
import { productionPipeline } from "@cacsms/contracts";
import { getDatabaseHealth, getMssqlPool } from "@/lib/database/mssql";
import type { ExecutiveDashboardData, MetricCard, StatusTone } from "@/types/executive-dashboard";

export interface ExecutiveDashboardQuery {
  workspaceId?: string;
  brandId?: string;
  periodDays?: number;
}

const metricLabels = [
  "Active Productions",
  "Productions Completed",
  "Productions at Risk",
  "Awaiting Approval",
  "Active AI Agents",
  "Running Automations",
  "Rendering Jobs",
  "Scheduled Publications",
  "Failed Jobs",
  "Compliance Exceptions",
  "Est. Production Cost",
  "Service Health Score"
];

const legacyStageAliases: Record<string, string> = {
  "content-intelligence": "discover",
  "script-structure": "produce",
  "scene-planning": "pre-plan",
  "visual-production": "produce",
  "video-animation": "produce",
  "voice-music-sound": "produce",
  "timeline-assembly": "assemble",
  "quality-assurance": "quality",
  "hybrid-export": "export",
  publishing: "publish"
};

const validPeriod = (value?: number) => [7, 30, 90].includes(Number(value)) ? Number(value) : 30;
const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
const displayStatus = (value: string) => value.replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator ? " " : ""}${letter.toUpperCase()}`);

export async function setExecutivePlatformState(action: "start" | "pause" | "stop", workspaceId?: string) {
  const pool = await getMssqlPool();
  const workspace = await resolveWorkspace(pool, workspaceId);
  await pool.request()
    .input("workspace", sql.UniqueIdentifier, workspace.id)
    .input("eventType", sql.NVarChar(150), `dashboard.platform.${action === "start" ? "started" : action === "pause" ? "paused" : "stopped"}`)
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify({ source: "executive-dashboard", action }))
    .query(`INSERT cacsms.AuditEvents(WorkspaceId, EventType, EntityType, PayloadJson) VALUES(@workspace, @eventType, N'platform-runtime', @payload);`);
  return { success: true, action };
}

async function resolveWorkspace(pool: Awaited<ReturnType<typeof getMssqlPool>>, requested?: string) {
  const result = await pool.request().query<{ WorkspaceId: string; Name: string }>(`SELECT WorkspaceId, Name FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt;`);
  if (!result.recordset.length) throw new Error("No active workspace is configured.");
  const selected = result.recordset.find((item) => item.WorkspaceId === requested) ?? result.recordset[0];
  return { id: selected.WorkspaceId, name: selected.Name, options: result.recordset.map((item) => ({ id: String(item.WorkspaceId), name: item.Name })) };
}

export async function getExecutiveDashboardData(query: ExecutiveDashboardQuery = {}): Promise<ExecutiveDashboardData> {
  const generatedAt = new Date().toISOString();
  const pool = await getMssqlPool();
  const health = await getDatabaseHealth();
  const workspace = await resolveWorkspace(pool, query.workspaceId);
  const periodDays = validPeriod(query.periodDays);

  const brandResult = await pool.request().input("workspace", sql.UniqueIdentifier, workspace.id)
    .query<{ BrandId: string; Name: string }>(`SELECT BrandId, Name FROM cacsms.Brands WHERE WorkspaceId=@workspace AND IsActive=1 ORDER BY Name;`);
  const brandOptions = brandResult.recordset.map((item) => ({ id: String(item.BrandId), name: item.Name }));
  const brandId = brandOptions.some((item) => item.id === query.brandId) ? query.brandId! : null;

  const result = await pool.request()
    .input("workspace", sql.UniqueIdentifier, workspace.id)
    .input("brand", sql.UniqueIdentifier, brandId)
    .input("from", sql.DateTimeOffset, new Date(Date.now() - periodDays * 86_400_000))
    .query<any>(`
      SELECT
        (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND Status IN(N'draft',N'queued',N'active',N'blocked',N'in-review',N'approved')) active,
        (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND Status IN(N'completed',N'published') AND COALESCE(CompletedAt,PublishedAt,UpdatedAt)>=@from) completed,
        (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND (Status=N'blocked' OR Priority=N'critical')) risk,
        (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND Status=N'in-review') review,
        (SELECT COUNT(*) FROM cacsms.AgentRuns a JOIN cacsms.Productions p ON p.ProductionId=a.ProductionId WHERE p.WorkspaceId=@workspace AND (@brand IS NULL OR p.BrandId=@brand) AND a.Status=N'running') agents,
        (SELECT COUNT(*) FROM cacsms.RenderingJobs j JOIN cacsms.Productions p ON p.ProductionId=j.ProductionId WHERE p.WorkspaceId=@workspace AND (@brand IS NULL OR p.BrandId=@brand) AND j.Status=N'running') renders,
        (SELECT COUNT(*) FROM cacsms.PublishingJobs j JOIN cacsms.Productions p ON p.ProductionId=j.ProductionId WHERE p.WorkspaceId=@workspace AND (@brand IS NULL OR p.BrandId=@brand) AND j.Status IN(N'scheduled',N'ready',N'publishing')) publishing,
        (SELECT COUNT(*) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND Status=N'failed' AND UpdatedAt>=@from) failed,
        (SELECT COUNT(*) FROM cacsms.Notifications WHERE WorkspaceId=@workspace AND Category IN(N'compliance',N'quality') AND Severity IN(N'warning',N'critical') AND CreatedAt>=@from) compliance,
        (SELECT ISNULL(SUM(a.CostAmount),0) FROM cacsms.AgentRuns a JOIN cacsms.Productions p ON p.ProductionId=a.ProductionId WHERE p.WorkspaceId=@workspace AND (@brand IS NULL OR p.BrandId=@brand) AND a.CreatedAt>=@from) cost,
        (SELECT ISNULL(AVG(CAST(Progress AS decimal(10,2))),0) FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND Status IN(N'draft',N'queued',N'active',N'blocked',N'in-review',N'approved')) averageProgress;

      SELECT Stage, COUNT(*) count, SUM(CASE WHEN Status=N'blocked' OR Priority=N'critical' THEN 1 ELSE 0 END) atRisk
      FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand)
        AND Status NOT IN(N'archived') GROUP BY Stage;

      SELECT Status, COUNT(*) count FROM cacsms.Productions
      WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) GROUP BY Status;

      SELECT DayValue, SUM(CreatedCount) created, SUM(CompletedCount) completed, SUM(PublishedCount) published, SUM(FailedCount) failed
      FROM (
        SELECT CONVERT(date,CreatedAt) DayValue, 1 CreatedCount, 0 CompletedCount, 0 PublishedCount, 0 FailedCount FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND CreatedAt>=@from
        UNION ALL SELECT CONVERT(date,CompletedAt),0,1,0,0 FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND CompletedAt>=@from
        UNION ALL SELECT CONVERT(date,PublishedAt),0,0,1,0 FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND PublishedAt>=@from
        UNION ALL SELECT CONVERT(date,UpdatedAt),0,0,0,1 FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND Status=N'failed' AND UpdatedAt>=@from
      ) activity GROUP BY DayValue ORDER BY DayValue;

      SELECT TOP(8) a.AgentName, a.AgentRole, a.Status, a.TaskName, a.SuccessRate
      FROM cacsms.AgentRuns a JOIN cacsms.Productions p ON p.ProductionId=a.ProductionId
      WHERE p.WorkspaceId=@workspace AND (@brand IS NULL OR p.BrandId=@brand) ORDER BY a.UpdatedAt DESC;

      SELECT j.Channel,
        MAX(j.Status) status,
        SUM(CASE WHEN j.Status=N'scheduled' THEN 1 ELSE 0 END) scheduled,
        SUM(CASE WHEN j.Status=N'ready' THEN 1 ELSE 0 END) ready,
        SUM(CASE WHEN j.Status=N'failed' THEN 1 ELSE 0 END) failed,
        MAX(j.PublishedAt) lastPublished,
        MIN(CASE WHEN j.ScheduledAt>=SYSUTCDATETIME() THEN j.ScheduledAt END) nextPublish
      FROM cacsms.PublishingJobs j JOIN cacsms.Productions p ON p.ProductionId=j.ProductionId
      WHERE p.WorkspaceId=@workspace AND (@brand IS NULL OR p.BrandId=@brand) GROUP BY j.Channel;

      SELECT
        SUM(CASE WHEN DueAt<SYSUTCDATETIME() AND Status NOT IN(N'completed',N'published',N'archived') THEN 1 ELSE 0 END) overdue,
        SUM(CASE WHEN CONVERT(date,DueAt)=CONVERT(date,SYSUTCDATETIME()) THEN 1 ELSE 0 END) dueToday,
        SUM(CASE WHEN DueAt>SYSUTCDATETIME() AND DueAt<DATEADD(day,7,SYSUTCDATETIME()) THEN 1 ELSE 0 END) dueThisWeek,
        SUM(CASE WHEN DueAt>=DATEADD(day,7,SYSUTCDATETIME()) AND DueAt<DATEADD(day,14,SYSUTCDATETIME()) THEN 1 ELSE 0 END) dueNextWeek
      FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand);

      SELECT TOP(10) EventType, EntityType, CreatedAt FROM cacsms.AuditEvents WHERE WorkspaceId=@workspace ORDER BY CreatedAt DESC, AuditEventId DESC;
      SELECT TOP(1) EventType FROM cacsms.AuditEvents WHERE WorkspaceId=@workspace AND EventType LIKE N'dashboard.platform.%' ORDER BY CreatedAt DESC, AuditEventId DESC;

      SELECT TOP(20) N'Production' category, Title description, Code affected, UpdatedAt detected, Status status, CASE WHEN Priority=N'critical' THEN N'Critical' ELSE N'High' END severity
      FROM cacsms.Productions WHERE WorkspaceId=@workspace AND (@brand IS NULL OR BrandId=@brand) AND (Status IN(N'blocked',N'failed') OR Priority=N'critical') ORDER BY UpdatedAt DESC;
    `);

  const counts = result.recordsets[0][0];
  const rawStages = result.recordsets[1] as Array<{ Stage: string; count: number; atRisk: number }>;
  const stageTotals = new Map<string, { count: number; atRisk: number }>();
  for (const row of rawStages) {
    const key = legacyStageAliases[row.Stage] ?? row.Stage;
    const current = stageTotals.get(key) ?? { count: 0, atRisk: 0 };
    stageTotals.set(key, { count: current.count + Number(row.count), atRisk: current.atRisk + Number(row.atRisk) });
  }
  const pipeline = productionPipeline.map((stage) => ({ key: stage.id, label: stage.label, ...(stageTotals.get(stage.id) ?? { count: 0, atRisk: 0 }) }));
  const activeStage = [...pipeline].sort((a, b) => b.count - a.count)[0];

  const latestCommand = String(result.recordsets[8][0]?.EventType ?? "");
  const workload = Number(counts.active) + Number(counts.agents) + Number(counts.renders) + Number(counts.publishing);
  let platformStatus: ExecutiveDashboardData["platform"]["status"] = health.status !== "connected" ? "Degraded" : workload ? "Running" : "Idle";
  if (latestCommand.endsWith(".paused")) platformStatus = "Paused";
  if (latestCommand.endsWith(".stopped")) platformStatus = "Stopped";
  if (latestCommand.endsWith(".started")) platformStatus = "Running";

  const serviceHealthScore = health.status === "connected" ? 100 : 0;
  const values = [counts.active, counts.completed, counts.risk, counts.review, counts.agents, counts.agents, counts.renders, counts.publishing, counts.failed, counts.compliance, money(Number(counts.cost)), `${serviceHealthScore}%`];
  const metrics: MetricCard[] = metricLabels.map((label, index) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    value: String(values[index]),
    delta: "Current",
    deltaDirection: "flat",
    tone: ([2, 8, 9].includes(index) ? "danger" : [3, 6, 7].includes(index) ? "warning" : [4, 5, 11].includes(index) ? "info" : "success") as StatusTone,
    sparkline: [],
    context: index === 11 ? "Runtime and database availability" : `Live database value · last ${periodDays} days where applicable`
  }));

  const statusRows = result.recordsets[2] as Array<{ Status: string; count: number }>;
  const portfolioTotal = statusRows.reduce((sum, row) => sum + Number(row.count), 0);
  const throughputRows = result.recordsets[3] as Array<{ DayValue: Date; created: number; completed: number; published: number; failed: number }>;
  const agentRows = result.recordsets[4] as Array<{ AgentName: string; AgentRole: string; Status: string; TaskName: string | null; SuccessRate: number | null }>;
  const publishingRows = result.recordsets[5] as Array<any>;
  const deadline = result.recordsets[6][0] ?? {};
  const activityRows = result.recordsets[7] as Array<{ EventType: string; EntityType: string | null; CreatedAt: Date }>;
  const exceptionRows = result.recordsets[9] as Array<any>;

  return {
    generatedAt,
    filters: { workspaceId: workspace.id, brandId, periodDays, workspaces: workspace.options, brands: brandOptions },
    platform: {
      status: platformStatus,
      autonomousMode: platformStatus === "Paused" ? "Paused" : platformStatus === "Stopped" ? "Disabled" : "Database coordinated",
      currentOperation: platformStatus === "Idle" ? "No active operations" : platformStatus === "Paused" ? "Autonomous operations paused" : platformStatus === "Stopped" ? "Autonomous operations stopped" : workload ? "Processing persisted workload" : "Ready — awaiting queued work",
      currentStage: activeStage?.count ? activeStage.label : "No active stage",
      stageProgress: `${pipeline.filter((stage) => stage.count > 0).length} of ${pipeline.length} active stages`,
      stageProgressPercent: Math.round(Number(counts.averageProgress ?? 0)),
      activeProductions: Number(counts.active),
      runningWorkflows: Number(counts.agents),
      activeAgents: Number(counts.agents),
      renderingJobs: Number(counts.renders),
      publishingJobs: Number(counts.publishing),
      criticalExceptions: Number(counts.risk) + Number(counts.compliance),
      lastHealthCheck: new Date(health.checkedAt).toLocaleTimeString()
    },
    metrics,
    portfolio: statusRows.map((row) => ({ label: displayStatus(row.Status), value: Number(row.count), percent: portfolioTotal ? Math.round(Number(row.count) / portfolioTotal * 100) : 0 })),
    pipeline,
    throughput: {
      labels: throughputRows.map((row) => new Date(row.DayValue).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
      created: throughputRows.map((row) => Number(row.created)),
      completed: throughputRows.map((row) => Number(row.completed)),
      published: throughputRows.map((row) => Number(row.published)),
      failed: throughputRows.map((row) => Number(row.failed))
    },
    agents: {
      total: agentRows.length,
      active: agentRows.filter((row) => row.Status === "running").length,
      idle: agentRows.filter((row) => row.Status === "queued").length,
      busy: agentRows.filter((row) => row.Status === "running").length,
      degraded: agentRows.filter((row) => row.Status === "offline").length,
      failed: agentRows.filter((row) => row.Status === "failed").length,
      top: agentRows.map((row) => ({ name: row.AgentName, role: row.AgentRole, status: displayStatus(row.Status), task: row.TaskName ?? "No task assigned", successRate: row.SuccessRate == null ? "—" : `${Number(row.SuccessRate).toFixed(0)}%` }))
    },
    publishing: publishingRows.map((row) => ({ channel: row.Channel, status: displayStatus(row.status), scheduled: Number(row.scheduled), ready: Number(row.ready), failed: Number(row.failed), lastPublished: row.lastPublished ? new Date(row.lastPublished).toLocaleString() : "—", nextPublish: row.nextPublish ? new Date(row.nextPublish).toLocaleString() : "—" })),
    quality: { totalIssues: exceptionRows.length + Number(counts.compliance), critical: exceptionRows.filter((row) => row.severity === "Critical").length, high: exceptionRows.filter((row) => row.severity === "High").length, medium: 0, low: 0, info: 0, areas: [] },
    deadlines: { overdue: Number(deadline.overdue ?? 0), dueToday: Number(deadline.dueToday ?? 0), dueThisWeek: Number(deadline.dueThisWeek ?? 0), dueNextWeek: Number(deadline.dueNextWeek ?? 0), estimatedCost: money(Number(counts.cost)), budgetUtilization: 0, costTrend: [] },
    exceptions: exceptionRows.map((row) => ({ severity: row.severity, category: row.category, description: row.description, affected: row.affected, firstDetected: new Date(row.detected).toLocaleString(), status: displayStatus(row.status) })),
    activity: activityRows.map((row) => ({ title: row.EventType, subtitle: row.EntityType ?? "System activity", time: new Date(row.CreatedAt).toLocaleString(), tone: "info" as const })),
    systemHealth: [{ service: "Microsoft SQL Server", status: health.status === "connected" ? "Operational" : "Offline" }, { service: "Next.js Runtime", status: "Operational" }]
  };
}
