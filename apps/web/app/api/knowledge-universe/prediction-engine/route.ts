import {NextResponse} from "next/server";
import {getPredictionEngineData} from "@/lib/prediction-engine-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPredictionEngineData());
  } catch (error) {
    console.error("prediction-engine.failed", error);
    return NextResponse.json({message: (error as Error).message}, {status: 500});
  }
}
