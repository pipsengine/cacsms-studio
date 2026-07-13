import type { HomeOperationalResponse } from "@/types/home-remaining-pages";

export async function getHomeOperationalPage(slug: string, signal?: AbortSignal): Promise<HomeOperationalResponse> {
  const response = await fetch(`/api/home/${slug}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `Request failed with status ${response.status}.`);
  }

  return response.json() as Promise<HomeOperationalResponse>;
}

export async function runPageAction(slug: string, action: string, entityId?: string) {
  const response = await fetch(`/api/home/${slug}/actions/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ entityId })
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || "Action failed.");
  }

  return response.json() as Promise<{ success: boolean; operationId: string }>;
}
