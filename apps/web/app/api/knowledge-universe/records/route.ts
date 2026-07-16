import { NextRequest, NextResponse } from "next/server";
import { archiveKnowledgeRecords, createKnowledgeRecord, KnowledgeValidationError, listKnowledgeRecords } from "@/lib/knowledge-universe-data";
import { requireMutationAccess } from "@/app/api/_utils/write-access";

function failure(error:unknown) { const validation=error instanceof KnowledgeValidationError; console.error("knowledge.records.failed",{name:error instanceof Error?error.name:"Unknown"}); return NextResponse.json({error:{code:validation?"VALIDATION_ERROR":"DATABASE_ERROR",message:validation?error.message:"The knowledge service could not complete the request.",field:validation?error.field:undefined,retryable:!validation}},{status:validation?400:500}); }

export async function GET(request:NextRequest) { try { const params=request.nextUrl.searchParams; return NextResponse.json(await listKnowledgeRecords({type:params.get("type")||undefined,search:params.get("search")||undefined,status:params.get("status")||undefined,domain:params.get("domain")||undefined,sort:params.get("sort")||undefined,page:Number(params.get("page")||1),pageSize:Number(params.get("pageSize")||25)})); } catch(error) { return failure(error); } }
export async function POST(request:NextRequest) { const denied=requireMutationAccess(request); if(denied) return denied; try { return NextResponse.json(await createKnowledgeRecord(await request.json()),{status:201}); } catch(error) { return failure(error); } }
export async function DELETE(request:NextRequest) { const denied=requireMutationAccess(request); if(denied) return denied; try { const body=await request.json() as {ids?:string[]}; return NextResponse.json(await archiveKnowledgeRecords(Array.isArray(body.ids)?body.ids:[])); } catch(error) { return failure(error); } }
