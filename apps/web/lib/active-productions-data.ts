import type { ActiveProductionsQuery, ActiveProductionsResponse } from "@/types/active-productions";

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function parseActiveProductionsQuery(searchParams: URLSearchParams): Required<Pick<ActiveProductionsQuery, "page" | "pageSize" | "sort">> &
  Omit<ActiveProductionsQuery, "page" | "pageSize" | "sort"> {
  return {
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    brandId: searchParams.get("brandId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    stage: searchParams.get("stage") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? "deadline:asc",
    page: clampNumber(searchParams.get("page"), 1, 1, 100000),
    pageSize: clampNumber(searchParams.get("pageSize"), 10, 1, 100)
  };
}

export async function getActiveProductionsData(
  query: ActiveProductionsQuery = {}
): Promise<ActiveProductionsResponse> {
  const page = clampNumber(query.page, 1, 1, 100000);
  const pageSize = clampNumber(query.pageSize, 10, 1, 100);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      workspaceId: query.workspaceId ?? null,
      brandId: query.brandId ?? null,
      from: query.from ?? null,
      to: query.to ?? null
    },
    metrics: [
      { key: "active", label: "Active Productions", value: 0, trend: "flat", percent: null },
      { key: "onTrack", label: "On Track", value: 0, trend: "flat", percent: null },
      { key: "atRisk", label: "At Risk", value: 0, trend: "flat", percent: null },
      { key: "delayed", label: "Delayed", value: 0, trend: "flat", percent: null },
      { key: "paused", label: "Paused", value: 0, trend: "flat", percent: null },
      { key: "avgProgress", label: "Avg. Progress", value: "0%", trend: "flat", percent: null }
    ],
    productions: [],
    stageBreakdown: [],
    healthBreakdown: [
      { status: "on-track", count: 0, percentage: 0 },
      { status: "at-risk", count: 0, percentage: 0 },
      { status: "delayed", count: 0, percentage: 0 },
      { status: "paused", count: 0, percentage: 0 }
    ],
    deadlines: [],
    risks: [],
    activity: [],
    workload: [],
    total: 0,
    page,
    pageSize
  };
}

export async function exportActiveProductionsCsv(query: ActiveProductionsQuery = {}) {
  const data = await getActiveProductionsData(query);
  const rows = [
    ["Code", "Title", "Type", "Stage", "Owner", "Progress", "Status", "Deadline", "Priority"],
    ...data.productions.map((production) => [
      production.code,
      production.title,
      production.type,
      production.stage,
      production.owner.name,
      String(production.progress),
      production.healthStatus,
      production.deadline,
      production.priority
    ])
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\n");
}
