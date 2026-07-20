import { NextResponse } from "next/server";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import { getVisualStudioInfrastructureData } from "@/lib/visual-studio-infra-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getVisualStudioInfrastructureData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Visual infrastructure data unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAccess(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await getVisualStudioInfrastructureData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Visual infrastructure sync failed." },
      { status: 500 }
    );
  }
}
