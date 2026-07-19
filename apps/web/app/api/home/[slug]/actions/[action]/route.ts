import { NextResponse } from "next/server";
import { homeOperationalPages } from "@/lib/home-operational-pages";
import {runOperationalAction} from "@/lib/home-operational-data";
import { requireMutationAccess } from "@/app/api/_utils/write-access";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string; action: string }> }) {
  const denied = await requireMutationAccess(request, "production.write");
  if (denied) return denied;
  const { slug, action } = await params;
  if (!homeOperationalPages[slug]) return NextResponse.json({ message: "Home page endpoint not found." }, { status: 404 });
  await request.json().catch(() => ({}));
  try{return NextResponse.json(await runOperationalAction(slug,action));}catch(error){return NextResponse.json({message:(error as Error).message},{status:500});}
}
