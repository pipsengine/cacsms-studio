import type {
  AutonomyMode,
  OpportunityCampaign,
  OpportunityPortfolioItem,
  OpportunityScoreModel,
  OpportunitySignalSource,
  OpportunityState,
  ProductionFormat
} from "./types";

export const opportunityStates: OpportunityState[] = [
  "discovered",
  "researching",
  "verified",
  "scored",
  "prioritized",
  "preplanned",
  "scheduled",
  "ready",
  "producing",
  "published",
  "learning",
  "archived"
];

export const autonomyModes: Array<{ id: AutonomyMode; label: string; description: string }> = [
  {
    id: "assisted",
    label: "Assisted",
    description: "The studio discovers and ranks opportunities while users approve each move."
  },
  {
    id: "recommended",
    label: "Recommended",
    description: "The studio proposes production plans, schedules, budgets, and channels for human selection."
  },
  {
    id: "supervised-autonomous",
    label: "Supervised Autonomous",
    description: "High-confidence opportunities advance automatically until approval, spend, or publishing gates."
  },
  {
    id: "fully-autonomous",
    label: "Fully Autonomous",
    description: "Approved categories can be discovered, planned, produced, published, and learned from continuously."
  }
];

export const opportunitySignalSources: OpportunitySignalSource[] = [
  {
    id: "global-intelligence",
    label: "Global Intelligence",
    cadence: "Hourly",
    coverage: ["Science", "AI", "technology", "medicine", "space", "climate", "economics", "infrastructure"]
  },
  {
    id: "human-interest",
    label: "Human Interest Intelligence",
    cadence: "Daily",
    coverage: ["Hidden heroes", "survival stories", "inventors", "startups", "social impact", "human achievement"]
  },
  {
    id: "mystery-intelligence",
    label: "Mystery Intelligence",
    cadence: "Daily",
    coverage: ["Lost civilizations", "ancient engineering", "ocean mysteries", "space mysteries", "archaeology"]
  },
  {
    id: "curiosity-engine",
    label: "Curiosity Engine",
    cadence: "Continuous",
    coverage: ["Why", "How", "What if", "The truth about", "The hidden story", "The future of", "Inside"]
  },
  {
    id: "gap-detection",
    label: "Gap Detection Engine",
    cadence: "Weekly",
    coverage: ["Poorly explained topics", "underserved audiences", "regional angles", "missing formats"]
  },
  {
    id: "life-explorer",
    label: "Life Explorer Engine",
    cadence: "Continuous",
    coverage: ["Life lessons", "nature", "psychology", "African innovation", "engineering marvels", "everyday questions"]
  }
];

export const opportunityCategories = [
  "Technology",
  "Artificial Intelligence",
  "Robotics",
  "Science",
  "Space",
  "Engineering",
  "History",
  "Africa",
  "Manufacturing",
  "Business",
  "Finance",
  "Economics",
  "Education",
  "Health",
  "Cybersecurity",
  "Leadership",
  "Motivation",
  "Life Lessons",
  "Religion",
  "Environment",
  "Architecture",
  "Transportation",
  "Politics",
  "Energy",
  "Food",
  "Agriculture",
  "Entertainment",
  "Sports",
  "Culture",
  "Future Trends",
  "Life Skills",
  "Children"
];

export const opportunityScoreModel: OpportunityScoreModel[] = [
  { label: "Curiosity Score", weight: 12, description: "Measures how strongly the subject invites questions and clicks." },
  { label: "Educational Value", weight: 10, description: "Measures how useful and teachable the opportunity is." },
  { label: "Emotional Impact", weight: 9, description: "Measures wonder, hope, fear, surprise, achievement, and redemption potential." },
  { label: "Commercial Value", weight: 8, description: "Measures monetization, sponsorship, audience, and conversion potential." },
  { label: "Evergreen Potential", weight: 10, description: "Measures whether the production will still matter years from now." },
  { label: "Trend Strength", weight: 9, description: "Measures momentum across search, social, academic, industry, and news signals." },
  { label: "Production Cost", weight: 7, description: "Rewards opportunities that create high value with reasonable production effort." },
  { label: "Audience Demand", weight: 10, description: "Measures proven audience interest and unanswered public questions." },
  { label: "Originality", weight: 8, description: "Measures uniqueness of angle, data, region, story, or production treatment." },
  { label: "Brand Alignment", weight: 6, description: "Measures fit with CACSMS quality, mission, audience, and governance." },
  { label: "Social Impact", weight: 5, description: "Measures educational, civic, cultural, or development benefit." },
  { label: "Virality Potential", weight: 6, description: "Measures shareability, short-form hooks, and platform-native momentum." }
];

