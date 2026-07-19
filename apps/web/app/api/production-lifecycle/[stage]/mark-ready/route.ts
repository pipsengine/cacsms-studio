import { NextResponse } from "next/server";
import type { WorkflowStage } from "@cacsms/contracts";
import { lifecycleStageValidationRules, productionLifecycleStages } from "@cacsms/contracts";
import { getRequestSession } from "@/lib/auth/session";
import { markLifecycleStageReady } from "@/lib/production-lifecycle-data";
import { requireMutationAccess } from "@/app/api/_utils/write-access";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ stage: string }> };

function resolveStage(stage: string): WorkflowStage | null {
  return productionLifecycleStages.find((item) => item.id === stage)?.id ?? null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { stage } = await params;
  const stageId = resolveStage(stage);
  if (!stageId) return NextResponse.json({ message: "Unknown lifecycle stage." }, { status: 404 });
  return NextResponse.json({
    stage: stageId,
    validationRules: lifecycleStageValidationRules[stageId]
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const denied = await requireMutationAccess(request, "lifecycle.mark-ready");
  if (denied) return denied;
  const session = await getRequestSession(request);
  const { stage } = await params;
  const stageId = resolveStage(stage);
  if (!stageId) return NextResponse.json({ message: "Unknown lifecycle stage." }, { status: 404 });
  try {
    const body = (await request.json()) as {
      checks?: string[];
      entityType?: string;
      entityId?: string;
      message?: string;
    };
    const result = await markLifecycleStageReady({
      stageId,
      checks: body.checks ?? lifecycleStageValidationRules[stageId].requiredChecks,
      entityType: body.entityType,
      entityId: body.entityId,
      userId: session?.userId ?? null,
      message: body.message
    });
    if (result.status === "blocked") {
      return NextResponse.json({ status: result.status, validationErrors: result.validationErrors }, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("production-lifecycle.mark-ready.failed", error);
    return NextResponse.json({ message: "Unable to mark stage ready." }, { status: 500 });
  }
}
