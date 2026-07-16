import {NextRequest,NextResponse} from "next/server";
import {getKnowledgeQualityStatus,runAutonomousKnowledgeQualityCycle} from "@/lib/autonomous-knowledge-quality-engine";

export const dynamic="force-dynamic";

function failure(error:unknown){const message=error instanceof Error?error.message:"Autonomous knowledge quality operation failed.";console.error("knowledge.quality.autonomy.failed",{name:error instanceof Error?error.name:"Unknown",message});return NextResponse.json({error:{code:"QUALITY_AUTONOMY_ERROR",message,retryable:true}},{status:500,headers:{"Cache-Control":"no-store"}});}

export async function GET(){try{return NextResponse.json(await getKnowledgeQualityStatus(),{headers:{"Cache-Control":"no-store"}});}catch(error){return failure(error);}}

export async function POST(request:NextRequest){try{const token=process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;const internal=Boolean(token)&&request.headers.get("x-cacsms-internal")===token;if(!internal)return NextResponse.json({error:{code:"QUALITY_AUTONOMY_INTERNAL_ONLY",message:"Knowledge quality operations are scheduler-owned and accept no operator mutations."}},{status:403});const body=await request.json().catch(()=>({})) as {action?:string};if(body.action!=="run")return NextResponse.json({error:{code:"VALIDATION_ERROR",message:"Only autonomous quality cycles are supported."}},{status:400});const result=await runAutonomousKnowledgeQualityCycle("scheduler",true);return NextResponse.json({result,status:await getKnowledgeQualityStatus()},{headers:{"Cache-Control":"no-store"}});}catch(error){return failure(error);}}
