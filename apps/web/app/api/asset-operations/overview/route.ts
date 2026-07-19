import { NextResponse } from "next/server";
import { getAssetOperationsOverview } from "@/lib/asset-operations-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAssetOperationsOverview(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Asset operations overview unavailable." },
      { status: 500 }
    );
  }
}
