import { NextResponse } from "next/server";
import { createDiscoveredOpportunity, getOpportunityDashboard, updateOpportunity } from "@/lib/opportunity-intelligence-data";
import { requireMutationAccess } from "@/app/api/_utils/write-access";
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(await getOpportunityDashboard());}catch(error){console.error("opportunity.dashboard.read.failed",error);return NextResponse.json({message:"Unable to load opportunity dashboard."},{status:500});}}
export async function POST(request:Request){const denied=await requireMutationAccess(request,"opportunity.write");if(denied)return denied;try{const body=await request.json();if(body.action==="discover")return NextResponse.json(await createDiscoveredOpportunity(),{status:201});if((body.action==="open"||body.action==="initiative")&&body.id){await updateOpportunity(body.id,body.action);return NextResponse.json({status:"ok"});}return NextResponse.json({message:"Unsupported action."},{status:400});}catch(error){console.error("opportunity.dashboard.write.failed",error);return NextResponse.json({message:"Unable to update opportunity."},{status:500});}}