export const executiveProducerAgents = [
  "Research Agent",
  "Content Strategist",
  "Business Analyst",
  "Educational Expert",
  "Historian",
  "Marketing Expert",
  "Audience Analyst",
  "Compliance Officer",
  "Publishing Director"
];

export const evergreenKnowledgeBank = [
  "How Steel Is Made",
  "History of Electricity",
  "History of AI",
  "Inside Modern Factories",
  "How Bridges Are Built",
  "Great African Civilizations",
  "History of Aviation",
  "Future of Robotics",
  "AI in African Manufacturing",
  "The Hidden Story of Lagos"
];

export const opportunityPortfolio: OpportunityPortfolioItem[] = [
  {
    id: "ai-african-manufacturing",
    title: "AI in African Manufacturing",
    category: "Artificial Intelligence",
    state: "prioritized",
    overallScore: 94,
    emotionalProfile: ["curiosity", "hope", "innovation", "achievement"],
    productionFormats: ["documentary", "explainer", "social-short", "presentation"],
    recommendedChannels: ["YouTube", "LinkedIn", "TikTok", "Learning Platforms"],
    publishWindow: "Next 7 days",
    estimatedCostBand: "Medium",
    expectedReturn: "High strategic and audience value"
  },
  {
    id: "hidden-story-lagos",
    title: "The Hidden Story of Lagos",
    category: "Africa",
    state: "preplanned",
    overallScore: 91,
    emotionalProfile: ["wonder", "identity", "discovery", "surprise"],
    productionFormats: ["documentary", "podcast", "children", "social-short"],
    recommendedChannels: ["YouTube", "Instagram", "Podcast Platforms", "Website"],
    publishWindow: "Next 14 days",
    estimatedCostBand: "Medium",
    expectedReturn: "High evergreen and cultural value"
  },
  {
    id: "future-of-robotics",
    title: "The Future of Robotics in Everyday Life",
    category: "Robotics",
    state: "scheduled",
    overallScore: 88,
    emotionalProfile: ["curiosity", "surprise", "future", "fear"],
    productionFormats: ["explainer", "youtube-long-form", "social-short", "teaching"],
    recommendedChannels: ["YouTube", "TikTok", "LinkedIn"],
    publishWindow: "Publishing tomorrow",
    estimatedCostBand: "Low",
    expectedReturn: "Strong trend and reusable education value"
  },
  {
    id: "lost-kingdoms-west-africa",
    title: "Forgotten Kingdoms of West Africa",
    category: "History",
    state: "researching",
    overallScore: 86,
    emotionalProfile: ["wonder", "identity", "mystery", "pride"],
    productionFormats: ["historical-reenactment", "documentary", "presentation", "children"],
    recommendedChannels: ["YouTube", "Learning Platforms", "Website"],
    publishWindow: "Next 30 days",
    estimatedCostBand: "High",
    expectedReturn: "High educational and evergreen value"
  }
];

export const opportunityCampaigns: OpportunityCampaign[] = [
  {
    id: "future-ai",
    title: "The Future of Artificial Intelligence",
    anchorOpportunity: "AI in African Manufacturing",
    outputs: ["10 documentaries", "15 shorts", "5 explainers", "podcast series", "LinkedIn articles", "teaching version", "children's version"]
  },
  {
    id: "african-civilizations",
    title: "Great African Civilizations",
    anchorOpportunity: "Forgotten Kingdoms of West Africa",
    outputs: ["feature documentary", "classroom lessons", "map series", "timeline", "quiz", "podcast episode", "social carousel"]
  }
];

export const multiFormatPlan: Array<{ format: ProductionFormat | "blog" | "infographic" | "quiz" | "timeline"; label: string }> = [
  { format: "documentary", label: "15-minute documentary" },
  { format: "youtube-long-form", label: "5-minute documentary" },
  { format: "social-short", label: "1-minute short" },
  { format: "podcast", label: "Podcast episode" },
  { format: "teaching", label: "Teaching lesson" },
  { format: "presentation", label: "Presentation" },
  { format: "blog", label: "Blog article" },
  { format: "infographic", label: "Infographic" },
  { format: "timeline", label: "Timeline" },
  { format: "quiz", label: "Quiz" },
  { format: "children", label: "Children's version" }
];
