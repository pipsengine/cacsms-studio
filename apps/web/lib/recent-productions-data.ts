import type { RecentProductionsQuery, RecentProductionsResponse } from "@/types/recent-productions";

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

export function parseRecentProductionsQuery(searchParams: URLSearchParams): Required<Pick<RecentProductionsQuery, "page" | "pageSize" | "sort">> &
  Omit<RecentProductionsQuery, "page" | "pageSize" | "sort"> {
  return {
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    brandId: searchParams.get("brandId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    ownerId: searchParams.get("ownerId") ?? undefined,
    channel: searchParams.get("channel") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? "completedAt:desc",
    page: clampNumber(searchParams.get("page"), 1, 1, 100000),
    pageSize: clampNumber(searchParams.get("pageSize"), 10, 1, 100)
  };
}

export async function getRecentProductionsData(query: RecentProductionsQuery = {}): Promise<RecentProductionsResponse> {
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
      { key: "recent", label: "Recent Productions", value: 0, trend: "flat", percent: null },
      { key: "completed", label: "Completed", value: 0, trend: "flat", percent: null },
      { key: "published", label: "Published", value: 0, trend: "flat", percent: null },
      { key: "archived", label: "Archived", value: 0, trend: "flat", percent: null },
      { key: "failed", label: "Failed", value: 0, trend: "flat", percent: null },
      { key: "quality", label: "Avg. Quality Score", value: "0%", trend: "flat", percent: null }
    ],
    productions: [],
    statusBreakdown: [
      { status: "completed", count: 0, percentage: 0 },
      { status: "published", count: 0, percentage: 0 },
      { status: "archived", count: 0, percentage: 0 },
      { status: "cancelled", count: 0, percentage: 0 },
      { status: "failed", count: 0, percentage: 0 }
    ],
    typeBreakdown: [],
    performance: [],
    channelPerformance: [],
    activity: [],
    total: 0,
    page,
    pageSize
  };
}

export async function exportRecentProductionsCsv(query: RecentProductionsQuery = {}) {
  const data = await getRecentProductionsData(query);
  const rows = [
    ["Code", "Title", "Type", "Status", "Owner", "CompletedAt", "PublishedAt", "Channel", "QualityScore", "PerformanceScore"],
    ...data.productions.map((production) => [
      production.code,
      production.title,
      production.type,
      production.status,
      production.owner.name,
      production.completedAt ?? "",
      production.publishedAt ?? "",
      production.channel ?? "",
      String(production.qualityScore ?? ""),
      String(production.performanceScore ?? "")
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
