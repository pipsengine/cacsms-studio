import {NextResponse} from "next/server";
import {contentIntelligencePages} from "@/lib/content-intelligence-pages";
import {createContentIntelligenceRecord,getContentIntelligenceData} from "@/lib/content-intelligence-data";
export const dynamic="force-dynamic";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!contentIntelligencePages[slug])return NextResponse.json({message:"Page not found."},{status:404});try{return NextResponse.json(await getContentIntelligenceData(slug));}catch(error){return NextResponse.json({message:(error as Error).message},{status:500});}}
export async function POST(_:Request,{params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!contentIntelligencePages[slug])return NextResponse.json({message:"Page not found."},{status:404});try{return NextResponse.json(await createContentIntelligenceRecord(slug),{status:201});}catch(error){return NextResponse.json({message:(error as Error).message},{status:500});}}
