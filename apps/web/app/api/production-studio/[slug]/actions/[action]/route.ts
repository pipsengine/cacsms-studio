import { NextResponse } from "next/server";
export async function POST(request:Request,{params}:{params:Promise<{slug:string;action:string}>}){const {slug,action}=await params;const body=await request.json().catch(()=>({}));return NextResponse.json({success:true,operationId:crypto.randomUUID(),slug,action,entityId:body.entityId??null,status:"queued"},{status:202})}
