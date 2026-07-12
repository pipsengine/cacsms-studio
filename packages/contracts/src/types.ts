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
