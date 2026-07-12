import type {
  KnowledgeCollection,
  KnowledgeDomain,
  KnowledgeGraphNode,
  KnowledgeGraphRelationship,
  KnowledgePrediction,
  KnowledgeUniverseMetric
} from "./types";

export const knowledgeUniverseMetrics: KnowledgeUniverseMetric[] = [
  { label: "Knowledge Objects", value: "2.4M", detail: "Topics, entities, sources, memories, predictions, and media assets" },
  { label: "Entities", value: "418K", detail: "People, places, companies, technologies, events, standards, and projects" },
  { label: "Relationships", value: "9.8M", detail: "Connected facts, dependencies, influences, causes, and ownership links" },
  { label: "Verified Sources", value: "124K", detail: "Books, papers, reports, policies, standards, videos, and internal documents" },
  { label: "Knowledge Confidence", value: "91%", detail: "Weighted source quality, verification, freshness, and human approval" },
  { label: "Knowledge Freshness", value: "86%", detail: "Objects reviewed, refreshed, or superseded within policy windows" },
  { label: "AI Memory Size", value: "37TB", detail: "Research, production, correction, performance, and learning memory" },
  { label: "Prediction Accuracy", value: "78%", detail: "Measured accuracy across trend, audience, production, and gap predictions" }
];

export const knowledgeCoreEngines = [
  {
    label: "Knowledge Graph",
    description: "Neo4j-style graph model where every topic, entity, source, production, and prediction is connected."
  },
  {
    label: "World Model",
    description: "Computational model of economies, industries, technology, education, organizations, markets, and culture."
  },
  {
    label: "AI Memory",
    description: "Permanent record of research, productions, corrections, audience response, AI decisions, and improvements."
  },
  {
    label: "Semantic Intelligence",
    description: "Embeddings, vectors, topic similarity, natural language retrieval, and meaning-aware search."
  },
  {
    label: "Relationship Engine",
    description: "Discovers created-by, depends-on, caused, influenced, derived-from, located-in, and related-to links."
  },
  {
    label: "Reasoning Engine",
    description: "Deductive, inductive, abductive, causal, counterfactual, scenario, and multi-hop reasoning."
  },
  {
    label: "Prediction Engine",
    description: "Forecasts future trends, emerging technologies, audience interests, demand, gaps, and opportunities."
  },
  {
    label: "Knowledge Quality Engine",
    description: "Scores confidence, freshness, completeness, verification status, bias risk, and source quality."
  }
];

export const knowledgeDomains: KnowledgeDomain[] = [
  { id: "technology", label: "Technology", objects: 326000, confidence: 92, freshness: 89 },
  { id: "science", label: "Science", objects: 288000, confidence: 94, freshness: 84 },
  { id: "engineering", label: "Engineering", objects: 171000, confidence: 88, freshness: 81 },
  { id: "medicine", label: "Medicine", objects: 203000, confidence: 91, freshness: 86 },
  { id: "history", label: "History", objects: 246000, confidence: 87, freshness: 76 },
  { id: "business", label: "Business", objects: 192000, confidence: 85, freshness: 90 },
  { id: "education", label: "Education", objects: 128000, confidence: 89, freshness: 87 },
  { id: "cybersecurity", label: "Cybersecurity", objects: 104000, confidence: 86, freshness: 94 },
  { id: "manufacturing", label: "Manufacturing", objects: 98000, confidence: 84, freshness: 83 },
  { id: "africa", label: "Africa", objects: 221000, confidence: 82, freshness: 80 },
  { id: "artificial-intelligence", label: "Artificial Intelligence", objects: 184000, confidence: 90, freshness: 96 },
  { id: "space", label: "Space", objects: 91000, confidence: 93, freshness: 88 }
];

export const knowledgeGraphNodes: KnowledgeGraphNode[] = [
  { id: "artificial-intelligence", label: "Artificial Intelligence", type: "topic", confidence: "verified" },
  { id: "machine-learning", label: "Machine Learning", type: "topic", confidence: "verified" },
  { id: "deep-learning", label: "Deep Learning", type: "topic", confidence: "verified" },
  { id: "robotics", label: "Robotics", type: "topic", confidence: "high" },
  { id: "manufacturing", label: "Manufacturing", type: "topic", confidence: "high" },
  { id: "industry-4", label: "Industry 4.0", type: "collection", confidence: "high" },
  { id: "smart-factories", label: "Smart Factories", type: "topic", confidence: "high" },
  { id: "africa", label: "Africa", type: "entity", confidence: "verified" },
  { id: "economic-development", label: "Economic Development", type: "topic", confidence: "high" }
];

