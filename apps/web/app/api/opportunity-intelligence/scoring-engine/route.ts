import {NextResponse} from "next/server";
import {getScoringData} from "@/lib/gap-scoring-data";
import {runAutonomousOpportunityScoringCycle} from "@/lib/autonomous-opportunity-scoring-engine";
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(await getScoringData());}catch(error){console.error(error);return NextResponse.json({message:(error as Error).message},{status:500});}}
export async function PATCH(){return NextResponse.json({message:"The adaptive scoring policy is engine-owned and accepts no operator changes."},{status:403});}
export async function POST(request:Request){try{const token=process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;const internal=Boolean(token)&&request.headers.get("x-cacsms-internal")===token;if(!internal)return NextResponse.json({message:"Scoring cycles are scheduler-owned and accept no operator actions."},{status:403});const result=await runAutonomousOpportunityScoringCycle("scheduler",true);return NextResponse.json({result,data:await getScoringData()});}catch(error){console.error(error);return NextResponse.json({message:(error as Error).message},{status:500});}}
