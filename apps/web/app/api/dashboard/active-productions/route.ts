import { NextResponse } from "next/server";

import { getActiveProductionsData, parseActiveProductionsQuery } from "@/lib/active-productions-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseActiveProductionsQuery(searchParams);
    const data = await getActiveProductionsData(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error("active-productions.dashboard.failed", error);
    return NextResponse.json({ message: "Unable to load active productions." }, { status: 500 });
  }
}
