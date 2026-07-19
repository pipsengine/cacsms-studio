import { NextResponse } from "next/server";
import { getLifecycleSettings, saveLifecycleSettings } from "@/lib/production-lifecycle-data";
import { requireMutationAccess } from "@/app/api/_utils/write-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getLifecycleSettings());
  } catch (error) {
    console.error("production-lifecycle.settings.read.failed", error);
    return NextResponse.json({ message: "Unable to load lifecycle settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireMutationAccess(request, "lifecycle.settings");
  if (denied) return denied;
  try {
    const body = (await request.json()) as { autoAdvanceEnabled?: boolean; manualApprovalRequired?: boolean };
    return NextResponse.json(await saveLifecycleSettings(body));
  } catch (error) {
    console.error("production-lifecycle.settings.write.failed", error);
    return NextResponse.json({ message: "Unable to save lifecycle settings." }, { status: 500 });
  }
}
