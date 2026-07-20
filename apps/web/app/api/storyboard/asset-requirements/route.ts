import { NextResponse } from "next/server";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
import { getAssetRequirementsWorkspaceData } from "@/lib/storyboard-asset-requirements-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAssetRequirementsWorkspaceData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Asset requirements data unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireMutationAccess(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await getAssetRequirementsWorkspaceData(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Asset requirement sync failed." },
      { status: 500 }
    );
  }
}
