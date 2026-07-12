import type { RecentProductionsQuery, RecentProductionsResponse } from "@/types/recent-productions";

function buildQuery(query: RecentProductionsQuery) {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

export async function getRecentProductions(
  query: RecentProductionsQuery = {},
  signal?: AbortSignal
): Promise<RecentProductionsResponse> {
  const queryString = buildQuery(query);
  const response = await fetch(`/api/dashboard/recent-productions${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<RecentProductionsResponse>;
}

export async function exportRecentProductions(query: RecentProductionsQuery = {}) {
  const queryString = buildQuery(query);
  const response = await fetch(`/api/dashboard/recent-productions/export${queryString ? `?${queryString}` : ""}`, {
    headers: { Accept: "text/csv" }
  });

  if (!response.ok) {
    throw new Error("Unable to export recent productions.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "recent-productions.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
