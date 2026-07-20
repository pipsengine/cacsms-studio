import { NextResponse } from "next/server";
import {
  getVisualStudioInfrastructureModeCollection,
  VISUAL_INFRA_MODES,
  type VisualInfraMode
} from "@/lib/visual-studio-infra-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!VISUAL_INFRA_MODES.includes(mode as VisualInfraMode)) {
    return NextResponse.json({ message: "Visual infrastructure mode not found." }, { status: 404 });
  }
  try {
    return NextResponse.json(await getVisualStudioInfrastructureModeCollection(mode as VisualInfraMode), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Visual infrastructure mode collection unavailable." },
      { status: 500 }
    );
  }
}
