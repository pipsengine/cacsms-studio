import { contentTypeDefinitions, navigationModules, productionPipeline } from "@cacsms/contracts";

export const apiManifest = {
  name: "CACSMS Studio API",
  version: "0.1.0",
  modules: [
    "auth",
    "organizations",
    "workspaces",
    "productions",
    "content-types",
    "research",
    "scripts",
    "story-learning",
    "storyboards",
    "scenes",
    "assets",
    "visuals",
    "video",
    "audio",
    "timelines",
    "subtitles",
    "quality",
    "approvals",
    "exports",
    "publishing",
    "agents",
    "automations",
    "integrations",
    "analytics",
    "notifications",
    "audit",
    "settings",
    "production-lifecycle"
  ],
  contentTypes: contentTypeDefinitions.map((type) => type.id),
  navigationModules: navigationModules.map((module) => module.slug),
  pipelineStages: productionPipeline.map((stage) => stage.id)
};
