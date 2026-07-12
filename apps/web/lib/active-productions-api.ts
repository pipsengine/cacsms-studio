import type { ActiveProductionsQuery, ActiveProductionsResponse } from "@/types/active-productions";

function buildQuery(params: ActiveProductionsQuery): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

export async function getActiveProductions(
  query: ActiveProductionsQuery = {},
  signal?: AbortSignal
): Promise<ActiveProductionsResponse> {
  const qs = buildQuery(query);
  const response = await fetch(`/api/dashboard/active-productions${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ActiveProductionsResponse>;
}

export async function exportActiveProductions(query: ActiveProductionsQuery = {}) {
  const qs = buildQuery(query);
  const response = await fetch(`/api/dashboard/active-productions/export${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: { Accept: "text/csv" }
  });

  if (!response.ok) {
    throw new Error("Export failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "active-productions.csv";
  link.click();
  URL.revokeObjectURL(url);
}
