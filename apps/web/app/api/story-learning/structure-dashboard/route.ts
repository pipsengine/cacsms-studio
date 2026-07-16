import {NextResponse} from "next/server";
import {getStoryStructureDashboard,runAutonomousStoryStructureCycle} from "@/lib/autonomous-story-structure-engine";

function failure(error:unknown){return NextResponse.json({message:error instanceof Error?error.message:"Structure autonomy request failed."},{status:500});}
export async function GET(){try{return NextResponse.json(await getStoryStructureDashboard());}catch(error){return failure(error);}}
export async function POST(request:Request){try{const token=process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;const internal=Boolean(token)&&request.headers.get("x-cacsms-internal")===token;if(!internal)return NextResponse.json({message:"Story structure operations are scheduler-owned and accept no operator mutations."},{status:403});await runAutonomousStoryStructureCycle("scheduler",true);return NextResponse.json(await getStoryStructureDashboard());}catch(error){return failure(error);}}
