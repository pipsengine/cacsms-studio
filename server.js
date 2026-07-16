const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { randomUUID } = require("node:crypto");

const webDir = path.join(__dirname, "apps", "web");
loadWebEnvironment(webDir);
if (!process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN) {
  process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN = randomUUID();
}

const pipelineDir = path.join(webDir, "public", "production-pipeline");
const pipelineIndexPath = path.join(pipelineDir, "index.html");
const pipelineStylesPath = path.join(pipelineDir, "styles.css");
const landingDir = path.join(webDir, "public", "landing-dashboard");
const landingIndexPath = path.join(landingDir, "index.html");
const workflowDir = path.join(webDir, "public", "production-workflow");
const workflowIndexPath = path.join(workflowDir, "index.html");
const workflowStylesPath = path.join(workflowDir, "styles.css");
const moduleFlowDir = path.join(webDir, "public", "module-flow");
const moduleFlowIndexPath = path.join(moduleFlowDir, "index.html");
const moduleFlowStylesPath = path.join(moduleFlowDir, "styles.css");
const sharedSidebarPath = path.join(webDir, "public", "shared-sidebar.js");
const webRequire = createRequire(path.join(webDir, "package.json"));

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || 3018;
const dev = process.env.NODE_ENV !== "production";
const isNamedPipe = typeof port === "string" && Number.isNaN(Number(port));
let next;

try {
  next = webRequire("next");
} catch (error) {
  console.warn("Next.js is not available. Starting CACSMS Studio fallback runtime.");
}

