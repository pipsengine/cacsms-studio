(function () {
  const studioMap = document.getElementById("studioMap");
  if (!studioMap) return;

  const modules = [
    ["STUDIO", [
      ["HM", "Home", ["Executive Dashboard", "My Workspace", "Active Productions", "Recent Productions", "Production Workflow", "Production Pipeline", "Rendering Monitor", "Agent Activity", "Publishing Overview", "Calendar", "Notifications", "System Health"]],
      ["PR", "Production Studio", ["Create Production", "All Productions", "Documentaries", "Stories", "Teaching Content", "Courses", "Explainers", "Tutorials", "Corporate Content", "Marketing Content", "Podcasts", "Social Content", "Custom Productions", "Production Pipeline", "Production Queue", "Drafts", "Completed Productions", "Archived Productions", "Production Calendar"]],
      ["CI", "Content Intelligence", ["Topic Discovery", "Research Workspace", "Source Analysis", "Fact Verification", "Knowledge Extraction", "Citation Manager", "Trend Intelligence", "Audience Research", "Competitor Intelligence", "Content Gap Analysis", "Curriculum Research", "Source Library", "Knowledge Base", "Intelligence Reports"]],
      ["WR", "Writing Studio", ["Writing Dashboard", "Script Generator", "Script Editor", "Narration Writer", "Story Writer", "Lesson Writer", "Course Writer", "Explainer Writer", "Tutorial Writer", "Dialogue Writer", "Interview Builder", "Podcast Writer", "Social Script Writer", "Title and Hook Generator", "Call-to-Action Builder", "Versions", "Reviews", "Approvals", "Script Export"]],
      ["SL", "Story & Learning Design", ["Structure Dashboard", "Narrative Designer", "Character Designer", "World Builder", "Plot and Conflict Builder", "Episode Planner", "Learning Objective Builder", "Curriculum Designer", "Lesson Planner", "Teaching Sequence", "Knowledge Checks", "Quiz Builder", "Assessment Builder", "Examples and Case Studies", "Engagement Planner", "Age and Difficulty Adaptation", "Structure Approval"]],
      ["SB", "Storyboard Studio", ["Storyboard Dashboard", "Auto Storyboard", "Scene Planner", "Shot Planner", "Teaching Visual Planner", "Demonstration Planner", "Camera Planner", "Motion Planner", "Transition Planner", "Text and Graphics Planner", "Storyboard Editor", "Scene Sequencer", "Preview", "Versions", "Approval"]],
      ["VS", "Visual Studio", ["Visual Dashboard", "Image Generator", "Character Studio", "Character Consistency", "Environment Studio", "Object and Prop Studio", "Historical Reconstruction", "Illustration Studio", "Educational Diagram Studio", "Infographic Studio", "Chart and Data Visuals", "Map Studio", "Presentation Graphics", "Product Visuals", "Thumbnail Studio", "Brand Style Manager", "Prompt Library", "Batch Generation", "Visual QA", "Export"]],
      ["VD", "Video Studio", ["Video Dashboard", "Scene Video Generator", "Image-to-Video", "Text-to-Video", "Character Animation", "Presenter Generator", "Whiteboard Animation", "Slide-to-Video", "Screen Recording Processor", "Demonstration Composer", "Cinematic Director", "Camera Motion", "Motion Graphics", "Visual Effects", "Colour Grading", "Scene Editor", "Preview", "Render Queue", "Video QA", "Export"]],
      ["AU", "Audio Studio", ["Audio Dashboard", "Narration Generator", "Voice Library", "Voice Profiles", "Voice Cloning", "Pronunciation Manager", "Emotion and Delivery", "Dialogue Generator", "Multi-Speaker Audio", "Music Generator", "Music Library", "Sound Effects", "Ambient Sound", "Podcast Audio", "Audio Cleanup", "Audio Mixing", "Loudness Normalization", "Audio QA", "Export"]],
      ["TL", "Timeline Studio", ["Master Timeline", "Scene Timeline", "Video Track", "Narration Track", "Dialogue Track", "Music Track", "Sound-Effects Track", "Subtitle Track", "Graphics Track", "Auto Assemble", "Synchronization", "Transition Manager", "Timeline Preview", "Timeline Versions", "Render Preview", "Timeline Export"]]
    ]],
    ["AI & AUTOMATION", [
      ["AI", "AI Agents", ["Agent Dashboard", "Content Strategist", "Research Agent", "Fact Checker", "Scriptwriter", "Story Architect", "Curriculum Designer", "Teaching Agent", "Storyboard Director", "Visual Director", "Character Director", "Video Director", "Animation Director", "Narration Director", "Music Composer", "Sound Designer", "Timeline Editor", "Quality Reviewer", "Compliance Agent", "Export Agent", "Publishing Agent", "Agent Teams", "Agent Simulation Studio", "Workflows", "Prompts", "Tools", "Models", "Knowledge", "Memory", "Logs", "Costs", "Performance"]],
      ["AH", "Automation Hub", ["Automation Dashboard", "Workflow Builder", "Production Workflows", "Content-Type Workflows", "Event Triggers", "Scheduled Productions", "Batch Productions", "Approval Rules", "Conditional Routing", "Background Jobs", "Worker Monitor", "Queue Monitor", "Retry Manager", "Failure Recovery", "Notifications", "Webhooks", "Automation Logs"]]
    ]],
    ["ANALYTICS & MANAGEMENT", [
      ["QC", "Quality & Compliance", ["Quality Dashboard", "Content QA", "Script QA", "Story QA", "Teaching QA", "Fact Verification", "Visual QA", "Video QA", "Audio QA", "Subtitle QA", "Continuity Check", "Character Consistency", "Learning Objective Check", "Accessibility Check", "Copyright Review", "Brand Compliance", "Platform Compliance", "AI Safety Review", "Human Review", "Final Approval"]],
      ["EX", "Export Center", ["Export Dashboard", "Final Video Export", "Editable Scene Package", "CapCut Package", "Audio Package", "Subtitle Package", "Storyboard Package", "Script Package", "Course Package", "Presentation Package", "Social Media Package", "Publishing Package", "Export History", "Download Center"]],
      ["PB", "Publishing Center", ["Publishing Dashboard", "Channels", "YouTube", "Facebook", "TikTok", "Instagram", "LinkedIn", "X", "Website", "Learning Platforms", "Podcast Platforms", "Scheduler", "SEO and Metadata", "Thumbnail Optimizer", "Publishing Queue", "Publication History", "Comments and Engagement", "Publishing Reports"]],
      ["AL", "Asset Library", ["All Assets", "Images", "Video Clips", "Audio", "Narrations", "Music", "Sound Effects", "Scripts", "Storyboards", "Characters", "Environments", "Diagrams", "Charts", "Maps", "Thumbnails", "Templates", "Brand Assets", "Licensed Assets", "Generated Assets", "Favourites", "Recycle Bin", "Archive"]],
      ["TP", "Templates", ["Template Dashboard", "Documentary Templates", "Story Templates", "Teaching Templates", "Course Templates", "Explainer Templates", "Tutorial Templates", "Corporate Templates", "Marketing Templates", "Podcast Templates", "Social Media Templates", "Timeline Templates", "Visual Style Templates", "Audio Templates", "Export Templates", "Custom Templates"]],
      ["AN", "Analytics", ["Executive Analytics", "Production Analytics", "Content Analytics", "Audience Analytics", "Learning Analytics", "Engagement Analytics", "Publishing Analytics", "Revenue Analytics", "Agent Performance", "Model Usage", "Rendering Analytics", "Cost Analytics", "Quality Analytics", "Export Analytics", "Custom Reports"]],
      ["CO", "Collaboration", ["Teams", "Workspaces", "Assignments", "Tasks", "Comments", "Reviews", "Approvals", "Shared Assets", "Production Notes", "Mentions", "Notifications", "Activity Feed", "Audit History"]],
      ["IN", "Integrations", ["Integration Dashboard", "AI Models", "Research Providers", "Image Providers", "Video Providers", "Voice Providers", "Music Providers", "Storage Providers", "CapCut Export", "YouTube", "Facebook", "TikTok", "Instagram", "LinkedIn", "X", "Learning Platforms", "Podcast Platforms", "Google Drive", "OneDrive", "Dropbox", "Webhooks", "API Management"]]
    ]],
    ["ADMINISTRATION", [
      ["AD", "Administration", ["Organization", "Workspaces", "Users", "Roles", "Permissions", "Departments", "Content Policies", "AI Governance", "Usage Limits", "Model Access", "Cost Controls", "Billing", "Licences", "Security", "Audit Logs", "Data Retention", "Backup and Recovery", "System Operations"]],
      ["ST", "Settings", ["General", "Branding", "Content Defaults", "Production Defaults", "AI Configuration", "Model Routing", "Research Settings", "Script Settings", "Visual Settings", "Video Settings", "Audio Settings", "Subtitle Settings", "Render Settings", "Export Settings", "Publishing Settings", "Notification Settings", "Storage", "API Keys", "Environment", "Advanced"]]
    ]]
  ];

  studioMap.innerHTML = modules.map(([heading, groupModules]) => `
    <nav class="studio-nav-section">
      <p class="nav-heading">${heading}</p>
      ${groupModules.map(([icon, label, children]) => `
        <details class="studio-nav-group" ${label === "Home" ? "open" : ""}>
          <summary class="studio-nav-link ${activeParent(label)}">
            <span class="studio-icon">${icon}</span>
            <span class="studio-label">${label}</span>
            <b>${children.length}</b>
          </summary>
          <div class="studio-subnav">
            ${children.map(child => `<a href="${hrefForChild(child)}" class="${activeChild(child)}">${child}</a>`).join("")}
          </div>
        </details>
      `).join("")}
    </nav>
  `).join("");

  studioMap.querySelectorAll(".studio-nav-group").forEach(group => {
    group.addEventListener("toggle", () => {
      if (!group.open) return;
      studioMap.querySelectorAll(".studio-nav-group").forEach(other => {
        if (other !== group) other.open = false;
      });
    });
  });

  function hrefForChild(child) {
    if (child === "Production Pipeline") return "/";
    if (child === "Production Workflow") return "/production-workflow";
    return "#";
  }

  function activeChild(child) {
    const path = window.location.pathname;
    if ((path === "/" || path === "/production-pipeline") && child === "Production Pipeline") return "sub-active";
    if (path.startsWith("/production-workflow") && child === "Production Workflow") return "sub-active";
    return "";
  }

  function activeParent(label) {
    if (label === "Home") return "active";
    return "";
  }
})();
