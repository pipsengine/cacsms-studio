export interface OpportunityRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  estimatedValue: number;
  confidence: number;
  timing: string;
  owner: string;
  score: number;
  status: string;
  marketDemand: number;
  strategicFit: number;
  executionReadiness: number;
  competitiveWhitespace: number;
  highPriority: boolean;
  atRisk: boolean;
}

export interface OpportunitySignal {
  id: string;
  subject: string;
  sourceMix: string;
  velocity: number;
  novelty: number;
  durability: string;
  relevance: number;
  score: number;
  state: string;
  watchlisted: boolean;
  anomaly: boolean;
}

export interface DiscoverySettings {
  scanHorizonDays: number;
  primaryMarket: string;
  signalSensitivity: number;
  minimumConfidence: number;
  includeWeakSignals: boolean;
  detectAnomalies: boolean;
  crossCheckCompetitors: boolean;
  lastScanAt: string | null;
}

export interface OpportunityDashboardData {
  metrics: { active: number; estimatedValue: number; highPriority: number; averageConfidence: number; atRisk: number };
  opportunities: OpportunityRecord[];
  portfolio: Array<{ label: string; value: number; color: string }>;
  pipeline: Array<{ label: string; count: number }>;
}

export interface DiscoveryData {
  settings: DiscoverySettings;
  signals: OpportunitySignal[];
  metrics: { processed: number; emerging: number; clusters: number; alerts: number };
}
