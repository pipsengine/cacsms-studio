import { NextResponse } from "next/server";
import { contentTypeDefinitions, navigationModules, productionPipeline } from "@cacsms/contracts";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "cacsms-studio",
    port: Number(process.env.CACSMS_PUBLIC_PORT ?? 3008),
    productionTypes: contentTypeDefinitions.length,
    modules: navigationModules.length,
    pipelineStages: productionPipeline.length
  });
}
