import {NextResponse} from "next/server";
import {createGapOpportunity,getGapData,runGapScan} from "@/lib/gap-scoring-data";
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(await getGapData());}catch(error){console.error(error);return NextResponse.json({message:(error as Error).message},{status:500});}}
export async function POST(request:Request){try{const body=await request.json();if(body.action==="scan")return NextResponse.json(await runGapScan(),{status:201});if(body.action==="create-opportunity"&&body.id)return NextResponse.json(await createGapOpportunity(body.id),{status:201});return NextResponse.json({message:"Unsupported action."},{status:400});}catch(error){console.error(error);return NextResponse.json({message:(error as Error).message},{status:500});}}
