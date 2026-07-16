import { NextResponse } from "next/server";
import { getScriptEditorData, runScriptEditorAutomation, runScriptWritingScheduler } from "@/lib/script-editor-engine";
import { requireMutationAccess } from "@/app/api/_utils/write-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getScriptEditorData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Script editor data unavailable." },
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
      productionId?: string;
      action?: "sync" | "retry" | "scheduler";
    };

    if (body.action === "scheduler") {
      const payload = await runScriptWritingScheduler();
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    if (!body.productionId) {
      return NextResponse.json({ message: "A production is required." }, { status: 400 });
    }

    const production = await runScriptEditorAutomation(body.productionId, body.action === "retry" ? "retry" : "sync");
    return NextResponse.json({ production });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Script automation could not be completed." },
      { status: 500 }
    );
  }
}
