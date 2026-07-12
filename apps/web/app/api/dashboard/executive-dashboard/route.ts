import { NextResponse } from "next/server";
import { getExecutiveDashboardData } from "@/lib/executive-dashboard-data";

export async function GET() {
  const data = await getExecutiveDashboardData();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
