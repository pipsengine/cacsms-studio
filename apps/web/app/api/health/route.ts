import { NextResponse } from "next/server";
import { contentTypeDefinitions, navigationModules, productionPipeline } from "@cacsms/contracts";
import { getDatabaseHealth } from "@/lib/database/mssql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await getDatabaseHealth();
  return NextResponse.json({
    status: database.status === "connected" ? "ok" : "degraded",
    service: "cacsms-studio",
    port: Number(process.env.CACSMS_PUBLIC_PORT ?? 3008),
    database,
    productionTypes: contentTypeDefinitions.length,
    modules: navigationModules.length,
    pipelineStages: productionPipeline.length
  });
}
