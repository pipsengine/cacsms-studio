import { NextResponse } from "next/server";
import {
  getProductionLifecycleSnapshot,
  saveProductionLifecycleSettings
} from "@/lib/production-lifecycle-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getProductionLifecycleSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("production-lifecycle.read.failed", error);
    return NextResponse.json({ message: "Unable to load production lifecycle." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      autoAdvance?: boolean;
      currentStageId?: string;
    };
    const settings = await saveProductionLifecycleSettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("production-lifecycle.settings.failed", error);
    return NextResponse.json({ message: "Unable to save lifecycle settings." }, { status: 500 });
  }
}
