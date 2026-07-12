export type RecentProductionStatus = "completed" | "published" | "archived" | "cancelled" | "failed";
export type RecentProductionType = "video" | "article" | "script" | "audio" | "image" | "other";

export interface RecentProductionOwner {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface RecentProduction {
  id: string;
  code: string;
  title: string;
  type: RecentProductionType;
  status: RecentProductionStatus;
  owner: RecentProductionOwner;
  completedAt: string | null;
  publishedAt: string | null;
  durationDays: number | null;
  channel?: string | null;
  qualityScore?: number | null;
  performanceScore?: number | null;
  thumbnailUrl?: string | null;
  updatedAt: string;
}

export interface RecentProductionMetric {
  key: string;
  label: string;
  value: number | string;
  percent?: number | null;
  trend?: "up" | "down" | "flat" | null;
  helper?: string | null;
}

export interface RecentStatusBreakdown {
  status: RecentProductionStatus;
  count: number;
  percentage: number;
}

export interface RecentTypeBreakdown {
  type: string;
  count: number;
  percentage: number;
}

export interface RecentPerformancePoint {
  date: string;
  completed: number;
  published: number;
  failed: number;
}

export interface RecentChannelPerformance {
  channel: string;
  productions: number;
  views: number;
  engagementRate: number;
}

export interface RecentActivityItem {
  id: string;
  actor: string;
  action: string;
  productionTitle: string;
  createdAt: string;
}

export interface RecentProductionsResponse {
  generatedAt: string;
  filters: {
    workspaceId: string | null;
    brandId: string | null;
    from: string | null;
    to: string | null;
  };
  metrics: RecentProductionMetric[];
  productions: RecentProduction[];
  statusBreakdown: RecentStatusBreakdown[];
  typeBreakdown: RecentTypeBreakdown[];
  performance: RecentPerformancePoint[];
  channelPerformance: RecentChannelPerformance[];
  activity: RecentActivityItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecentProductionsQuery {
  workspaceId?: string;
  brandId?: string;
  from?: string;
  to?: string;
  status?: string;
  type?: string;
  ownerId?: string;
  channel?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}
