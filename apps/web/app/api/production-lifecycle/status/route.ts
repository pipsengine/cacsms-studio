import { NextResponse } from "next/server";
import { getLifecycleStatus } from "@/lib/production-lifecycle-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getLifecycleStatus());
  } catch (error) {
    console.error("production-lifecycle.status.failed", error);
    return NextResponse.json({ message: "Unable to load lifecycle status." }, { status: 500 });
  }
}
