import { exportModes, productionPipeline } from "./platform";
import type { ContentTypeDefinition, ProductionFormat } from "./types";

const allStages = productionPipeline.map((stage) => stage.id);

export const contentTypeDefinitions: ContentTypeDefinition[] = [
  define("documentary", "Documentaries", "Evidence-led factual video with context, sources, human impact, and conclusion.", [
    "Topic or source material",
    "Target audience",
    "Language",
    "Duration",
    "Tone",
    "Visual style"
  ], ["Content Strategist", "Research Agent", "Fact Checker", "Scriptwriter", "Storyboard Director", "Visual Director", "Narration Director", "Quality Reviewer", "Export Agent"], ["Hook", "Context", "Evidence", "Human Impact", "Conclusion"]),
  define("story", "Stories and Narratives", "Fictional or factual narrative built around character, world, conflict, escalation, and resolution.", [
    "Story idea",
    "Audience age",
    "Genre",
    "Language",
    "Duration",
    "Tone",
    "Visual style"
  ], ["Story Architect", "Scriptwriter", "Character Director", "Storyboard Director", "Visual Director", "Animation Director", "Sound Designer"], ["Setup", "Conflict", "Escalation", "Climax", "Resolution"], { factCheck: "optional" }),
  define("teaching", "Teaching and Educational Content", "Instructional production with objectives, explanation, examples, practice, and checks.", [
    "Topic",
    "Learning objectives",
    "Audience level",
    "Language",
    "Duration",
    "Teaching style"
  ], ["Curriculum Designer", "Teaching Agent", "Research Agent", "Scriptwriter", "Storyboard Director", "Visual Director", "Quality Reviewer"], ["Objectives", "Explanation", "Examples", "Practice", "Assessment"]),
  define("course", "Courses and Lessons", "Multi-lesson course packaging with curriculum design, lesson plans, activities, assessments, and exportable materials.", [
    "Course topic",
    "Learner profile",
    "Module count",
    "Language",
    "Duration per lesson",
    "Assessment approach"
  ], ["Curriculum Designer", "Teaching Agent", "Research Agent", "Scriptwriter", "Visual Director", "Quality Reviewer", "Export Agent"], ["Course Promise", "Modules", "Lessons", "Practice", "Assessment", "Next Steps"]),
  define("explainer", "Explainer Videos", "Clear explanation of an idea, product, process, issue, or concept using concise structure and visuals.", [
    "Concept",
    "Audience",
    "Language",
    "Duration",
    "Complexity level",
    "Visual style"
  ], ["Content Strategist", "Research Agent", "Scriptwriter", "Storyboard Director", "Visual Director", "Narration Director"], ["Hook", "Problem", "Core Idea", "Examples", "Payoff"]),
  define("tutorial", "Tutorials and Demonstrations", "Step-by-step instructional workflow with requirements, demonstration, verification, and troubleshooting.", [
    "Task or skill",
    "Prerequisites",
    "Audience level",
    "Language",
    "Duration",
    "Demo assets"
  ], ["Teaching Agent", "Scriptwriter", "Storyboard Director", "Video Director", "Timeline Editor", "Quality Reviewer"], ["Problem", "Requirements", "Steps", "Demonstration", "Verification"]),
  define("news", "News and Current-Affairs Analysis", "Timely analysis with mandatory verification, citations, balanced context, and platform compliance.", [
    "News topic",
    "Sources",
    "Region",
    "Audience",
    "Language",
    "Duration"
  ], ["Research Agent", "Fact Checker", "Content Strategist", "Scriptwriter", "Compliance Agent", "Publishing Agent"], ["Lead", "Background", "Verified Facts", "Analysis", "Implications"]),
  define("corporate", "Business and Corporate Videos", "Internal or external business communication with brand compliance and clear stakeholder outcomes.", [
    "Business objective",
    "Audience",
    "Brand guidelines",
    "Language",
    "Duration",
    "CTA"
  ], ["Content Strategist", "Scriptwriter", "Visual Director", "Brand Compliance", "Quality Reviewer", "Publishing Agent"], ["Objective", "Context", "Message", "Proof", "Action"]),
  define("product", "Product and Service Videos", "Product or service presentation with problem, value, proof, demo, and action.", [
    "Product or service",
    "Audience",
    "Problem solved",
    "Benefits",
    "Language",
    "CTA"
  ], ["Content Strategist", "Scriptwriter", "Visual Director", "Video Director", "Quality Reviewer", "Publishing Agent"], ["Hook", "Problem", "Value", "Proof", "Call to Action"]),
  define("marketing", "Marketing and Advertisements", "Conversion-focused promotional content with hooks, audience fit, proof, and calls to action.", [
    "Offer",
    "Audience",
    "Channel",
    "Language",
    "Duration",
    "CTA"
  ], ["Content Strategist", "Scriptwriter", "Visual Director", "Video Director", "Quality Reviewer", "Publishing Agent"], ["Hook", "Problem", "Value", "Proof", "Call to Action"]),
  define("motivational", "Motivational Content", "Inspirational production with emotional pacing, memorable lines, music design, and shareable structure.", [
    "Theme",
    "Audience",
    "Language",
    "Duration",
    "Tone",
    "Delivery style"
  ], ["Scriptwriter", "Narration Director", "Music Composer", "Visual Director", "Timeline Editor"], ["Opening Tension", "Reframe", "Proof", "Lift", "Action"], { factCheck: "optional" }),
  define("religious", "Religious and Inspirational Teachings", "Faith-centered teaching or inspiration with citations, sensitivity review, and respectful tone.", [
    "Teaching theme",
    "Faith tradition",
    "References",
    "Audience",
    "Language",
    "Duration"
  ], ["Research Agent", "Scriptwriter", "Teaching Agent", "Compliance Agent", "Quality Reviewer"], ["Opening", "Reference", "Teaching", "Application", "Reflection"]),
  define("historical-reenactment", "Historical Re-enactments", "History-based storytelling with source review, reconstruction planning, continuity, and cinematic scenes.", [
    "Historical event",
    "Time period",
    "Sources",
    "Audience",
    "Language",
    "Visual style"
  ], ["Research Agent", "Fact Checker", "Story Architect", "Historical Reconstruction", "Visual Director", "Quality Reviewer"], ["Context", "Characters", "Conflict", "Re-enactment", "Aftermath"]),
  define("children", "Children's Content", "Age-appropriate story or learning content with difficulty adaptation, safety review, and engaging visuals.", [
    "Topic or story idea",
    "Age range",
    "Language",
    "Duration",
    "Tone",
    "Learning goal"
  ], ["Story Architect", "Curriculum Designer", "Teaching Agent", "Character Director", "Compliance Agent", "Quality Reviewer"], ["Warm Hook", "Simple Idea", "Example", "Participation", "Reward"], { factCheck: "recommended" }),
  define("podcast", "Podcasts and Video Podcasts", "Audio or video podcast structure with discussion blocks, examples, summaries, and multi-speaker audio.", [
    "Topic",
    "Host style",
    "Guests or speakers",
    "Audience",
    "Language",
    "Duration"
  ], ["Content Strategist", "Research Agent", "Podcast Writer", "Narration Director", "Sound Designer", "Publishing Agent"], ["Opening", "Discussion Blocks", "Examples", "Summary"]),
  define("interview", "Interviews and Talk Shows", "Question-led show planning with segments, speaker prep, timing, graphics, and publishing metadata.", [
    "Interview topic",
    "Guest profile",
    "Audience",
    "Language",
    "Duration",
    "Segment format"
  ], ["Content Strategist", "Research Agent", "Interview Builder", "Video Director", "Timeline Editor", "Publishing Agent"], ["Opening", "Guest Context", "Question Blocks", "Highlights", "Close"]),
  define("social-short", "Social Media Shorts", "Fast, platform-native short video with immediate hook, one idea, payoff, subtitles, and CTA.", [
    "Topic",
    "Platform",
    "Audience",
    "Language",
    "Duration",
    "CTA"
  ], ["Content Strategist", "Social Script Writer", "Visual Director", "Video Director", "Subtitle QA", "Publishing Agent"], ["Immediate Hook", "One Idea", "Payoff", "CTA"]),
  define("youtube-long-form", "YouTube Long-Form Videos", "Long-form audience-retention structure with chapters, pacing, hooks, visuals, and publishing metadata.", [
    "Topic",
    "Audience",
    "Language",
    "Target duration",
    "Tone",
    "Thumbnail direction"
  ], ["Content Strategist", "Research Agent", "Scriptwriter", "Storyboard Director", "Visual Director", "Publishing Agent"], ["Cold Open", "Promise", "Chapters", "Development", "Payoff", "End Screen"]),
  define("presentation", "Presentations and Visual Reports", "Slide or report-based visual communication with structured sections, charts, diagrams, and export packages.", [
    "Report topic",
    "Audience",
    "Data sources",
    "Language",
    "Slide count",
    "Brand style"
  ], ["Research Agent", "Scriptwriter", "Visual Director", "Chart and Data Visuals", "Quality Reviewer", "Export Agent"], ["Executive Summary", "Context", "Findings", "Visual Evidence", "Recommendations"]),
  define("custom", "Custom Productions", "Configurable production format for specialized workflows, rules, agents, exports, and destinations.", [
    "Production objective",
    "Source material",
    "Audience",
    "Language",
    "Duration",
    "Custom workflow notes"
  ], ["Content Strategist", "Scriptwriter", "Storyboard Director", "Quality Reviewer", "Export Agent"], ["Custom Opening", "Custom Body", "Custom Payoff"])
];

