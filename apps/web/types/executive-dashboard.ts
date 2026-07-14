export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface MetricCard {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaDirection: "up" | "down" | "flat";
  tone: StatusTone;
  sparkline: number[];
  context: string;
}

export interface PipelineStageSummary {
  key: string;
  label: string;
  count: number;
  atRisk: number;
}

export interface ExecutiveDashboardData {
  generatedAt: string;
  filters: {
    workspaceId: string;
    brandId: string | null;
    periodDays: number;
    workspaces: Array<{ id: string; name: string }>;
    brands: Array<{ id: string; name: string }>;
  };
  platform: {
    status: "Idle" | "Running" | "Paused" | "Stopped" | "Starting" | "Stopping" | "Degraded" | "Failed" | "Maintenance";
    autonomousMode: string;
    currentOperation: string;
    currentStage: string;
    stageProgress: string;
    stageProgressPercent: number;
    activeProductions: number;
    runningWorkflows: number;
    activeAgents: number;
    renderingJobs: number;
    publishingJobs: number;
    criticalExceptions: number;
    lastHealthCheck: string;
  };
  metrics: MetricCard[];
  portfolio: Array<{ label: string; value: number; percent: number }>;
  pipeline: PipelineStageSummary[];
  throughput: {
    labels: string[];
    created: number[];
    completed: number[];
    published: number[];
    failed: number[];
  };
  agents: {
    total: number;
    active: number;
    idle: number;
    busy: number;
    degraded: number;
    failed: number;
    top: Array<{ name: string; role: string; status: string; task: string; successRate: string }>;
  };
  publishing: Array<{
    channel: string;
    status: string;
    scheduled: number;
    ready: number;
    failed: number;
    lastPublished: string;
    nextPublish: string;
  }>;
  quality: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    areas: Array<{ label: string; score: number }>;
  };
  deadlines: {
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    dueNextWeek: number;
    estimatedCost: string;
    budgetUtilization: number;
    costTrend: number[];
  };
  exceptions: Array<{
    severity: string;
    category: string;
    description: string;
    affected: string;
    firstDetected: string;
    status: string;
  }>;
  activity: Array<{ title: string; subtitle: string; time: string; tone: StatusTone }>;
  systemHealth: Array<{ service: string; status: string }>;
}
