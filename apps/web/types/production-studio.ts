export type ProductionStatus = "draft" | "queued" | "in-progress" | "review" | "approved" | "scheduled" | "published" | "completed" | "paused" | "failed" | "archived" | "at-risk" | "blocked";

export type ProductionMetric = { key: string; label: string; value: string; helper?: string; percent?: number; trend?: string };
export type ProductionRecord = {
  id: string; code: string; title: string; subtitle?: string; type: string; stage: string; owner: string;
  progress: number; status: ProductionStatus; deadline?: string; updatedAt: string; thumbnailUrl?: string;
  values?: Record<string, string | number | null>;
};
export type ProductionPanelItem = { id: string; label: string; value?: string; detail?: string; status?: ProductionStatus };
export type ProductionPageResponse = {
  generatedAt: string; slug: string; metrics: ProductionMetric[]; records: ProductionRecord[];
  panels: Record<string, ProductionPanelItem[]>; total: number;
};
export type CreateProductionPayload = {
  title: string; topic: string; contentType: string; templateId: string; audience: string; language: string;
  goals: string; references: string[]; settings: Record<string, boolean>;
};
