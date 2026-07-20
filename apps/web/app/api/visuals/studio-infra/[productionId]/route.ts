import { NextResponse } from "next/server";
import { getVisualStudioInfrastructureProductionDetail } from "@/lib/visual-studio-infra-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ productionId: string }> }) {
  const { productionId } = await params;
  try {
    return NextResponse.json(await getVisualStudioInfrastructureProductionDetail(productionId), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Visual infrastructure detail unavailable." },
      { status: 500 }
    );
  }
}
