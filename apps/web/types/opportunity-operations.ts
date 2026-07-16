export type OperationalRecord = {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  status: string;
  owner: string;
  score: number | null;
  progress: number | null;
  amount: number | null;
  startAt: string | null;
  dueAt: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type OperationalPageData = {
  slug: string;
  records: OperationalRecord[];
  settings: Record<string, unknown>;
  totals: {
    count: number;
    active: number;
    ready: number;
    attention: number;
    averageScore: number;
    totalAmount: number;
  };
  autonomy?: {
    enabled:boolean;state:"running"|"healthy"|"waiting"|"failed";algorithmVersion:string;intervalSeconds:number;nextRunAt:string|null;
    lastRun:null|{trigger:string;scanned:number;ingested:number;updated:number;promoted:number;enriching:number;duplicates:number;portfolioScore:number;averageConfidence:number;completedAt:string|null;error:string|null;verified?:number;approved?:number;held?:number;editorialHealth?:number;committed?:number;executing?:number;deferred?:number;strategicValue?:number;investmentCommitted?:number;masters?:number;variants?:number;ready?:number;optimized?:number;channelCoverage?:number;reuseEfficiency?:number;adaptationQuality?:number;campaigns?:number;assets?:number;scheduled?:number;launched?:number;projectedReach?:number;budgetAllocated?:number;launchReadiness?:number;certified?:number;refreshQueued?:number;freshness?:number;reuseReadiness?:number;retired?:number;scheduledAssets?:number;upcoming?:number;rebalanced?:number;conflicts?:number;timingScore?:number;capacityScore?:number};
  };
  generatedAt: string;
};

export type OperationalMutation = {
  action: "create" | "update" | "delete" | "setting";
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  category?: string;
  status?: string;
  owner?: string;
  score?: number | null;
  progress?: number | null;
  amount?: number | null;
  startAt?: string | null;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
  key?: string;
  value?: unknown;
};
