import { NextResponse } from "next/server";
import type { WorkflowStage } from "@cacsms/contracts";
import { productionLifecycleStages } from "@cacsms/contracts";
import { getLifecycleQueue } from "@/lib/production-lifecycle-data";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ stage: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { stage } = await params;
  const stageId = productionLifecycleStages.find((item) => item.id === stage)?.id as WorkflowStage | undefined;
  if (!stageId) return NextResponse.json({ message: "Unknown lifecycle stage." }, { status: 404 });
  try {
    const items = await getLifecycleQueue(stageId);
    return NextResponse.json({ stage: stageId, items, count: items.length });
  } catch (error) {
    console.error("production-lifecycle.queue.failed", error);
    return NextResponse.json({ message: "Unable to load lifecycle queue." }, { status: 500 });
  }
}
