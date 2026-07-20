import { NextResponse } from "next/server";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import { getScriptIntelligenceWorkspaceData, runScriptIntelligenceScheduler } from "@/lib/script-intelligence-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getScriptIntelligenceWorkspaceData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Script intelligence data unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: "scheduler" };
    if (body.action !== "scheduler") {
      return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
    }
    return NextResponse.json(await runScriptIntelligenceScheduler(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Script intelligence automation failed." },
      { status: 500 }
    );
  }
}
