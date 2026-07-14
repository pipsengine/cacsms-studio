import {NextResponse} from "next/server";
import {homeOperationalPages} from "@/lib/home-operational-pages";
import {getOperationalData} from "@/lib/home-operational-data";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const{slug}=await params,correlationId=crypto.randomUUID();if(!homeOperationalPages[slug])return NextResponse.json({message:"Home page endpoint not found.",correlationId},{status:404});try{return NextResponse.json(await getOperationalData(slug),{headers:{"x-correlation-id":correlationId,"Cache-Control":"no-store"}})}catch(error){return NextResponse.json({message:(error as Error).message,correlationId},{status:500})}}
