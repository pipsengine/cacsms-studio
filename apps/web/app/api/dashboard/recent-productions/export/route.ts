import { exportRecentProductionsCsv, parseRecentProductionsQuery } from "@/lib/recent-productions-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseRecentProductionsQuery(searchParams);
    const csv = await exportRecentProductionsCsv(query);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="recent-productions.csv"'
      }
    });
  } catch (error) {
    console.error("recent-productions.export.failed", error);
    return Response.json({ message: "Unable to export recent productions." }, { status: 500 });
  }
}
