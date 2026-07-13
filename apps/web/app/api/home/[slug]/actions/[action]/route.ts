import { NextResponse } from "next/server";
import { homeOperationalPages } from "@/lib/home-operational-pages";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string; action: string }> }) {
  const { slug, action } = await params;
  if (!homeOperationalPages[slug]) return NextResponse.json({ message: "Home page endpoint not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { entityId?: string };
  return NextResponse.json({ success: true, operationId: crypto.randomUUID(), slug, action, entityId: body.entityId ?? null, status: "queued" }, { status: 202 });
}