function loadWebEnvironment(directory) {
  const merged = {};
  for (const fileName of [".env", ".env.production", ".env.local"]) {
    const filePath = path.join(directory, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (next) {
  const app = next({ dev, dir: webDir, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    listen(http.createServer((request, response) => handle(request, response)));
  });
} else {
  listen(http.createServer(handleFallbackRequest));
}

function listen(server) {
  if (isNamedPipe) {
    server.listen(port, () => {
      console.log(`CACSMS Studio listening on IIS pipe ${port}`);
    });
    return;
  }

  server.listen(Number(port), hostname, () => {
    console.log(`CACSMS Studio listening on ${hostname}:${port}`);
    startAutonomousKnowledgeScheduler();
    startAutonomousOpportunityScoringScheduler();
    startAutonomousOpportunityPortfolioScheduler();
    startAutonomousEditorialScheduler();
    startAutonomousExecutiveRecommendationScheduler();
    startAutonomousKnowledgeQualityScheduler();
    startAutonomousProductionOrchestrationScheduler();
    startAutonomousMultiFormatPlannerScheduler();
    startAutonomousCampaignBuilderScheduler();
    startAutonomousEvergreenKnowledgeScheduler();
    startAutonomousTemplateIntelligenceScheduler();
    startAutonomousOpportunityScheduler();
    startAutonomousStoryStructureScheduler();
  });
}

function startAutonomousOpportunityScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_OPPORTUNITY_SCHEDULER_INTERVAL_MS || 30_000));
  const run = async () => { try { const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/opportunity-scheduler`, {method:"POST", headers:{"content-type":"application/json","x-cacsms-internal":process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN}, body:JSON.stringify({action:"run"}), signal:AbortSignal.timeout(55_000)}); if(!response.ok) console.error("opportunity.scheduler.failed",{status:response.status}); } catch(error) { console.error("opportunity.scheduler.failed",{name:error instanceof Error?error.name:"Unknown"}); } };
  setTimeout(run, 41_000).unref(); setInterval(run, intervalMs).unref();
}

function startAutonomousKnowledgeScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_KNOWLEDGE_INTERVAL_MS || 60_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/knowledge-universe/autonomy`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run", trigger: "scheduler"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("knowledge.autonomy.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("knowledge.autonomy.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 5_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousOpportunityScoringScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_SCORING_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/scoring-engine`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.scoring.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.scoring.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 10_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousOpportunityPortfolioScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_PORTFOLIO_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/opportunity-portfolio`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.portfolio.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.portfolio.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 15_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousEditorialScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_EDITORIAL_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/editorial-board`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.editorial.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.editorial.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 20_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousExecutiveRecommendationScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_EXECUTIVE_RECOMMENDATION_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/executive-recommendations`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.executive.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.executive.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 25_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousKnowledgeQualityScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_KNOWLEDGE_QUALITY_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/knowledge-universe/quality`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("knowledge.quality.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("knowledge.quality.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 28_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousProductionOrchestrationScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_PRODUCTION_ORCHESTRATION_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/production-studio/create-production`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("production.orchestration.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("production.orchestration.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 29_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousMultiFormatPlannerScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_MULTI_FORMAT_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/multi-format-planner`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.multi-format.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.multi-format.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 31_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousCampaignBuilderScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_CAMPAIGN_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/campaign-builder`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.campaign.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.campaign.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 33_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousEvergreenKnowledgeScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_EVERGREEN_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/evergreen-knowledge-bank`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("opportunity.evergreen.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("opportunity.evergreen.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 37_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousTemplateIntelligenceScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_TEMPLATE_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/opportunity-intelligence/operations/template-dashboard`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("templates.autonomy.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("templates.autonomy.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 39_000).unref();
  setInterval(run, intervalMs).unref();
}

function startAutonomousStoryStructureScheduler() {
  if (dev || isNamedPipe) return;
  const intervalMs = Math.max(30_000, Number(process.env.CACSMS_STORY_STRUCTURE_INTERVAL_MS || 30_000));
  const run = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/story-learning/structure-dashboard`, {
        method: "POST",
        headers: {"content-type": "application/json", "x-cacsms-internal": process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN},
        body: JSON.stringify({action: "run"}),
        signal: AbortSignal.timeout(55_000)
      });
      if (!response.ok) console.error("story.structure.scheduler.failed", {status: response.status});
    } catch (error) {
      console.error("story.structure.scheduler.failed", {name: error instanceof Error ? error.name : "Unknown"});
    }
  };
  setTimeout(run, 35_000).unref();
  setInterval(run, intervalMs).unref();
}

function handleFallbackRequest(request, response) {
  const url = new URL(request.url || "/", "http://localhost");

  if (url.pathname === "/api/health") {
    sendJson(response, {
      status: "ok",
      service: "cacsms-studio",
      runtime: "fallback-node",
      publicPort: Number(process.env.CACSMS_PUBLIC_PORT || 3008),
      internalPort: Number(process.env.PORT || 3018),
      productionTypes: 20,
      modules: 22,
      pipelineStages: 10
    });
    return;
  }

  if (url.pathname === "/styles.css" || url.pathname === "/production-pipeline/styles.css") {
    sendFile(response, pipelineStylesPath, "text/css; charset=utf-8");
    return;
  }

  if (url.pathname === "/production-workflow/styles.css") {
    sendFile(response, workflowStylesPath, "text/css; charset=utf-8");
    return;
  }

  if (url.pathname === "/module-flow/styles.css") {
    sendFile(response, moduleFlowStylesPath, "text/css; charset=utf-8");
    return;
  }

  if (url.pathname === "/shared-sidebar.js") {
    sendFile(response, sharedSidebarPath, "text/javascript; charset=utf-8");
    return;
  }

  if (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/dashboard/") {
    sendFile(response, landingIndexPath, "text/html; charset=utf-8");
    return;
  }

  if (url.pathname === "/production-pipeline" || url.pathname === "/production-pipeline/") {
    sendFile(response, pipelineIndexPath, "text/html; charset=utf-8");
    return;
  }

  if (url.pathname === "/production-workflow" || url.pathname === "/production-workflow/") {
    sendFile(response, workflowIndexPath, "text/html; charset=utf-8");
    return;
  }

  if (url.pathname === "/module-flow" || url.pathname === "/module-flow/") {
    sendFile(response, moduleFlowIndexPath, "text/html; charset=utf-8");
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(renderFallbackPage());
}

function sendFile(response, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end("CACSMS Studio asset not found.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

function sendJson(response, payload) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function renderFallbackPage() {
  const modules = [
    { label: "Home", children: ["Executive Dashboard", "My Workspace", "Active Productions", "Recent Productions", "Production Pipeline", "Rendering Monitor", "Agent Activity", "Publishing Overview", "Calendar", "Notifications", "System Health"] },
    { label: "Production Studio", children: ["Create Production", "All Productions", "Documentaries", "Stories", "Teaching Content", "Courses", "Explainers", "Tutorials", "Corporate Content", "Marketing Content", "Podcasts", "Social Content", "Custom Productions", "Production Pipeline", "Production Queue", "Drafts", "Completed Productions", "Archived Productions", "Production Calendar"] },
    { label: "Content Intelligence", children: ["Topic Discovery", "Research Workspace", "Source Analysis", "Fact Verification", "Knowledge Extraction", "Citation Manager", "Trend Intelligence", "Audience Research", "Competitor Intelligence", "Content Gap Analysis", "Curriculum Research", "Source Library", "Knowledge Base", "Intelligence Reports"] },
    { label: "Writing Studio", children: ["Writing Dashboard", "Script Generator", "Script Editor", "Narration Writer", "Story Writer", "Lesson Writer", "Course Writer", "Explainer Writer", "Tutorial Writer", "Dialogue Writer", "Interview Builder", "Podcast Writer", "Social Script Writer", "Title and Hook Generator", "Call-to-Action Builder", "Versions", "Reviews", "Approvals", "Script Export"] },
    { label: "Story & Learning Design", children: ["Structure Dashboard", "Narrative Designer", "Character Designer", "World Builder", "Plot and Conflict Builder", "Episode Planner", "Learning Objective Builder", "Curriculum Designer", "Lesson Planner", "Teaching Sequence", "Knowledge Checks", "Quiz Builder", "Assessment Builder", "Examples and Case Studies", "Engagement Planner", "Age and Difficulty Adaptation", "Structure Approval"] },
    { label: "Storyboard Studio", children: ["Storyboard Dashboard", "Auto Storyboard", "Scene Planner", "Shot Planner", "Teaching Visual Planner", "Demonstration Planner", "Camera Planner", "Motion Planner", "Transition Planner", "Text and Graphics Planner", "Storyboard Editor", "Scene Sequencer", "Preview", "Versions", "Approval"] },
    { label: "Visual Studio", children: ["Visual Dashboard", "Image Generator", "Character Studio", "Character Consistency", "Environment Studio", "Object and Prop Studio", "Historical Reconstruction", "Illustration Studio", "Educational Diagram Studio", "Infographic Studio", "Chart and Data Visuals", "Map Studio", "Presentation Graphics", "Product Visuals", "Thumbnail Studio", "Brand Style Manager", "Prompt Library", "Batch Generation", "Visual QA", "Export"] },
    { label: "Video Studio", children: ["Video Dashboard", "Scene Video Generator", "Image-to-Video", "Text-to-Video", "Character Animation", "Presenter Generator", "Whiteboard Animation", "Slide-to-Video", "Screen Recording Processor", "Demonstration Composer", "Cinematic Director", "Camera Motion", "Motion Graphics", "Visual Effects", "Colour Grading", "Scene Editor", "Preview", "Render Queue", "Video QA", "Export"] },
    { label: "Audio Studio", children: ["Audio Dashboard", "Narration Generator", "Voice Library", "Voice Profiles", "Voice Cloning", "Pronunciation Manager", "Emotion and Delivery", "Dialogue Generator", "Multi-Speaker Audio", "Music Generator", "Music Library", "Sound Effects", "Ambient Sound", "Podcast Audio", "Audio Cleanup", "Audio Mixing", "Loudness Normalization", "Audio QA", "Export"] },
    { label: "Timeline Studio", children: ["Master Timeline", "Scene Timeline", "Video Track", "Narration Track", "Dialogue Track", "Music Track", "Sound-Effects Track", "Subtitle Track", "Graphics Track", "Auto Assemble", "Synchronization", "Transition Manager", "Timeline Preview", "Timeline Versions", "Render Preview", "Timeline Export"] },
    { label: "Quality & Compliance", children: ["Quality Dashboard", "Content QA", "Script QA", "Story QA", "Teaching QA", "Fact Verification", "Visual QA", "Video QA", "Audio QA", "Subtitle QA", "Continuity Check", "Character Consistency", "Learning Objective Check", "Accessibility Check", "Copyright Review", "Brand Compliance", "Platform Compliance", "AI Safety Review", "Human Review", "Final Approval"] },
    { label: "Export Center", children: ["Export Dashboard", "Final Video Export", "Editable Scene Package", "CapCut Package", "Audio Package", "Subtitle Package", "Storyboard Package", "Script Package", "Course Package", "Presentation Package", "Social Media Package", "Publishing Package", "Export History", "Download Center"] },
    { label: "Publishing Center", children: ["Publishing Dashboard", "Channels", "YouTube", "Facebook", "TikTok", "Instagram", "LinkedIn", "X", "Website", "Learning Platforms", "Podcast Platforms", "Scheduler", "SEO and Metadata", "Thumbnail Optimizer", "Publishing Queue", "Publication History", "Comments and Engagement", "Publishing Reports"] },
    { label: "Asset Library", children: ["All Assets", "Images", "Video Clips", "Audio", "Narrations", "Music", "Sound Effects", "Scripts", "Storyboards", "Characters", "Environments", "Diagrams", "Charts", "Maps", "Thumbnails", "Templates", "Brand Assets", "Licensed Assets", "Generated Assets", "Favourites", "Recycle Bin", "Archive"] },
    { label: "Templates", children: ["Template Dashboard", "Documentary Templates", "Story Templates", "Teaching Templates", "Course Templates", "Explainer Templates", "Tutorial Templates", "Corporate Templates", "Marketing Templates", "Podcast Templates", "Social Media Templates", "Timeline Templates", "Visual Style Templates", "Audio Templates", "Export Templates", "Custom Templates"] },
    { label: "AI Agents", children: ["Agent Dashboard", "Content Strategist", "Research Agent", "Fact Checker", "Scriptwriter", "Story Architect", "Curriculum Designer", "Teaching Agent", "Storyboard Director", "Visual Director", "Character Director", "Video Director", "Animation Director", "Narration Director", "Music Composer", "Sound Designer", "Timeline Editor", "Quality Reviewer", "Compliance Agent", "Export Agent", "Publishing Agent", "Agent Teams", "Agent Simulation Studio", "Workflows", "Prompts", "Tools", "Models", "Knowledge", "Memory", "Logs", "Costs", "Performance"] },
    { label: "Automation Hub", children: ["Automation Dashboard", "Workflow Builder", "Production Workflows", "Content-Type Workflows", "Event Triggers", "Scheduled Productions", "Batch Productions", "Approval Rules", "Conditional Routing", "Background Jobs", "Worker Monitor", "Queue Monitor", "Retry Manager", "Failure Recovery", "Notifications", "Webhooks", "Automation Logs"] },
    { label: "Analytics", children: ["Executive Analytics", "Production Analytics", "Content Analytics", "Audience Analytics", "Learning Analytics", "Engagement Analytics", "Publishing Analytics", "Revenue Analytics", "Agent Performance", "Model Usage", "Rendering Analytics", "Cost Analytics", "Quality Analytics", "Export Analytics", "Custom Reports"] },
    { label: "Collaboration", children: ["Teams", "Workspaces", "Assignments", "Tasks", "Comments", "Reviews", "Approvals", "Shared Assets", "Production Notes", "Mentions", "Notifications", "Activity Feed", "Audit History"] },
    { label: "Integrations", children: ["Integration Dashboard", "AI Models", "Research Providers", "Image Providers", "Video Providers", "Voice Providers", "Music Providers", "Storage Providers", "CapCut Export", "YouTube", "Facebook", "TikTok", "Instagram", "LinkedIn", "X", "Learning Platforms", "Podcast Platforms", "Google Drive", "OneDrive", "Dropbox", "Webhooks", "API Management"] },
    { label: "Administration", children: ["Organization", "Workspaces", "Users", "Roles", "Permissions", "Departments", "Content Policies", "AI Governance", "Usage Limits", "Model Access", "Cost Controls", "Billing", "Licences", "Security", "Audit Logs", "Data Retention", "Backup and Recovery", "System Operations"] },
    { label: "Settings", children: ["General", "Branding", "Content Defaults", "Production Defaults", "AI Configuration", "Model Routing", "Research Settings", "Script Settings", "Visual Settings", "Video Settings", "Audio Settings", "Subtitle Settings", "Render Settings", "Export Settings", "Publishing Settings", "Notification Settings", "Storage", "API Keys", "Environment", "Advanced"] }
  ];
  const productionTypes = [
    "Documentaries",
    "Stories and Narratives",
    "Teaching and Educational Content",
    "Courses and Lessons",
    "Explainer Videos",
    "Tutorials and Demonstrations",
    "News and Current-Affairs Analysis",
    "Business and Corporate Videos",
    "Product and Service Videos",
    "Marketing and Advertisements",
    "Motivational Content",
    "Religious and Inspirational Teachings",
    "Historical Re-enactments",
    "Children's Content",
    "Podcasts and Video Podcasts",
    "Interviews and Talk Shows",
    "Social Media Shorts",
    "YouTube Long-Form Videos",
    "Presentations and Visual Reports",
    "Custom Productions"
  ];
  const pipeline = [
    "Content Intelligence",
    "Script and Structure",
    "Scene Planning",
    "Visual Production",
    "Video and Animation",
    "Voice, Music and Sound",
    "Timeline Assembly",
    "Quality Assurance",
    "Hybrid Export",
    "CapCut / Direct Publishing"
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CACSMS Autonomous Media Studio</title>
  <style>
    :root { color-scheme: light; --bg:#f6f5f1; --panel:#fff; --ink:#17191c; --muted:#62676f; --line:#dedbd2; --brand:#08645f; --blue:#275e9a; --gold:#b7791f; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter,Segoe UI,Arial,sans-serif; }
    .shell { display:grid; grid-template-columns:360px 1fr; min-height:100vh; }
    aside { position:sticky; top:0; height:100vh; overflow:auto; background:linear-gradient(180deg,#ffffff 0%,#f8f7f3 48%,#f1f5f2 100%); border-right:1px solid var(--line); padding:16px 14px; scrollbar-width:thin; }
    aside::-webkit-scrollbar { width:10px; }
    aside::-webkit-scrollbar-thumb { background:#cfd5d0; border:3px solid transparent; border-radius:999px; background-clip:content-box; }
    .brand { display:flex; gap:12px; align-items:center; margin-bottom:14px; padding:10px; border:1px solid #e8e4db; border-radius:8px; background:rgba(255,255,255,.78); box-shadow:0 10px 28px rgba(25,29,34,.06); font-weight:800; text-transform:uppercase; font-size:12px; line-height:1.2; }
    .mark { display:grid; width:42px; height:42px; flex:0 0 auto; place-items:center; border-radius:8px; background:linear-gradient(135deg,#08645f,#275e9a); color:#fff; box-shadow:inset 0 0 0 1px rgba(255,255,255,.24); }
    .brand small { display:block; margin-top:4px; color:var(--muted); font-size:11px; font-weight:700; text-transform:none; }
    .sidebar-tools { display:grid; gap:10px; margin:0 0 12px; }
    .search { display:flex; align-items:center; gap:8px; min-height:38px; border:1px solid #e4e0d6; border-radius:8px; background:#fff; color:#777d84; padding:0 10px; box-shadow:0 8px 24px rgba(25,29,34,.05); }
    .search-icon { position:relative; width:14px; height:14px; flex:0 0 auto; border:2px solid var(--brand); border-radius:999px; }
    .search-icon::after { content:""; position:absolute; right:-5px; bottom:-4px; width:7px; height:2px; border-radius:999px; background:var(--brand); transform:rotate(45deg); }
    .search input { width:100%; border:0; outline:0; color:var(--ink); background:transparent; font-size:12px; font-weight:650; }
    .quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .quick-actions a { display:flex; align-items:center; justify-content:center; gap:7px; min-height:34px; border:1px solid #e4e0d6; border-radius:8px; background:#fff; color:#22272d; text-decoration:none; font-size:12px; font-weight:850; }
    .quick-actions a.primary { border-color:#08645f; background:#08645f; color:#fff; }
    .status-strip { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:12px; }
    .status-chip { border:1px solid #e4e0d6; border-radius:8px; background:#fff; padding:7px 8px; }
    .status-chip strong { display:block; font-size:14px; line-height:1; }
    .status-chip span { color:var(--muted); font-size:10px; font-weight:750; text-transform:uppercase; }
    nav { display:grid; gap:8px; }
    details { border:1px solid #e9e5dc; border-radius:8px; background:rgba(255,255,255,.72); overflow:hidden; }
    details[open] { box-shadow:0 12px 30px rgba(25,29,34,.06); }
    summary { display:grid; grid-template-columns:18px minmax(0,1fr) auto; gap:8px; align-items:center; cursor:pointer; list-style:none; color:#20242a; padding:10px; font-size:13px; font-weight:850; }
    summary::-webkit-details-marker { display:none; }
    summary:hover { background:#e8f3ef; }
    summary::before { content:"›"; display:inline-block; width:16px; color:var(--brand); font-weight:900; transition:transform .15s ease; }
    details[open] summary::before { transform:rotate(90deg); }
    .children { display:grid; gap:1px; margin:2px 0 6px 24px; }
    .children a { border-radius:7px; color:#5b616a; padding:6px 8px; text-decoration:none; font-size:12px; font-weight:650; line-height:1.25; }
    .children a:hover { background:#eeece5; color:#17191c; }
    main { padding:28px; }
    .top { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:22px; margin-bottom:22px; }
    h1 { max-width:900px; margin:0; font-size:48px; line-height:1; letter-spacing:0; }
    p { color:var(--muted); line-height:1.55; }
    .badge { display:inline-flex; border:1px solid var(--line); border-radius:999px; background:#fff; padding:7px 11px; font-size:12px; font-weight:750; }
    .grid { display:grid; gap:16px; }
    .cols3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .cols2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 18px 40px rgba(25,29,34,.08); }
    .metric { font-size:34px; font-weight:850; }
    .pills { display:flex; flex-wrap:wrap; gap:8px; }
    .pill { border:1px solid var(--line); border-radius:999px; background:#fff; padding:6px 10px; font-size:12px; font-weight:650; }
    .stage { display:grid; grid-template-columns:34px 1fr; gap:12px; align-items:center; border:1px solid var(--line); border-radius:8px; padding:12px; background:#fff; }
    .num { display:grid; width:34px; height:34px; place-items:center; border-radius:8px; background:#e9f0f8; color:var(--blue); font-weight:850; }
    .shell { grid-template-columns:324px 1fr; }
    aside { background:linear-gradient(180deg,#ffffff 0%,#f8f7f3 48%,#f1f5f2 100%); padding:16px 14px; scrollbar-width:thin; }
    aside::-webkit-scrollbar { width:10px; }
    aside::-webkit-scrollbar-thumb { background:#cfd5d0; border:3px solid transparent; border-radius:999px; background-clip:content-box; }
    .brand { margin-bottom:14px; padding:10px; border:1px solid #e8e4db; border-radius:8px; background:rgba(255,255,255,.78); box-shadow:0 10px 28px rgba(25,29,34,.06); font-size:12px; }
    .mark { width:42px; height:42px; flex:0 0 auto; background:linear-gradient(135deg,#08645f,#275e9a); box-shadow:inset 0 0 0 1px rgba(255,255,255,.24); }
    .brand small { display:block; margin-top:4px; color:var(--muted); font-size:11px; font-weight:700; text-transform:none; }
    .sidebar-tools { display:grid; gap:10px; margin:0 0 12px; }
    .search { display:flex; align-items:center; gap:8px; min-height:38px; border:1px solid #e4e0d6; border-radius:8px; background:#fff; color:#777d84; padding:0 10px; box-shadow:0 8px 24px rgba(25,29,34,.05); }
    .search span { font-size:15px; color:var(--brand); }
    .search input { width:100%; border:0; outline:0; color:var(--ink); background:transparent; font-size:12px; font-weight:650; }
    .quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .quick-actions a { display:flex; align-items:center; justify-content:center; gap:7px; min-height:34px; border:1px solid #e4e0d6; border-radius:8px; background:#fff; color:#22272d; text-decoration:none; font-size:12px; font-weight:850; }
    .quick-actions a.primary { border-color:#08645f; background:#08645f; color:#fff; }
    .status-strip { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:12px; }
    .status-chip { border:1px solid #e4e0d6; border-radius:8px; background:#fff; padding:7px 8px; }
    .status-chip strong { display:block; font-size:14px; line-height:1; }
    .status-chip span { color:var(--muted); font-size:10px; font-weight:750; text-transform:uppercase; }
    details { border:1px solid #e9e5dc; border-radius:8px; background:rgba(255,255,255,.72); overflow:hidden; padding-bottom:0; }
    details[open] { box-shadow:0 12px 30px rgba(25,29,34,.06); }
    summary { display:grid; grid-template-columns:18px minmax(0,1fr) auto; gap:8px; align-items:center; padding:10px; font-weight:850; }
    summary:hover { background:#f2f8f5; }
    summary::before { content:">"; display:inline-grid; width:18px; height:18px; place-items:center; border-radius:6px; background:#e9f0f8; color:var(--blue); font-size:12px; font-weight:900; }
    .count { display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:22px; border-radius:999px; background:#f7eddb; color:#7a4b12; padding:0 7px; font-size:11px; font-weight:850; }
    .children { display:grid; gap:2px; margin:0; padding:0 8px 10px 36px; }
    .children a { position:relative; border-radius:7px; color:#5b616a; padding:7px 8px 7px 13px; font-weight:700; }
    .children a::before { content:""; position:absolute; left:3px; top:50%; width:4px; height:4px; border-radius:999px; background:#b9c1bc; transform:translateY(-50%); }
    .children a:hover { background:#eef3f0; color:#17191c; }
    .children a.is-active { background:#e8f3ef; color:#064642; font-weight:850; }
    .sidebar-footer { margin-top:12px; border:1px solid #e4e0d6; border-radius:8px; background:#fff; padding:10px; color:var(--muted); font-size:11px; line-height:1.45; }
    .sidebar-sticky { position:sticky; top:0; z-index:5; margin:-16px -14px 12px; padding:16px 14px 12px; background:linear-gradient(180deg,#ffffff 0%,rgba(255,255,255,.97) 76%,rgba(255,255,255,0) 100%); backdrop-filter:blur(12px); }
    .sidebar-kicker { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 2px 10px; color:#7a7f86; font-size:10px; font-weight:850; text-transform:uppercase; }
    .live-dot { display:inline-flex; align-items:center; gap:6px; color:#08645f; }
    .live-dot::before { content:""; width:7px; height:7px; border-radius:999px; background:#1f9d68; box-shadow:0 0 0 4px rgba(31,157,104,.12); }
    .nav-label { display:flex; align-items:center; justify-content:space-between; margin:14px 4px 7px; color:#8a9098; font-size:10px; font-weight:900; text-transform:uppercase; }
    nav { gap:4px; }
    details { border-color:transparent; background:transparent; border-radius:8px; }
    details[open] { border-color:#e9e5dc; background:rgba(255,255,255,.8); box-shadow:0 10px 24px rgba(25,29,34,.055); }
    summary { min-height:44px; border-radius:8px; grid-template-columns:30px minmax(0,1fr) auto 16px; padding:7px 8px; }
    summary::before { display:none; }
    summary::after { content:">"; display:grid; width:16px; height:16px; place-items:center; color:#98a0a8; font-size:11px; font-weight:900; transition:transform .16s ease; }
    details[open] summary::after { transform:rotate(90deg); color:#08645f; }
    details:not([open]) summary:hover { background:#f5f3ed; }
    details[open] summary { color:#064642; }
    .nav-icon { display:grid; width:30px; height:30px; place-items:center; border:1px solid #dfe7e3; border-radius:8px; background:#f8faf9; color:#52616a; font-size:11px; font-weight:900; letter-spacing:0; }
    details[open] .nav-icon { border-color:#08645f; background:#08645f; color:#fff; box-shadow:0 8px 18px rgba(8,100,95,.22); }
    .nav-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .children { margin-left:23px; border-left:1px solid #e3e7e3; padding:3px 8px 8px 14px; }
    .children a { color:#616873; font-weight:650; }
    .children a.is-active { box-shadow:inset 3px 0 0 #08645f; }
    .nav-empty { display:none; margin:10px 4px; border:1px dashed #d7d2c8; border-radius:8px; color:#747a82; padding:12px; font-size:12px; line-height:1.45; }
    @media (max-width:900px){ .shell,.cols2,.cols3{grid-template-columns:1fr;} aside{position:relative;} h1{font-size:34px;} }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="sidebar-sticky">
        <div class="brand"><span class="mark">CA</span><span>CACSMS Autonomous<br/>Media Studio<small>Autonomous production console</small></span></div>
        <div class="sidebar-kicker"><span>Studio Map</span><span class="live-dot">Live</span></div>
        <div class="sidebar-tools">
          <label class="search"><span class="search-icon" aria-hidden="true"></span><input id="sidebarSearch" type="search" placeholder="Search studio modules" aria-label="Search studio modules" /></label>
          <div class="quick-actions"><a class="primary" href="#">+ Create</a><a href="/api/health">Health</a></div>
        </div>
        <div class="status-strip">
          <div class="status-chip"><strong>20</strong><span>Types</span></div>
          <div class="status-chip"><strong>22</strong><span>Modules</span></div>
          <div class="status-chip"><strong>10</strong><span>Stages</span></div>
        </div>
      </div>
      <div class="nav-label"><span>Navigation</span><span>${modules.length} modules</span></div>
      <nav>${modules.map(renderModuleNav).join("")}</nav>
      <div class="nav-empty" id="navEmpty">No matching studio module found.</div>
      <div class="sidebar-footer">IIS 3008 to Node 3018. CACSMS Studio fallback runtime.</div>
    </aside>
    <main>
      <section class="top">
        <div>
          <span class="badge">IIS public port 3008 • Node internal port 3018</span>
          <h1>Autonomous media production from first idea to publishable package.</h1>
          <p>CACSMS Studio converts topics, documents, lessons, stories, and instructions into scripts, scenes, visuals, audio, timelines, QA, exports, CapCut packages, and publishing workflows.</p>
        </div>
      </section>
      <section class="grid cols3">
        <article class="card"><div class="metric">20</div><h2>Production Types</h2><p>Configuration-driven formats.</p></article>
        <article class="card"><div class="metric">22</div><h2>Studio Modules</h2><p>Executive and operational workspaces.</p></article>
        <article class="card"><div class="metric">10</div><h2>Pipeline Stages</h2><p>Idea to direct publishing.</p></article>
      </section>
      <section class="grid cols2" style="margin-top:16px">
        <article class="card"><h2>Production Pipeline</h2><div class="grid">${pipeline.map((item, index) => `<div class="stage"><span class="num">${index + 1}</span><strong>${escapeHtml(item)}</strong></div>`).join("")}</div></article>
        <article class="card"><h2>Supported Production Types</h2><div class="pills">${productionTypes.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div></article>
      </section>
    </main>
  </div>
  <script>
    (function () {
      var search = document.getElementById("sidebarSearch");
      var modules = Array.prototype.slice.call(document.querySelectorAll(".nav-module"));
      var empty = document.getElementById("navEmpty");

      modules.forEach(function (module) {
        module.addEventListener("toggle", function () {
          if (!module.open || search.value.trim()) return;
          modules.forEach(function (other) {
            if (other !== module) other.open = false;
          });
        });
      });

      search.addEventListener("input", function () {
        var query = search.value.trim().toLowerCase();
        var visibleCount = 0;

        modules.forEach(function (module) {
          var matches = !query || module.dataset.label.indexOf(query) !== -1;
          module.hidden = !matches;
          module.open = query ? matches : module.querySelector(".is-active") !== null && module.querySelector("summary span").textContent === "Home";
          if (matches) visibleCount += 1;
        });

        empty.style.display = visibleCount ? "none" : "block";
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderModuleNav(module) {
  const isDefaultOpen = module.label === "Home";

  return `<details class="nav-module" data-label="${escapeHtml(`${module.label} ${module.children.join(" ")}`).toLowerCase()}" ${isDefaultOpen ? "open" : ""}>
    <summary><span class="nav-icon">${escapeHtml(iconCode(module.label))}</span><span class="nav-title">${escapeHtml(module.label)}</span><span class="count">${module.children.length}</span></summary>
    <div class="children">${module.children
      .map((child) => `<a class="${child === "Create Production" || child === "Executive Dashboard" ? "is-active" : ""}" href="#">${escapeHtml(child)}</a>`)
      .join("")}</div>
  </details>`;
}

function iconCode(label) {
  const codes = {
    "Home": "HM",
    "Production Studio": "PR",
    "Content Intelligence": "CI",
    "Writing Studio": "WR",
    "Story & Learning Design": "SL",
    "Storyboard Studio": "SB",
    "Visual Studio": "VS",
    "Video Studio": "VD",
    "Audio Studio": "AU",
    "Timeline Studio": "TL",
    "Quality & Compliance": "QC",
    "Export Center": "EX",
    "Publishing Center": "PB",
    "Asset Library": "AL",
    "Templates": "TP",
    "AI Agents": "AI",
    "Automation Hub": "AH",
    "Analytics": "AN",
    "Collaboration": "CO",
    "Integrations": "IN",
    "Administration": "AD",
    "Settings": "ST"
  };

  return codes[label] || label.slice(0, 2).toUpperCase();
}
