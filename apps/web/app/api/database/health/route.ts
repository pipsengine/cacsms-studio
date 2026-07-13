import { NextResponse } from "next/server";
import { getDatabaseHealth } from "@/lib/database/mssql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getDatabaseHealth();
  return NextResponse.json(health, {
    status: health.status === "connected" ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
