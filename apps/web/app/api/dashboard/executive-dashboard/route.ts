import { NextResponse } from "next/server";
import { getExecutiveDashboardData, setExecutivePlatformState } from "@/lib/executive-dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getExecutiveDashboardData({
    workspaceId: url.searchParams.get("workspace") ?? undefined,
    brandId: url.searchParams.get("brand") ?? undefined,
    periodDays: Number(url.searchParams.get("period") ?? 30)
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  let body: { action?: string; workspaceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "A valid JSON body is required." }, { status: 400 });
  }
  if (!body.action || !["start", "pause", "stop"].includes(body.action)) {
    return NextResponse.json({ message: "Action must be start, pause, or stop." }, { status: 400 });
  }
  await setExecutivePlatformState(body.action as "start" | "pause" | "stop", body.workspaceId);
  return NextResponse.json(await getExecutiveDashboardData({ workspaceId: body.workspaceId }));
}
