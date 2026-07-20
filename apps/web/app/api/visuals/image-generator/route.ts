import { NextResponse } from "next/server";
import fs from "node:fs";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import {
  acknowledgeImageAssetLoad,
  getImageGeneratorData,
  markImageAssetLoadFailure,
  runImageGenerationScheduler
} from "@/lib/image-generator-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// #region debug-point B:image-route-report
function reportImageRouteDebug(hypothesisId: "A" | "B" | "C" | "D" | "E", location: string, msg: string, data: Record<string, unknown>) {
  let url = "http://127.0.0.1:7777/event";
  let sessionId = "image-gen-stall";
  try {
    const env = fs.readFileSync(".dbg/image-gen-stall.env", "utf8");
    url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || url;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
  } catch {}
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, runId: "pre-fix", hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() })
  }).catch(() => {});
}
// #endregion

export async function GET() {
  try {
    return NextResponse.json(await getImageGeneratorData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Image generator data unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAccess(request);
  // #region debug-point B:mutation-access
  reportImageRouteDebug("B", "api/visuals/image-generator/route.ts:POST", "image-generator POST entry", {
    denied: Boolean(denied),
    hasInternalHeader: Boolean(request.headers.get("x-cacsms-internal")),
    contentType: request.headers.get("content-type") || null
  });
  // #endregion
  if (denied) {
    // #region debug-point B:mutation-denied
    reportImageRouteDebug("B", "api/visuals/image-generator/route.ts:POST", "mutation access denied", {});
    // #endregion
    return denied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "scheduler" | "acknowledge-load" | "report-load-failure";
      productionId?: string;
      assetId?: string;
      variantId?: string;
      reason?: string;
    };

    // #region debug-point B:route-body
    reportImageRouteDebug("B", "api/visuals/image-generator/route.ts:POST", "image-generator action parsed", {
      action: body.action ?? null,
      productionId: body.productionId ?? null,
      assetId: body.assetId ?? null,
      variantId: body.variantId ?? null
    });
    // #endregion

    if (body.action === "scheduler") {
      return NextResponse.json(await runImageGenerationScheduler(), {
        headers: { "Cache-Control": "no-store" }
      });
    }

    if (body.action === "acknowledge-load") {
      if (!body.productionId || !body.assetId || !body.variantId) {
        return NextResponse.json(
          { message: "productionId, assetId, and variantId are required to acknowledge an image load." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        await acknowledgeImageAssetLoad(body.productionId, body.assetId, body.variantId),
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.action === "report-load-failure") {
      if (!body.productionId || !body.assetId || !body.variantId || !body.reason?.trim()) {
        return NextResponse.json(
          { message: "productionId, assetId, variantId, and reason are required to report an image load failure." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        await markImageAssetLoadFailure(body.productionId, body.assetId, body.variantId, body.reason.trim()),
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ message: "Unsupported image generator action." }, { status: 400 });
  } catch (error) {
    // #region debug-point B:route-error
    reportImageRouteDebug("B", "api/visuals/image-generator/route.ts:POST", "image-generator route threw", {
      error: error instanceof Error ? error.message : "unknown-error"
    });
    // #endregion
    return NextResponse.json({ message: error instanceof Error ? error.message : "Image generation automation could not be completed." }, {
      status: 500
    });
  }
}
