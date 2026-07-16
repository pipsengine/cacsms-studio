import { NextResponse } from "next/server";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import {
  acknowledgeImageAssetLoad,
  getImageGeneratorData,
  markImageAssetLoadFailure,
  runImageGenerationScheduler
} from "@/lib/image-generator-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const denied = requireMutationAccess(request);
  if (denied) {
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
    return NextResponse.json({ message: error instanceof Error ? error.message : "Image generation automation could not be completed." }, {
      status: 500
    });
  }
}
