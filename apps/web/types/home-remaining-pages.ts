export type PageStatus =
  | "not-started"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "warning"
  | "healthy"
  | "degraded"
  | "offline"
  | "read"
  | "unread";

export interface PageMetric {
  key: string;
  label: string;
  value: number | string;
  percent?: number | null;
  trend?: "up" | "down" | "flat" | null;
  helper?: string | null;
}

export interface OperationalRow {
  id: string;
  title: string;
  subtitle?: string | null;
  values: Record<string, string | number | null>;
  status?: PageStatus | null;
  progress?: number | null;
  updatedAt?: string | null;
}

export interface SidePanelItem {
  id: string;
  title: string;
  subtitle?: string | null;
  value?: string | number | null;
  status?: PageStatus | null;
}

export interface HomeOperationalResponse {
  generatedAt: string;
  metrics: PageMetric[];
  rows: OperationalRow[];
  panels: Record<string, SidePanelItem[]>;
  total: number;
  page: number;
  pageSize: number;
}