export function getContentTypeDefinition(id: ProductionFormat) {
  return contentTypeDefinitions.find((definition) => definition.id === id);
}

function define(
  id: ProductionFormat,
  label: string,
  summary: string,
  requiredInputs: string[],
  aiAgentTeam: string[],
  scriptStructure: string[],
  options: { factCheck?: "mandatory" | "recommended" | "optional" } = {}
): ContentTypeDefinition {
  const factCheck = options.factCheck ?? "mandatory";

  return {
    id,
    label,
    summary,
    requiredInputs,
    workflowStages: allStages,
    aiAgentTeam,
    scriptStructure,
    sceneRules: [
      "Every scene maps to a script beat and duration target.",
      "Every scene declares visual, motion, narration, subtitle, and transition requirements.",
      "Complex productions require approval before render queue submission."
    ],
    visualRequirements: [
      "Use a declared visual style before generation.",
      "Keep characters, environments, brand elements, and educational diagrams consistent.",
      "Generate thumbnails, captions, and platform-safe visual variants where needed."
    ],
    audioRequirements: [
      "Define narration voice, language, pronunciation, emotion, and delivery.",
      "Balance dialogue, music, ambience, and sound effects to platform loudness targets.",
      "Generate subtitles and review accessibility before final export."
    ],
    qaChecks: [
      { label: "Content QA", level: "mandatory" },
      { label: "Script QA", level: "mandatory" },
      { label: "Fact Verification", level: factCheck },
      { label: "Visual QA", level: "mandatory" },
      { label: "Audio QA", level: "mandatory" },
      { label: "Subtitle QA", level: "mandatory" },
      { label: "Accessibility Check", level: "recommended" },
      { label: "Copyright Review", level: "mandatory" },
      { label: "Platform Compliance", level: "mandatory" },
      { label: "Human Review", level: "recommended" },
      { label: "Final Approval", level: "mandatory" }
    ],
    durationRules: [
      "Duration is selected during production setup.",
      "Scene duration budgets must sum to the target runtime.",
      "Short-form platforms prioritize hook density and subtitle readability.",
      "Courses and long-form outputs support chaptered timelines."
    ],
    outputFormats: [
      "Ready-to-Publish MP4",
      "Editable Scene Package",
      "CapCut Package",
      "Audio Package",
      "Subtitle Package",
      "Storyboard Package",
      "Script Package",
      "Publishing Package"
    ],
    publishingDestinations: [
      "YouTube",
      "Facebook",
      "TikTok",
      "Instagram",
      "LinkedIn",
      "X",
      "Website",
      "Learning Platforms",
      "Podcast Platforms"
    ],
    exportModes
  };
}
