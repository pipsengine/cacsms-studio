import {NextResponse} from "next/server";
import {getScoringData,runScoring,saveScoringWeights} from "@/lib/gap-scoring-data";
import type {ScoringWeight} from "@/types/gap-scoring";
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(await getScoringData());}catch(error){console.error(error);return NextResponse.json({message:(error as Error).message},{status:500});}}
export async function PATCH(request:Request){try{const body=await request.json() as {weights:ScoringWeight[]};await saveScoringWeights(body.weights);return NextResponse.json({status:"ok"});}catch(error){return NextResponse.json({message:(error as Error).message},{status:400});}}
export async function POST(){try{return NextResponse.json(await runScoring());}catch(error){console.error(error);return NextResponse.json({message:(error as Error).message},{status:500});}}
