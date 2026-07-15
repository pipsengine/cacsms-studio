import { NextRequest, NextResponse } from "next/server";
import { KnowledgeValidationError, updateKnowledgeRecord } from "@/lib/knowledge-universe-data";

export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}) { try { const {id}=await params; return NextResponse.json(await updateKnowledgeRecord(id,await request.json())); } catch(error) { const validation=error instanceof KnowledgeValidationError; return NextResponse.json({error:{code:validation?"VALIDATION_ERROR":"DATABASE_ERROR",message:validation?error.message:"The record could not be updated.",field:validation?error.field:undefined,retryable:!validation}},{status:validation?400:500}); } }
