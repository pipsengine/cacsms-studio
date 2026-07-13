import type { CreateProductionPayload, ProductionPageResponse } from "@/types/production-studio";

export async function fetchProductionStudioPage(slug: string, signal?: AbortSignal): Promise<ProductionPageResponse> {
  const response = await fetch(`/api/production-studio/${slug}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Unable to load Production Studio.");
  return response.json() as Promise<ProductionPageResponse>;
}

export async function createProduction(payload: CreateProductionPayload) {
  const response = await fetch("/api/production-studio/create-production", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Unable to create production.");
  return response.json() as Promise<{ id: string; status: string; createdAt: string }>;
}
