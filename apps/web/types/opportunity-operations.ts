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
