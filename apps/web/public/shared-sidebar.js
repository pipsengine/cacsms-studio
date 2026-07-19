(function () {
  const studioMap = document.getElementById("studioMap");
  if (!studioMap) return;

  const modules = [
  [
    "H",
    "Home",
    [
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
    ]
  ],
  [
    "PS",
    "Production Studio",
    [
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
    ]
  ],
  [
    "CI",
    "Content Intelligence",
    [
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
    ]
  ],
  [
    "OI",
    "Opportunity Intelligence",
    [
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
    ]
  ],
  [
    "KU",
    "Knowledge Universe",
    [
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
    ]
  ],
  [
    "WS",
    "Writing Studio",
    [
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
      "Versions",
      "Reviews",
      "Approvals",
      "Script Export"
    ]
  ],
  [
    "S&",
    "Story & Learning Design",
    [
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
    ]
  ],
  [
    "SS",
    "Storyboard Studio",
    [
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
      "Storyboard Editor",
      "Scene Sequencer",
      "Preview",
      "Versions",
      "Approval"
    ]
  ],
  [
    "VS",
    "Visual Studio",
    [
      "Visual Dashboard",
      "Image Generator",
      "Character Studio",
      "Character Consistency",
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
      "Brand Style Manager",
      "Prompt Library",
      "Batch Generation",
      "Visual QA",
      "Export"
    ]
  ],
  [
    "VS",
    "Video Studio",
    [
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
      "Scene Editor",
      "Preview",
      "Render Queue",
      "Video QA",
      "Export"
    ]
  ],
  [
    "AS",
    "Audio Studio",
    [
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
    ]
  ],
  [
    "TS",
    "Timeline Studio",
    [
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
    ]
  ],
  [
    "Q&",
    "Quality & Compliance",
    [
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
    ]
  ],
  [
    "EC",
    "Export Center",
    [
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
    ]
  ],
  [
    "PC",
    "Publishing Center",
    [
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
    ]
  ],
  [
    "AL",
    "Asset Library",
    [
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
    ]
  ],
  [
    "T",
    "Templates",
    [
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
    ]
  ],
  [
    "AA",
    "AI Agents",
    [
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
    ]
  ],
  [
    "AH",
    "Automation Hub",
    [
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
    ]
  ],
  [
    "A",
    "Analytics",
    [
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
    ]
  ],
  [
    "C",
    "Collaboration",
    [
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
    ]
  ],
  [
    "I",
    "Integrations",
    [
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
    ]
  ],
  [
    "A",
    "Administration",
    [
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
    ]
  ],
  [
    "S",
    "Settings",
    [
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
    ]
  ]
];

  if (studioMap.dataset.variant === "pipeline") {
    renderPipelineSidebar();
    return;
  }

  const tools = document.createElement("div");
  tools.className = "sidebar-tools";
  tools.innerHTML = `
    <label class="sidebar-search">
      <span aria-hidden="true">Search</span>
      <input type="search" aria-label="Search studio navigation" placeholder="Search modules and workspaces" />
    </label>
  `;
  studioMap.before(tools);

  const searchInput = tools.querySelector("input");

  studioMap.innerHTML = modules.map(([heading, groupModules]) => `
    <nav class="studio-nav-section">
      <p class="nav-heading">${heading}</p>
      ${groupModules.map(([icon, label, children]) => `
        <details class="studio-nav-group" data-label="${searchText(label, children)}" ${shouldOpen(label, children) ? "open" : ""}>
          <summary class="studio-nav-link ${activeParent(label)}">
            <span class="studio-icon">${icon}</span>
            <span class="studio-label">${label}</span>
            <b>${children.length}</b>
          </summary>
          <div class="studio-subnav">
            ${children.map(child => `<a href="${hrefForChild(label, child)}" class="${activeChild(label, child)}">${child}</a>`).join("")}
          </div>
        </details>
      `).join("")}
    </nav>
  `).join("");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    studioMap.querySelectorAll(".studio-nav-group").forEach(group => {
      const matches = group.dataset.label.includes(query);
      group.hidden = Boolean(query) && !matches;
      if (query && matches) group.open = true;
    });

    studioMap.querySelectorAll(".studio-nav-section").forEach(section => {
      const hasVisibleItems = Array.from(section.querySelectorAll(".studio-nav-group")).some(group => !group.hidden);
      section.hidden = !hasVisibleItems;
    });
  });

  studioMap.querySelectorAll(".studio-nav-group").forEach(group => {
    group.addEventListener("toggle", () => {
      if (searchInput.value.trim()) return;
      if (!group.open) return;
      studioMap.querySelectorAll(".studio-nav-group").forEach(other => {
        if (other !== group) other.open = false;
      });
    });
  });

  function hrefForChild(parent, child) {
    if (parent === "Home" && child === "Executive Dashboard") return "/dashboard";
    if (parent === "Production Pipeline") return "/home/production-pipeline";
    if (child === "Production Pipeline") return "/home/production-pipeline";
    if (child === "Production Workflow") return "/production-workflow/discover";
    if (parent === "Opportunity Intelligence" && child === "Opportunity Dashboard") return "/opportunity-intelligence";
    if (parent === "Opportunity Intelligence" && child === "Executive Recommendations") return "/opportunity-intelligence/executive-recommendations";
    if (parent === "Opportunity Intelligence" && child === "Opportunity Portfolio") return "/opportunity-intelligence/opportunity-portfolio";
    if (parent === "Opportunity Intelligence" && child === "Life Explorer Engine") return "/opportunity-intelligence/life-explorer-engine";
    if (parent === "Knowledge Universe" && child === "Executive Dashboard") return "/knowledge-universe";
    if (parent === "Knowledge Universe" && child === "Knowledge Graph") return "/knowledge-universe/knowledge-graph";
    if (parent === "Knowledge Universe" && child === "Knowledge Repository") return "/knowledge-universe/knowledge-repository";
    if (parent === "Knowledge Universe" && child === "World Model") return "/knowledge-universe/world-model";
    if (parent === "Knowledge Universe" && child === "Prediction Engine") return "/knowledge-universe/prediction-engine";
    if (parent === "Knowledge Universe" && child === "Knowledge Quality") return "/knowledge-universe/knowledge-quality";
    if (parent === "Knowledge Universe" && child === "Knowledge Governance") return "/knowledge-universe/knowledge-governance";
    return "#";
  }

  function activeChild(parent, child) {
    const path = window.location.pathname;
    if (parent === "Production Pipeline" && (path === "/" || path.startsWith("/production-pipeline") || path === "/home/production-pipeline") && child === "Production Life Cycle") return "sub-active";
    if ((path === "/" || path.startsWith("/production-pipeline") || path === "/home/production-pipeline") && child === "Production Pipeline") return "sub-active";
    if (path.startsWith("/production-workflow") && child === "Production Workflow") return "sub-active";
    if (parent === "Opportunity Intelligence" && path === "/opportunity-intelligence" && child === "Opportunity Dashboard") return "sub-active";
    if (parent === "Knowledge Universe" && path === "/knowledge-universe" && child === "Executive Dashboard") return "sub-active";
    return "";
  }

  function activeParent(label) {
    const path = window.location.pathname;
    if ((path === "/" || path.startsWith("/production-pipeline") || path === "/home/production-pipeline" || path.startsWith("/production-workflow")) && label === "Home") return "active";
    if (path.startsWith("/opportunity-intelligence") && label === "Opportunity Intelligence") return "active";
    if (path.startsWith("/knowledge-universe") && label === "Knowledge Universe") return "active";
    return "";
  }

  function shouldOpen(label, children) {
    return activeParent(label) === "active" || children.some(child => activeChild(label, child));
  }

  function searchText(label, children) {
    return `${label} ${children.join(" ")}`.toLowerCase();
  }

  function renderPipelineSidebar() {
    const iconNames = {
      Home: "home",
      "Production Studio": "layers-3",
      "Content Intelligence": "search",
      "Opportunity Intelligence": "target",
      "Knowledge Universe": "globe-2",
      "Production Pipeline": "workflow",
      "Writing Studio": "file-text",
      "Story & Learning Design": "book-open",
      "Storyboard Studio": "grid-2x2",
      "Visual Studio": "image",
      "Video Studio": "video",
      "Audio Studio": "mic-2",
      "Timeline Studio": "film",
      "AI Agents": "bot",
      "Automation Hub": "cloud-cog",
      "Quality & Compliance": "shield-check",
      "Export Center": "upload-cloud",
      "Publishing Center": "megaphone",
      "Asset Library": "archive",
      Templates: "layout-template",
      Analytics: "line-chart",
      Collaboration: "users",
      Integrations: "network",
      Administration: "settings-2",
      Settings: "settings"
    };

    studioMap.innerHTML = modules.map(([heading, groupModules]) => {
      const visibleModules =
        heading === "STUDIO"
          ? [
              groupModules[0],
              ["PP", "Production Pipeline", ["Production Life Cycle", "Current Production", "Pipeline Overview", "Schedule", "AI Insights"]],
              ...groupModules.slice(1)
            ]
          : groupModules;

      return `
      <section class="nav-group">
        <div class="nav-label">${heading}</div>
        ${visibleModules.map(([fallbackIcon, label, children]) => `
          <details class="pipeline-nav-group" ${shouldOpenPipelineModule(label, children) ? "open" : ""}>
            <summary class="nav-item ${activePipelineParent(label)}" title="${label}">
              <i data-lucide="${iconNames[label] ?? "boxes"}"></i>
              <span>${label}</span>
              <span class="nav-badge">${badgeForModule(label, children, fallbackIcon)}</span>
              <i class="nav-chevron" data-lucide="chevron-right"></i>
            </summary>
            <div class="pipeline-subnav">
              ${children.map(child => `<a href="${hrefForChild(label, child)}" class="${activeChild(label, child)}">${child}</a>`).join("")}
            </div>
          </details>
        `).join("")}
      </section>
    `;
    }).join("");

    studioMap.querySelectorAll(".pipeline-nav-group").forEach(group => {
      group.addEventListener("toggle", () => {
        if (!group.open) return;
        studioMap.querySelectorAll(".pipeline-nav-group").forEach(other => {
          if (other !== group) other.open = false;
        });
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function hrefForModule(label) {
    if (label === "Home") return "/dashboard";
    if (label === "Production Pipeline") return "/home/production-pipeline";
    if (label === "Production Studio") return "/productions";
    if (label === "Content Intelligence") return "/intelligence";
    if (label === "Opportunity Intelligence") return "/opportunity-intelligence";
    if (label === "Knowledge Universe") return "/knowledge-universe";
    if (label === "Writing Studio") return "/writing";
    if (label === "Story & Learning Design") return "/story-learning";
    if (label === "Storyboard Studio") return "/storyboard";
    if (label === "Visual Studio") return "/visuals";
    if (label === "Video Studio") return "/video";
    if (label === "Audio Studio") return "/audio";
    if (label === "Timeline Studio") return "/timeline";
    if (label === "AI Agents") return "/agents";
    if (label === "Automation Hub") return "/automation";
    if (label === "Quality & Compliance") return "/quality";
    if (label === "Export Center") return "/exports";
    if (label === "Publishing Center") return "/publishing";
    if (label === "Asset Library") return "/assets/all-assets";
    if (label === "Templates") return "/templates";
    if (label === "Analytics") return "/analytics";
    if (label === "Collaboration") return "/collaboration";
    if (label === "Integrations") return "/integrations";
    if (label === "Administration") return "/administration";
    if (label === "Settings") return "/settings";
    return "#";
  }

  function activePipelineParent(label) {
    const path = window.location.pathname;
    if ((path === "/" || path.startsWith("/production-pipeline") || path === "/home/production-pipeline") && label === "Production Pipeline") return "active";
    if (path.startsWith("/production-workflow") && label === "Home") return "active";
    if (path.startsWith("/opportunity-intelligence") && label === "Opportunity Intelligence") return "active";
    if (path.startsWith("/knowledge-universe") && label === "Knowledge Universe") return "active";
    if (path === "/dashboard" && label === "Home") return "active";
    return "";
  }

  function badgeForModule(label, children, fallbackIcon) {
    if (label === "Knowledge Universe") return "1.8M";
    if (label === "Opportunity Intelligence") return "28";
    if (label === "Home") return "12";
    return children.length || fallbackIcon;
  }

  function shouldOpenPipelineModule(label, children) {
    return activePipelineParent(label) === "active" || children.some(child => activeChild(label, child));
  }
})();
