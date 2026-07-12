export type HealthStatus = "on-track" | "at-risk" | "delayed" | "paused";
export type Priority = "high" | "medium" | "low";

export interface ProductionOwner {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface ActiveProduction {
  id: string;
  code: string;
  title: string;
  type: "video" | "article" | "script" | "audio" | "image" | "other";
  stage: string;
  stageDetail?: string | null;
  owner: ProductionOwner;
  progress: number;
  healthStatus: HealthStatus;
  deadline: string;
  daysRemaining: number;
  priority: Priority;
  thumbnailUrl?: string | null;
  updatedAt: string;
}

export interface MetricCard {
  key: string;
  label: string;
  value: number | string;
  percent?: number | null;
  helper?: string | null;
  trend?: "up" | "down" | "flat" | null;
  status?: HealthStatus | "neutral";
}

export interface StageBreakdown {
  stage: string;
  count: number;
  percentage: number;
}

export interface HealthBreakdown {
  status: HealthStatus;
  count: number;
  percentage: number;
}

export interface DeadlineItem {
  productionId: string;
  title: string;
  type: string;
  deadline: string;
  daysRemaining: number;
}

export interface RiskItem {
  key: string;
  label: string;
  description: string;
  count: number;
  severity: "critical" | "high" | "medium" | "low";
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  productionTitle: string;
  createdAt: string;
  kind: "update" | "upload" | "move" | "review" | "comment";
}

export interface WorkloadItem {
  userId: string;
  name: string;
  role: string;
  workloadPercent: number;
  avatarUrl?: string | null;
}

export interface ActiveProductionsResponse {
  generatedAt: string;
  filters: {
    workspaceId: string | null;
    brandId: string | null;
    from: string | null;
    to: string | null;
  };
  metrics: MetricCard[];
  productions: ActiveProduction[];
  stageBreakdown: StageBreakdown[];
  healthBreakdown: HealthBreakdown[];
  deadlines: DeadlineItem[];
  risks: RiskItem[];
  activity: ActivityItem[];
  workload: WorkloadItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActiveProductionsQuery {
  workspaceId?: string;
  brandId?: string;
  from?: string;
  to?: string;
  status?: string;
  stage?: string;
  priority?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}
