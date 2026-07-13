export type ProductionPageConfig = {
  slug: string; title: string; description: string; primaryAction: string; columns: string[]; metricLabels: string[]; panelTitles: string[];
};

const standardColumns = ["Production", "Type", "Stage", "Owner", "Progress", "Status", "Updated"];
const standardMetrics = ["Total", "In Progress", "In Review", "Completed", "At Risk", "Avg. Cycle Time"];
const page = (slug: string, title: string, description: string, primaryAction = "Create Production", columns = standardColumns, metricLabels = standardMetrics, panelTitles = ["Production Mix", "Operational Alerts"]): ProductionPageConfig => ({ slug, title, description, primaryAction, columns, metricLabels, panelTitles });

export const productionPages: Record<string, ProductionPageConfig> = {
  dashboard: page("dashboard", "Production Studio", "Plan, create, coordinate, and monitor every autonomous media production from concept to completion.", "Create Production", ["Production", "Type", "Stage", "Owner", "Progress", "Status", "Deadline"], ["Active Productions", "In Queue", "Drafts", "Completed", "At Risk", "Avg. Cycle Time"]),
  "all-productions": page("all-productions", "All Productions", "View and manage every production across formats, owners, stages, and publishing destinations."),
  documentaries: page("documentaries", "Documentaries", "Develop factual, research-led productions from early treatment through delivery.", "Create Documentary"),
  stories: page("stories", "Stories", "Manage narrative productions, episodic stories, scripts, and story-led campaigns.", "Create Story"),
  "teaching-content": page("teaching-content", "Teaching Content", "Create structured learning experiences, lessons, and educational media.", "Create Teaching Content"),
  courses: page("courses", "Courses", "Plan and produce multi-part courses with lessons, assessments, and learning outcomes.", "Create Course"),
  explainers: page("explainers", "Explainers", "Turn complex subjects into clear, engaging, and accessible visual explanations.", "Create Explainer"),
  tutorials: page("tutorials", "Tutorials", "Produce step-by-step instructional content for products, workflows, and skills.", "Create Tutorial"),
  "corporate-content": page("corporate-content", "Corporate Content", "Coordinate professional communications, internal media, and executive content.", "Create Corporate Content"),
  "marketing-content": page("marketing-content", "Marketing Content", "Create campaign-ready promotional, product, and brand media.", "Create Marketing Content"),
  podcasts: page("podcasts", "Podcasts", "Plan episodes, guests, recordings, edits, and distribution workflows.", "Create Podcast"),
  "social-content": page("social-content", "Social Content", "Manage short-form social content across channels, formats, and campaigns.", "Create Social Content"),
  "custom-productions": page("custom-productions", "Custom Productions", "Build tailored production workflows for specialized formats and requirements.", "Create Custom Production"),
  "production-queue": page("production-queue", "Production Queue", "Prioritize queued work, assignments, dependencies, and readiness for production.", "Add to Queue", ["Queue Item", "Type", "Stage", "Owner", "Progress", "Status", "Updated"], ["Queued Items", "Critical Priority", "Ready to Start", "Blocked", "Assigned", "Avg. Wait Time"], ["Queue Health", "Blocked Items"]),
  drafts: page("drafts", "Drafts", "Resume, review, and organize productions that have not yet entered the active pipeline.", "Create Production"),
  "completed-productions": page("completed-productions", "Completed Productions", "Review delivered productions, outcomes, assets, and final publishing status.", "Export Report"),
  "archived-productions": page("archived-productions", "Archived Productions", "Find and restore historical productions retained for records and reuse.", "Export Archive")
};

export const productionSlugs = ["create-production", ...Object.keys(productionPages).filter((slug) => slug !== "dashboard"), "production-pipeline", "production-calendar"];
