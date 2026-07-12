import { exportActiveProductionsCsv, parseActiveProductionsQuery } from "@/lib/active-productions-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseActiveProductionsQuery(searchParams);
    const csv = await exportActiveProductionsCsv(query);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="active-productions.csv"'
      }
    });
  } catch (error) {
    console.error("active-productions.export.failed", error);
    return Response.json({ message: "Unable to export active productions." }, { status: 500 });
  }
}
