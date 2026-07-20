import type { WorkflowStage } from "@cacsms/contracts";

export type LifecycleChecklistItem =
  | "required-work-completed"
  | "validation-checks-passed"
  | "exceptions-resolved"
  | "stage-output-recorded"
  | "next-stage-ready";

export interface LifecycleStageState {
  checklist: Record<LifecycleChecklistItem, boolean>;
  ready: boolean;
  completedAt: string | null;
}

export interface ProductionLifecycleSettings {
  autoAdvance: boolean;
  currentStageId: WorkflowStage;
  stages: Partial<Record<WorkflowStage, LifecycleStageState>>;
  updatedAt: string;
}

export interface LifecycleStageStatus {
  id: WorkflowStage;
  order: number;
  label: string;
  statusLabel: string;
  count: number | null;
}

export interface ProductionLifecycleSnapshot {
  settings: ProductionLifecycleSettings;
  stages: LifecycleStageStatus[];
  generatedAt: string;
  source: "live" | "fallback";
}