export const knowledgeGraphRelationships: KnowledgeGraphRelationship[] = [
  { from: "artificial-intelligence", to: "machine-learning", label: "contains", confidence: "verified" },
  { from: "machine-learning", to: "deep-learning", label: "contains", confidence: "verified" },
  { from: "deep-learning", to: "robotics", label: "enables", confidence: "high" },
  { from: "robotics", to: "manufacturing", label: "transforms", confidence: "high" },
  { from: "manufacturing", to: "industry-4", label: "evolves into", confidence: "high" },
  { from: "industry-4", to: "smart-factories", label: "contains", confidence: "high" },
  { from: "smart-factories", to: "africa", label: "creates opportunities in", confidence: "medium" },
  { from: "africa", to: "economic-development", label: "influences", confidence: "high" }
];

export const knowledgeRelationshipTypes = [
  "Created By",
  "Founded By",
  "Part Of",
  "Depends On",
  "Influenced",
  "Inspired",
  "Caused",
  "Related To",
  "Uses",
  "Built From",
  "Competes With",
  "Supersedes",
  "Connected To",
  "Similar To",
  "Located In",
  "Belongs To",
  "Works With",
  "Derived From"
];

export const semanticSearchExamples = [
  "Show technologies likely to change Africa before 2040.",
  "Which engineering discoveries affected transportation?",
  "What documentaries should follow Industry 4.0?",
  "Which knowledge is becoming outdated?",
  "What should we learn next to improve opportunity discovery?"
];

export const reasoningModes = [
  "Deductive Reasoning",
  "Inductive Reasoning",
  "Abductive Reasoning",
  "Causal Reasoning",
  "Counterfactual Reasoning",
  "Scenario Analysis",
  "Multi-hop Reasoning",
  "Hypothesis Generation",
  "Knowledge Synthesis"
];

export const worldModelSignals = [
  "Economies",
  "Governments",
  "Industries",
  "Technology",
  "Education",
  "Human Behaviour",
  "Organizations",
  "Markets",
  "Infrastructure",
  "Environment",
  "Science",
  "Culture",
  "History",
  "Future Trends"
];

export const knowledgePredictions: KnowledgePrediction[] = [
  {
    id: "ev-battery-africa",
    title: "Battery demand will increase African mining and manufacturing story opportunities.",
    horizon: "2026-2040",
    confidence: 82,
    implication: "Create explainers connecting EV growth, lithium, refining, policy, logistics, and African industrialization."
  },
  {
    id: "ai-education-localization",
    title: "Localized AI education will become a high-demand content category.",
    horizon: "2026-2032",
    confidence: 86,
    implication: "Prioritize multilingual teaching content, practical tutorials, and regional case studies."
  },
  {
    id: "robotics-manufacturing",
    title: "Affordable robotics will shift small-factory productivity narratives.",
    horizon: "2027-2035",
    confidence: 74,
    implication: "Track automation, smart factories, jobs, training, and entrepreneurship opportunities."
  }
];

export const knowledgeCollections: KnowledgeCollection[] = [
  {
    id: "industry-4",
    title: "Industry 4.0",
    summary: "Reusable knowledge collection for smart manufacturing, automation, AI, robotics, logistics, and production content.",
    includes: ["Research", "Documentaries", "Tutorials", "Teaching Lessons", "Presentations", "Images", "Videos", "Infographics", "Quizzes"]
  },
  {
    id: "great-african-civilizations",
    title: "Great African Civilizations",
    summary: "Historical, cultural, geographic, educational, and production-ready knowledge on African civilizations.",
    includes: ["Books", "Maps", "Timelines", "Entities", "Stories", "Teaching Lessons", "Documentaries", "Children's Content"]
  },
  {
    id: "future-technologies",
    title: "Future Technologies",
    summary: "Technology trees, dependencies, maturity, adoption, risks, companies, papers, and content opportunities.",
    includes: ["AI", "Robotics", "Space", "Energy", "Biotech", "Cybersecurity", "Predictions", "Opportunity Plans"]
  }
];

export const knowledgeQualityDimensions = [
  "Confidence",
  "Freshness",
  "Completeness",
  "Verification Status",
  "Bias Risk",
  "Source Quality",
  "Popularity",
  "Last Reviewed",
  "AI Confidence",
  "Human Approval"
];

export const knowledgeGovernanceControls = [
  "Versioning",
  "Approvals",
  "Ownership",
  "Licensing",
  "Copyright",
  "Security",
  "Retention",
  "Backup",
  "Audit",
  "Data Classification",
  "Compliance",
  "Workspace Isolation"
];

export const knowledgeAgents = [
  "Knowledge Curator",
  "Research Curator",
  "Relationship Builder",
  "Entity Extractor",
  "Semantic Indexer",
  "Reasoning Agent",
  "Prediction Agent",
  "Memory Manager",
  "Knowledge QA",
  "World Model Builder"
];

export const knowledgeDatabaseObjects = [
  "Knowledge Nodes",
  "Relationships",
  "Entities",
  "Subjects",
  "Topics",
  "Sources",
  "Collections",
  "Predictions",
  "Reasoning Chains",
  "Embeddings",
  "Vectors",
  "Metadata",
  "Versions",
  "Permissions"
];
