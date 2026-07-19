import type { OpportunityState, WorkflowStage } from "./types";

/** Orchestrator internal stages → UI Production Life Cycle stages */
export const orchestratorStageToLifecycle: Record<string, WorkflowStage> = {
  research: "research",
  scripting: "produce",
  storyboard: "produce",
  "visual-generation": "produce",
  "audio-generation": "produce",
  assembly: "assemble",
  "quality-assurance": "quality",
  publishing: "publish",
  completed: "monitor"
};

/** Opportunity pipeline states → UI Production Life Cycle stages */
export const opportunityStateToLifecycle: Record<OpportunityState, WorkflowStage> = {
  discovered: "discover",
  researching: "research",
  verified: "research",
  scored: "evaluate",
  prioritized: "evaluate",
  preplanned: "pre-plan",
  scheduled: "schedule",
  ready: "pre-plan",
  producing: "produce",
  published: "monitor",
  learning: "learn",
  archived: "repeat"
};

/** README technical pipeline step labels → UI lifecycle stages */
export const pipelineStepToLifecycle: Record<string, WorkflowStage> = {
  "content-intelligence": "discover",
  "script-and-structure": "produce",
  "scene-planning": "produce",
  "visual-production": "produce",
  "video-and-animation": "produce",
  "voice-music-and-sound": "produce",
  "timeline-assembly": "assemble",
  "quality-assurance": "quality",
  "hybrid-export": "export",
  "capcut-direct-publishing": "publish"
};

export function resolveLifecycleStage(input: {
  orchestratorStage?: string | null;
  opportunityState?: OpportunityState | string | null;
  productionStage?: string | null;
}): WorkflowStage {
  if (input.orchestratorStage && orchestratorStageToLifecycle[input.orchestratorStage]) {
    return orchestratorStageToLifecycle[input.orchestratorStage];
  }
  if (input.opportunityState && input.opportunityState in opportunityStateToLifecycle) {
    return opportunityStateToLifecycle[input.opportunityState as OpportunityState];
  }
  if (input.productionStage && orchestratorStageToLifecycle[input.productionStage]) {
    return orchestratorStageToLifecycle[input.productionStage];
  }
  if (input.productionStage && opportunityStateToLifecycle[input.productionStage as OpportunityState]) {
    return opportunityStateToLifecycle[input.productionStage as OpportunityState];
  }
  return "discover";
}

export function lifecycleStagesForOrchestratorStage(stage: string): WorkflowStage[] {
  return (Object.entries(orchestratorStageToLifecycle) as Array<[string, WorkflowStage]>)
    .filter(([key]) => key === stage)
    .map(([, value]) => value);
}

export const lifecycleStageValidationRules: Record<
  WorkflowStage,
  { requiredChecks: string[]; minCount?: number }
> = {
  discover: { requiredChecks: ["signal-scan-complete", "opportunity-qualified"], minCount: 1 },
  research: { requiredChecks: ["evidence-pack-complete", "sources-verified"], minCount: 1 },
  evaluate: { requiredChecks: ["scoring-complete", "editorial-decision-recorded"], minCount: 1 },
  "pre-plan": { requiredChecks: ["production-brief-approved", "format-selected"], minCount: 1 },
  schedule: { requiredChecks: ["timeline-assigned", "dependencies-resolved"], minCount: 1 },
  produce: { requiredChecks: ["script-ready", "assets-generated"], minCount: 1 },
  assemble: { requiredChecks: ["timeline-built", "assets-synchronized"], minCount: 1 },
  quality: { requiredChecks: ["qa-passed", "compliance-cleared"], minCount: 1 },
  export: { requiredChecks: ["deliverables-rendered", "packages-validated"], minCount: 1 },
  publish: { requiredChecks: ["channels-ready", "release-recorded"], minCount: 1 },
  monitor: { requiredChecks: ["performance-signals-collected"], minCount: 1 },
  learn: { requiredChecks: ["learnings-approved"], minCount: 1 },
  repeat: { requiredChecks: ["loop-governed", "discovery-ready"], minCount: 1 }
};
