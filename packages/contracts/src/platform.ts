import type { NavigationModule, WorkflowStage } from "./types";

export const productionPipeline: Array<{ id: WorkflowStage; label: string; description: string }> = [
  {
    id: "discover",
    label: "Discover",
    description: "Scan audience, market, and knowledge signals for production opportunities."
  },
  {
    id: "research",
    label: "Research",
    description: "Research, corroborate, and verify the opportunity and its supporting evidence."
  },
  {
    id: "evaluate",
    label: "Evaluate",
    description: "Score, validate, and prioritize the production opportunity."
  },
  {
    id: "pre-plan",
    label: "Pre-Plan",
    description: "Define format, audience, channels, structure, and production requirements."
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Plan the timeline, assignments, dependencies, and publication dates."
  },
  {
    id: "produce",
    label: "Produce",
    description: "Create the script, visual, video, voice, music, and sound assets."
  },
  {
    id: "assemble",
    label: "Assemble",
    description: "Build the timeline and integrate all production assets."
  },
  {
    id: "quality",
    label: "Quality",
    description: "Run AI and human quality, compliance, and safety reviews."
  },
  {
    id: "export",
    label: "Export",
    description: "Render and package the approved production deliverables."
  },
  {
    id: "publish",
    label: "Publish",
    description: "Distribute approved outputs to configured publishing channels."
  },
  {
    id: "monitor",
    label: "Monitor",
    description: "Track audience and production performance in real time."
  },
  {
    id: "learn",
    label: "Learn",
    description: "Use verified outcomes to improve the autonomous production system."
  },
  {
    id: "repeat",
    label: "Repeat",
    description: "Feed learning back into continuous opportunity discovery."
  }
];

