import { NextResponse } from "next/server";

import { getRecentProductionsData, parseRecentProductionsQuery } from "@/lib/recent-productions-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseRecentProductionsQuery(searchParams);
    const data = await getRecentProductionsData(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error("recent-productions.dashboard.failed", error);
    return NextResponse.json({ message: "Unable to load recent productions." }, { status: 500 });
  }
}
