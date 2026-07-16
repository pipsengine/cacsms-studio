import {NextRequest,NextResponse} from "next/server";
import {getKnowledgeAutonomyStatus,runAutonomousKnowledgeCycle} from "@/lib/autonomous-knowledge-engine";

export const dynamic="force-dynamic";

function failure(error:unknown){
  const message=error instanceof Error?error.message:"Autonomous knowledge operation failed.";
  console.error("knowledge.autonomy.failed",{name:error instanceof Error?error.name:"Unknown",message});
  return NextResponse.json({error:{code:"AUTONOMY_ERROR",message,retryable:true}},{status:500,headers:{"Cache-Control":"no-store"}});
}

export async function GET(){
  try{return NextResponse.json(await getKnowledgeAutonomyStatus(),{headers:{"Cache-Control":"no-store"}});}catch(error){return failure(error);}
}

export async function POST(request:NextRequest){
  try{
    const internalToken=process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;
    const internal=Boolean(internalToken)&&request.headers.get("x-cacsms-internal")===internalToken;
    if(!internal)return NextResponse.json({error:{code:"AUTONOMY_INTERNAL_ONLY",message:"Autonomy cycles are scheduler-owned and accept no operator actions."}},{status:403});
    const body=await request.json().catch(()=>({})) as {action?:string};
    if(body.action!=="run")return NextResponse.json({error:{code:"VALIDATION_ERROR",message:"The internal scheduler supports only autonomous cycles."}},{status:400});
    const result=await runAutonomousKnowledgeCycle("scheduler",true);
    return NextResponse.json({result,status:await getKnowledgeAutonomyStatus()},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return failure(error);}
}
