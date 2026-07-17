import { NextResponse } from "next/server";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import {
  getSceneVideoWorkspaceData,
  runSceneVideoScheduler,
  syncSceneVideoProduction
} from "@/lib/scene-video-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSceneVideoWorkspaceData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Scene video data unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = requireMutationAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "scheduler" | "sync";
      productionId?: string;
    };

    if (body.action === "scheduler") {
      return NextResponse.json(await runSceneVideoScheduler(), {
        headers: { "Cache-Control": "no-store" }
      });
    }

    if (!body.productionId) {
      return NextResponse.json({ message: "A production is required." }, { status: 400 });
    }

    return NextResponse.json(
      { production: await syncSceneVideoProduction(body.productionId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Scene video automation could not be completed." },
      { status: 500 }
    );
  }
}
