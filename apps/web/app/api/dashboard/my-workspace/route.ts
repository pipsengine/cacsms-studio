import { NextResponse } from "next/server";
import { getMyWorkspaceData } from "@/lib/my-workspace-data";

export async function GET() {
  const data = await getMyWorkspaceData();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
