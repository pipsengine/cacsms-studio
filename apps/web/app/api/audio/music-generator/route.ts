import { NextResponse } from "next/server";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import {
  getMusicWorkspaceData,
  runMusicScheduler,
  syncMusicProduction
} from "@/lib/music-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMusicWorkspaceData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Music data unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "scheduler" | "sync";
      productionId?: string;
    };

    if (body.action === "scheduler") {
      return NextResponse.json(await runMusicScheduler(), {
        headers: { "Cache-Control": "no-store" }
      });
    }

    if (!body.productionId) {
      return NextResponse.json({ message: "A production is required." }, { status: 400 });
    }

    return NextResponse.json(
      { production: await syncMusicProduction(body.productionId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Music automation could not be completed." },
      { status: 500 }
    );
  }
}