export const navigationModules: NavigationModule[] = [
  {
    label: "Home",
    slug: "dashboard",
    description: "Executive command center for workspace status, production health, rendering, agents, and publishing.",
    children: [
      "Executive Dashboard",
      "My Workspace",
      "Active Productions",
      "Recent Productions",
      "Production Workflow",
      "Production Pipeline",
      "Rendering Monitor",
      "Agent Activity",
      "Publishing Overview",
      "Calendar",
      "Notifications",
      "System Health"
    ].map(toChild)
  },
  {
    label: "Production Studio",
    slug: "productions",
    description: "Create, organize, queue, review, complete, archive, and schedule all production types.",
    children: [
      "Create Production",
      "All Productions",
      "Documentaries",
      "Stories",
      "Teaching Content",
      "Courses",
      "Explainers",
      "Tutorials",
      "Corporate Content",
      "Marketing Content",
      "Podcasts",
      "Social Content",
      "Custom Productions",
      "Production Pipeline",
      "Production Queue",
      "Drafts",
      "Completed Productions",
      "Archived Productions",
      "Production Calendar"
    ].map(toChild)
  },
  {
    label: "Content Intelligence",
    slug: "intelligence",
    description: "Generic research, source analysis, verification, knowledge extraction, citations, trends, and gaps.",
    children: [
      "Topic Discovery",
      "Research Workspace",
      "Source Analysis",
      "Fact Verification",
      "Knowledge Extraction",
      "Citation Manager",
      "Trend Intelligence",
      "Audience Research",
      "Competitor Intelligence",
      "Content Gap Analysis",
      "Curriculum Research",
      "Source Library",
      "Knowledge Base",
      "Intelligence Reports"
    ].map(toChild)
  },
  {
    label: "Opportunity Intelligence",
    slug: "opportunity-intelligence",
    description:
      "Autonomous executive producer engine for discovering, scoring, prioritizing, planning, scheduling, and learning from production opportunities.",
    children: [
      "Opportunity Dashboard",
      "Discovery Engine",
      "Global Intelligence",
      "Human Interest Intelligence",
      "Mystery Intelligence",
      "Curiosity Engine",
      "Emotional Opportunity Engine",
      "Life Explorer Engine",
      "Trend Intelligence",
      "Gap Detection",
      "Scoring Engine",
      "Opportunity Portfolio",
      "Evergreen Knowledge Bank",
      "Campaign Builder",
      "Multi-Format Planner",
      "Opportunity Scheduler",
      "Editorial Board",
      "Autonomy Modes",
      "Learning Engine",
      "Executive Recommendations"
    ].map(toChild)
  },
  {
    label: "Knowledge Universe",
    slug: "knowledge-universe",
    description:
      "Permanent institutional memory, knowledge graph, semantic intelligence, reasoning engine, prediction layer, and world model for every studio decision.",
    children: [
      "Executive Dashboard",
      "Knowledge Graph",
      "Knowledge Repository",
      "Knowledge Collections",
      "Subject Domains",
      "Topic Library",
      "Entity Explorer",
      "Relationship Explorer",
      "Timeline Explorer",
      "Geographic Intelligence",
      "People Intelligence",
      "Organization Intelligence",
      "Industry Intelligence",
      "Technology Intelligence",
      "Historical Intelligence",
      "Scientific Intelligence",
      "Educational Intelligence",
      "Economic Intelligence",
      "Government Intelligence",
      "Cultural Intelligence",
      "AI Memory",
      "Semantic Search",
      "Reasoning Engine",
      "World Model",
      "Prediction Engine",
      "Knowledge Analytics",
      "Knowledge Quality",
      "Knowledge Governance",
      "Knowledge Settings"
    ].map(toChild)
  },
  {
    label: "Writing Studio",
    slug: "writing",
    description: "Script, narration, story, lesson, course, explainer, tutorial, dialogue, podcast, hook, and CTA writing.",
    children: [
      "Writing Dashboard",
      "Script Generator",
      "Script Editor",
      "Narration Writer",
      "Story Writer",
      "Lesson Writer",
      "Course Writer",
      "Explainer Writer",
      "Tutorial Writer",
      "Dialogue Writer",
      "Interview Builder",
      "Podcast Writer",
      "Social Script Writer",
      "Title and Hook Generator",
      "Call-to-Action Builder",
      "Script Intelligence",
      "Versions",
      "Reviews",
      "Approvals",
      "Script Export"
    ].map(toChild)
  },
  {
    label: "Story & Learning Design",
    slug: "story-learning",
    description: "Narrative, world, plot, curriculum, lesson, quiz, assessment, engagement, and difficulty design.",
    children: [
      "Structure Dashboard",
      "Narrative Designer",
      "Character Designer",
      "World Builder",
      "Plot and Conflict Builder",
      "Episode Planner",
      "Learning Objective Builder",
      "Curriculum Designer",
      "Lesson Planner",
      "Teaching Sequence",
      "Knowledge Checks",
      "Quiz Builder",
      "Assessment Builder",
      "Examples and Case Studies",
      "Engagement Planner",
      "Age and Difficulty Adaptation",
      "Structure Approval"
    ].map(toChild)
  },
  {
    label: "Storyboard Studio",
    slug: "storyboard",
    description: "Auto storyboard, scene, shot, teaching visual, demonstration, camera, motion, transition, and text planning.",
    children: [
      "Storyboard Dashboard",
      "Auto Storyboard",
      "Scene Planner",
      "Shot Planner",
      "Teaching Visual Planner",
      "Demonstration Planner",
      "Camera Planner",
      "Motion Planner",
      "Transition Planner",
      "Text and Graphics Planner",
      "Visual Requirement Resolver",
      "Asset Requirement Matrix",
      "Storyboard Editor",
      "Scene Sequencer",
      "Preview",
      "Versions",
      "Approval"
    ].map(toChild)
  },
  {
    label: "Visual Studio",
    slug: "visuals",
    description: "Image, character, environment, prop, historical, illustration, diagram, infographic, chart, map, and brand visuals.",
    children: [
      "Visual Dashboard",
      "Autonomous Image Generator",
      "Generation Queue",
      "Visual Brief Resolver",
      "Prompt Intelligence",
      "Character Studio",
      "Character Consistency",
      "Regional Visual Intelligence",
      "Environment Studio",
      "Object and Prop Studio",
      "Historical Reconstruction",
      "Illustration Studio",
      "Educational Diagram Studio",
      "Infographic Studio",
      "Chart and Data Visuals",
      "Map Studio",
      "Presentation Graphics",
      "Product Visuals",
      "Thumbnail Studio",
      "Model & Workflow Manager",
      "Reference Conditioning",
      "Image Repair & Enhancement",
      "Brand Style Manager",
      "Prompt Library",
      "Batch Generation",
      "Visual QA",
      "Rights & Provenance",
      "Export"
    ].map(toChild)
  },
  {
    label: "Video Studio",
    slug: "video",
    description: "Scene generation, image-to-video, text-to-video, characters, presenters, whiteboard, screen, camera, effects, grading, and rendering.",
    children: [
      "Video Dashboard",
      "Scene Video Generator",
      "Image-to-Video",
      "Text-to-Video",
      "Character Animation",
      "Presenter Generator",
      "Whiteboard Animation",
      "Slide-to-Video",
      "Screen Recording Processor",
      "Demonstration Composer",
      "Cinematic Director",
      "Camera Motion",
      "Motion Graphics",
      "Visual Effects",
      "Colour Grading",
      "Motion Consistency",
      "Video Repair & Enhancement",
      "Scene Editor",
      "Preview",
      "Render Queue",
      "Video QA",
      "Export"
    ].map(toChild)
  },
  {
    label: "Audio Studio",
    slug: "audio",
    description: "Narration, voices, cloning, pronunciation, delivery, dialogue, music, effects, ambience, cleanup, mixing, and loudness.",
    children: [
      "Audio Dashboard",
      "Narration Generator",
      "Voice Library",
      "Voice Profiles",
      "Voice Cloning",
      "Pronunciation Manager",
      "Emotion and Delivery",
      "Dialogue Generator",
      "Multi-Speaker Audio",
      "Music Generator",
      "Music Library",
      "Sound Effects",
      "Ambient Sound",
      "Podcast Audio",
      "Audio Cleanup",
      "Audio Mixing",
      "Loudness Normalization",
      "Audio QA",
      "Export"
    ].map(toChild)
  },
  {
    label: "Timeline Studio",
    slug: "timeline",
    description: "Master and scene timelines with video, narration, dialogue, music, sound effects, subtitles, graphics, sync, and exports.",
    children: [
      "Master Timeline",
      "Scene Timeline",
      "Video Track",
      "Narration Track",
      "Dialogue Track",
      "Music Track",
      "Sound-Effects Track",
      "Subtitle Track",
      "Graphics Track",
      "Auto Assemble",
      "Synchronization",
      "Transition Manager",
      "Timeline Preview",
      "Timeline Versions",
      "Render Preview",
      "Timeline Export"
    ].map(toChild)
  },
  {
    label: "Quality & Compliance",
    slug: "quality",
    description: "Content, script, story, teaching, fact, visual, video, audio, subtitle, continuity, accessibility, copyright, brand, platform, safety, and human review.",
    children: [
      "Quality Dashboard",
      "Content QA",
      "Script QA",
      "Story QA",
      "Teaching QA",
      "Fact Verification",
      "Visual QA",
      "Video QA",
      "Audio QA",
      "Subtitle QA",
      "Continuity Check",
      "Character Consistency",
      "Learning Objective Check",
      "Accessibility Check",
      "Copyright Review",
      "Brand Compliance",
      "Platform Compliance",
      "AI Safety Review",
      "Human Review",
      "Final Approval"
    ].map(toChild)
  },
  {
    label: "Export Center",
    slug: "exports",
    description: "Final video, editable scenes, CapCut, audio, subtitles, storyboard, script, course, presentation, social, publishing, history, and downloads.",
    children: [
      "Export Dashboard",
      "Final Video Export",
      "Editable Scene Package",
      "CapCut Package",
      "Audio Package",
      "Subtitle Package",
      "Storyboard Package",
      "Script Package",
      "Course Package",
      "Presentation Package",
      "Social Media Package",
      "Publishing Package",
      "Export History",
      "Download Center"
    ].map(toChild)
  },
  {
    label: "Publishing Center",
    slug: "publishing",
    description: "Channel publishing, scheduling, SEO, thumbnails, queues, history, comments, engagement, and reporting.",
    children: [
      "Publishing Dashboard",
      "Channels",
      "YouTube",
      "Facebook",
      "TikTok",
      "Instagram",
      "LinkedIn",
      "X",
      "Website",
      "Learning Platforms",
      "Podcast Platforms",
      "Scheduler",
      "SEO and Metadata",
      "Thumbnail Optimizer",
      "Publishing Queue",
      "Publication History",
      "Comments and Engagement",
      "Publishing Reports"
    ].map(toChild)
  },
  {
    label: "Asset Library",
    slug: "assets",
    description: "Images, video clips, audio, scripts, storyboards, characters, environments, diagrams, charts, maps, thumbnails, templates, brand and licensed assets.",
    children: [
      "All Assets",
      "Images",
      "Video Clips",
      "Audio",
      "Narrations",
      "Music",
      "Sound Effects",
      "Scripts",
      "Storyboards",
      "Characters",
      "Environments",
      "Diagrams",
      "Charts",
      "Maps",
      "Thumbnails",
      "Templates",
      "Brand Assets",
      "Licensed Assets",
      "Generated Assets",
      "Favourites",
      "Recycle Bin",
      "Archive"
    ].map(toChild)
  },
  {
    label: "Templates",
    slug: "templates",
    description: "Documentary, story, teaching, course, explainer, tutorial, corporate, marketing, podcast, social, timeline, style, audio, export, and custom templates.",
    children: [
      "Template Dashboard",
      "Documentary Templates",
      "Story Templates",
      "Teaching Templates",
      "Course Templates",
      "Explainer Templates",
      "Tutorial Templates",
      "Corporate Templates",
      "Marketing Templates",
      "Podcast Templates",
      "Social Media Templates",
      "Timeline Templates",
      "Visual Style Templates",
      "Audio Templates",
      "Export Templates",
      "Custom Templates"
    ].map(toChild)
  },
  {
    label: "AI Agents",
    slug: "agents",
    description: "Agent dashboard, strategists, researchers, writers, directors, reviewers, exporters, publishers, teams, workflows, prompts, tools, models, knowledge, memory, logs, costs, and performance.",
    children: [
      "Agent Dashboard",
      "Content Strategist",
      "Research Agent",
      "Fact Checker",
      "Scriptwriter",
      "Story Architect",
      "Curriculum Designer",
      "Teaching Agent",
      "Storyboard Director",
      "Visual Director",
      "Character Director",
      "Video Director",
      "Animation Director",
      "Narration Director",
      "Music Composer",
      "Sound Designer",
      "Timeline Editor",
      "Quality Reviewer",
      "Compliance Agent",
      "Export Agent",
      "Publishing Agent",
      "Agent Teams",
      "Agent Simulation Studio",
      "Workflows",
      "Prompts",
      "Tools",
      "Models",
      "Knowledge",
      "Memory",
      "Logs",
      "Costs",
      "Performance"
    ].map(toChild)
  },
  {
    label: "Automation Hub",
    slug: "automation",
    description: "Workflow builders, production workflows, content-type workflows, triggers, schedules, batches, approvals, routing, jobs, workers, queues, retries, recovery, notifications, webhooks, and logs.",
    children: [
      "Automation Dashboard",
      "Workflow Builder",
      "Production Workflows",
      "Content-Type Workflows",
      "Event Triggers",
      "Scheduled Productions",
      "Batch Productions",
      "Approval Rules",
      "Conditional Routing",
      "Background Jobs",
      "Worker Monitor",
      "Queue Monitor",
      "Retry Manager",
      "Failure Recovery",
      "Notifications",
      "Webhooks",
      "Automation Logs"
    ].map(toChild)
  },
  {
    label: "Analytics",
    slug: "analytics",
    description: "Executive, production, content, audience, learning, engagement, publishing, revenue, agent, model, rendering, cost, quality, export, and custom reports.",
    children: [
      "Executive Analytics",
      "Production Analytics",
      "Content Analytics",
      "Audience Analytics",
      "Learning Analytics",
      "Engagement Analytics",
      "Publishing Analytics",
      "Revenue Analytics",
      "Agent Performance",
      "Model Usage",
      "Rendering Analytics",
      "Cost Analytics",
      "Quality Analytics",
      "Export Analytics",
      "Custom Reports"
    ].map(toChild)
  },
  {
    label: "Collaboration",
    slug: "collaboration",
    description: "Teams, workspaces, assignments, tasks, comments, reviews, approvals, shared assets, notes, mentions, notifications, activity feed, and audit history.",
    children: [
      "Teams",
      "Workspaces",
      "Assignments",
      "Tasks",
      "Comments",
      "Reviews",
      "Approvals",
      "Shared Assets",
      "Production Notes",
      "Mentions",
      "Notifications",
      "Activity Feed",
      "Audit History"
    ].map(toChild)
  },
  {
    label: "Integrations",
    slug: "integrations",
    description: "Models, research, image, video, voice, music, storage, CapCut, social channels, learning platforms, podcasts, drives, webhooks, and APIs.",
    children: [
      "Integration Dashboard",
      "AI Models",
      "Research Providers",
      "Image Providers",
      "Video Providers",
      "Voice Providers",
      "Music Providers",
      "Storage Providers",
      "CapCut Export",
      "YouTube",
      "Facebook",
      "TikTok",
      "Instagram",
      "LinkedIn",
      "X",
      "Learning Platforms",
      "Podcast Platforms",
      "Google Drive",
      "OneDrive",
      "Dropbox",
      "Webhooks",
      "API Management"
    ].map(toChild)
  },
  {
    label: "Administration",
    slug: "administration",
    description: "Organization, workspaces, users, roles, permissions, departments, policies, governance, limits, model access, costs, billing, licences, security, audit, retention, backup, and operations.",
    children: [
      "Organization",
      "Workspaces",
      "Users",
      "Roles",
      "Permissions",
      "Departments",
      "Content Policies",
      "AI Governance",
      "Usage Limits",
      "Model Access",
      "Cost Controls",
      "Billing",
      "Licences",
      "Security",
      "Audit Logs",
      "Data Retention",
      "Backup and Recovery",
      "System Operations"
    ].map(toChild)
  },
  {
    label: "Settings",
    slug: "settings",
    description: "General, branding, content, production, AI, routing, research, script, visual, video, audio, subtitle, render, export, publishing, notification, storage, API keys, environment, and advanced settings.",
    children: [
      "General",
      "Branding",
      "Content Defaults",
      "Production Defaults",
      "AI Configuration",
      "Model Routing",
      "Research Settings",
      "Script Settings",
      "Visual Settings",
      "Video Settings",
      "Audio Settings",
      "Subtitle Settings",
      "Render Settings",
      "Export Settings",
      "Publishing Settings",
      "Notification Settings",
      "Storage",
      "API Keys",
      "Environment",
      "Advanced"
    ].map(toChild)
  }
];

export const exportModes = [
  "Ready-to-Publish MP4",
  "CapCut-Ready Scene Package",
  "Full Production Package",
  "Both Final and Editable Versions"
];

export function toSlug(label: string) {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toChild(label: string) {
  const overrides: Record<string, string> = {
    "Autonomous Image Generator": "image-generator"
  };
  return { label, slug: overrides[label] ?? toSlug(label) };
}
