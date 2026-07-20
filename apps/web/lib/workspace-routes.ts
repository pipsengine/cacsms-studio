import { homeOperationalSlugs } from "@/lib/home-operational-pages";
import { contentIntelligenceSlugs } from "@/lib/content-intelligence-pages";
import { productionSlugs } from "@/lib/production-studio-pages";
import { intelligenceEngineSlugs } from "@/lib/intelligence-engine-definitions";
import { isOperationalSlug } from "@/lib/opportunity-operations-data";
import { productionLifecycleStages } from "@cacsms/contracts";

const dashboardWorkspaces = new Set([
  "executive-dashboard",
  "my-workspace",
  "active-productions",
  "recent-productions",
  "production-workflow",
  "production-pipeline",
  "rendering-monitor",
  "agent-activity",
  "publishing-overview",
  "calendar",
  "notifications",
  "system-health"
]);

const opportunitySlugs = new Set<string>([
  "opportunity-dashboard",
  "discovery-engine",
  "gap-detection",
  "scoring-engine",
  "editorial-board",
  "opportunity-scheduler",
  "autonomy-modes",
  "learning-engine",
  "multi-format-planner",
  "executive-recommendations",
  "opportunity-portfolio",
  "campaign-builder",
  "evergreen-knowledge-bank",
  ...intelligenceEngineSlugs
]);

const lifecycleRoutes = new Set(productionLifecycleStages.map((stage) => `/production-workflow/${stage.id}`));

const explicitRoutes = new Set<string>([
  "/",
  "/dashboard",
  "/production-studio",
  "/production-workflow",
  "/production-pipeline",
  "/content-intelligence",
  "/opportunity-intelligence",
  "/knowledge-universe",
  "/settings/production-defaults",
  "/coming-soon",
  "/api/health",
  ...lifecycleRoutes,
  ...homeOperationalSlugs.map((slug) => `/home/${slug}`),
  ...contentIntelligenceSlugs.map((slug) => `/content-intelligence/${slug}`),
  ...productionSlugs.map((slug) => `/production-studio/${slug}`),
  ...[...opportunitySlugs].map((slug) => `/opportunity-intelligence/${slug}`)
]);

for (const slug of dashboardWorkspaces) {
  explicitRoutes.add(`/dashboard/${slug}`);
}

export function normalizeWorkspacePath(href: string) {
  const path = href.split("?")[0].split("#")[0];
  if (path.endsWith("/") && path.length > 1) return path.slice(0, -1);
  return path;
}

export function isWorkspaceRouteImplemented(href: string) {
  const path = normalizeWorkspacePath(href);

  if (explicitRoutes.has(path)) return true;
  if (path.startsWith("/production-studio/")) return productionSlugs.includes(path.replace("/production-studio/", ""));
  if (path.startsWith("/content-intelligence/")) return contentIntelligenceSlugs.includes(path.replace("/content-intelligence/", ""));
  if (path.startsWith("/opportunity-intelligence/")) {
    const slug = path.replace("/opportunity-intelligence/", "");
    return opportunitySlugs.has(slug) || isOperationalSlug(slug);
  }
  if (path.startsWith("/home/")) return homeOperationalSlugs.includes(path.replace("/home/", ""));
  if (path.startsWith("/production-workflow/")) return productionLifecycleStages.some((stage) => path === `/production-workflow/${stage.id}`);
  if (path.startsWith("/knowledge-universe/")) return true;
  if (path.startsWith("/dashboard/")) return dashboardWorkspaces.has(path.replace("/dashboard/", ""));

  return false;
}

export function comingSoonLabel(href: string) {
  const path = normalizeWorkspacePath(href);
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1]?.replace(/-/g, " ") ?? "Workspace";
}
