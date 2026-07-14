import { NextResponse } from "next/server";
import { getOperationalPage, isOperationalSlug, mutateOperationalPage } from "@/lib/opportunity-operations-data";
import type { OperationalMutation } from "@/types/opportunity-operations";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "The operational request failed.";
  return NextResponse.json({ message }, { status: /required|unsupported/i.test(message) ? 400 : 500 });
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  try { const {slug}=await context.params; if(!isOperationalSlug(slug)) return NextResponse.json({message:"Page not found."},{status:404}); return NextResponse.json(await getOperationalPage(slug)); }
  catch(error){ return errorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try { const {slug}=await context.params; const body=await request.json() as OperationalMutation; await mutateOperationalPage(slug,body); return NextResponse.json(await getOperationalPage(slug)); }
  catch(error){ return errorResponse(error); }
}
