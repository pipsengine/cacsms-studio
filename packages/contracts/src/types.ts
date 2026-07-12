export type ProductionFormat =
  | "documentary"
  | "story"
  | "teaching"
  | "course"
  | "explainer"
  | "tutorial"
  | "news"
  | "corporate"
  | "product"
  | "marketing"
  | "motivational"
  | "religious"
  | "historical-reenactment"
  | "children"
  | "podcast"
  | "interview"
  | "social-short"
  | "youtube-long-form"
  | "presentation"
  | "custom";

export type RequirementLevel = "mandatory" | "recommended" | "optional";

export type WorkflowStage =
  | "content-intelligence"
  | "script-structure"
  | "scene-planning"
  | "visual-production"
  | "video-animation"
  | "voice-music-sound"
  | "timeline-assembly"
  | "quality-assurance"
  | "hybrid-export"
  | "publishing";

export interface NavigationChild {
  label: string;
  slug: string;
}

export interface NavigationModule {
  label: string;
  slug: string;
  description: string;
  children: NavigationChild[];
}

export interface ContentTypeDefinition {
  id: ProductionFormat;
  label: string;
  summary: string;
  requiredInputs: string[];
  workflowStages: WorkflowStage[];
  aiAgentTeam: string[];
  scriptStructure: string[];
  sceneRules: string[];
  visualRequirements: string[];
  audioRequirements: string[];
  qaChecks: Array<{ label: string; level: RequirementLevel }>;
  durationRules: string[];
  outputFormats: string[];
  publishingDestinations: string[];
  exportModes: string[];
}

export type OpportunityState =
  | "discovered"
  | "researching"
  | "verified"
  | "scored"
  | "prioritized"
  | "preplanned"
  | "scheduled"
  | "ready"
  | "producing"
  | "published"
  | "learning"
  | "archived";

export type AutonomyMode = "assisted" | "recommended" | "supervised-autonomous" | "fully-autonomous";

export interface OpportunitySignalSource {
  id: string;
  label: string;
  cadence: string;
  coverage: string[];
}

export interface OpportunityScoreModel {
  label: string;
  weight: number;
  description: string;
}

export interface OpportunityPortfolioItem {
  id: string;
  title: string;
  category: string;
  state: OpportunityState;
  overallScore: number;
  emotionalProfile: string[];
  productionFormats: ProductionFormat[];
  recommendedChannels: string[];
  publishWindow: string;
  estimatedCostBand: string;
  expectedReturn: string;
}

export interface OpportunityCampaign {
  id: string;
  title: string;
  anchorOpportunity: string;
  outputs: string[];
}

export type KnowledgeObjectType =
  | "topic"
  | "entity"
  | "relationship"
  | "source"
  | "collection"
  | "prediction"
  | "reasoning-chain"
  | "memory"
  | "media-asset"
  | "production-result";

export type KnowledgeConfidence = "low" | "medium" | "high" | "verified";

export interface KnowledgeUniverseMetric {
  label: string;
  value: string | number;
  detail: string;
}

export interface KnowledgeDomain {
  id: string;
  label: string;
  objects: number;
  confidence: number;
  freshness: number;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: KnowledgeObjectType;
  confidence: KnowledgeConfidence;
}

export interface KnowledgeGraphRelationship {
  from: string;
  to: string;
  label: string;
  confidence: KnowledgeConfidence;
}

export interface KnowledgeCollection {
  id: string;
  title: string;
  summary: string;
  includes: string[];
}

export interface KnowledgePrediction {
  id: string;
  title: string;
  horizon: string;
  confidence: number;
  implication: string;
}
