import { NextResponse } from "next/server";
import { getProductionLifecycleStage, type WorkflowStage } from "@cacsms/contracts";
import {
  advanceOpportunityState,
  getStageChecklist,
  markStageReady,
  updateStageChecklist
} from "@/lib/production-lifecycle-data";
import type { LifecycleChecklistItem } from "@/types/production-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ stage: string }> }) {
  try {
    const { stage } = await context.params;
    const definition = getProductionLifecycleStage(stage);
    if (!definition) {
      return NextResponse.json({ message: "Unknown lifecycle stage." }, { status: 404 });
    }
    const checklist = await getStageChecklist(definition.id);
    return NextResponse.json({ stage: definition, checklist });
  } catch (error) {
    console.error("production-lifecycle.stage.read.failed", error);
    return NextResponse.json({ message: "Unable to load stage checklist." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ stage: string }> }) {
  try {
    const { stage } = await context.params;
    const definition = getProductionLifecycleStage(stage);
    if (!definition) {
      return NextResponse.json({ message: "Unknown lifecycle stage." }, { status: 404 });
    }

    const body = (await request.json()) as {
      action: "update-checklist" | "mark-ready" | "advance";
      checklist?: Partial<Record<LifecycleChecklistItem, boolean>>;
    };

    if (body.action === "update-checklist") {
      const state = await updateStageChecklist(definition.id, body.checklist ?? {});
      return NextResponse.json({ state });
    }

    if (body.action === "mark-ready") {
      const result = await markStageReady(definition.id as WorkflowStage);
      await advanceOpportunityState(definition.id as WorkflowStage);
      return NextResponse.json(result);
    }

    if (body.action === "advance") {
      await advanceOpportunityState(definition.id as WorkflowStage);
      return NextResponse.json({ status: "ok", stageId: definition.id });
    }

    return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("production-lifecycle.stage.write.failed", error);
    return NextResponse.json({ message: "Unable to update lifecycle stage." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ stage: string }> }) {
  return POST(request, context);
}
