import { NextResponse } from "next/server";
import { getDatabaseHealth } from "@/lib/database/mssql";
import { homeOperationalPages } from "@/lib/home-operational-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = homeOperationalPages[slug];
  const correlationId = crypto.randomUUID();
  if (!config) return NextResponse.json({ message: "Home page endpoint not found.", correlationId }, { status: 404 });

  if (slug === "system-health") {
    const database = await getDatabaseHealth();
    const healthy = database.status === "connected";
    return NextResponse.json({
      generatedAt: database.checkedAt,
      metrics: [
        { key: "platform-health", label: "Platform Health Score", value: healthy ? "100%" : "0%", trend: "flat" },
        { key: "healthy-services", label: "Healthy Services", value: healthy ? 1 : 0, trend: "flat" },
        { key: "degraded-services", label: "Degraded Services", value: 0, trend: "flat" },
        { key: "offline-services", label: "Offline Services", value: healthy ? 0 : 1, trend: "flat" },
        { key: "open-incidents", label: "Open Incidents", value: healthy ? 0 : 1, trend: "flat" },
        { key: "average-latency", label: "Average Latency", value: `${database.latencyMs} ms`, trend: "flat" }
      ],
      rows: [{
        id: "mssql-primary",
        title: "Microsoft SQL Server",
        subtitle: database.database,
        status: healthy ? "healthy" : "offline",
        values: {
          category: "Database",
          latency: `${database.latencyMs} ms`,
          uptime: healthy ? "Connected" : "Unavailable",
          lastchecked: new Date(database.checkedAt).toLocaleString(),
          message: database.message
        }
      }],
      panels: {
        "Open Incidents": healthy ? [] : [{ id: "mssql-offline", title: "MSSQL unavailable", subtitle: database.message, status: "offline" }],
        "Latest Checks": [{ id: "mssql-check", title: "MSSQL connection", subtitle: database.database, value: `${database.latencyMs} ms`, status: healthy ? "healthy" : "offline" }]
      },
      total: 1,
      page: 1,
      pageSize: 20
    }, { headers: { "x-correlation-id": correlationId, "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: config.metricLabels.map((label, index) => ({
      key: `${slug}-${index}`,
      label,
      value: /score|success|utilization/i.test(label) ? "0%" : 0,
      trend: "flat"
    })),
    rows: [],
    panels: {},
    total: 0,
    page: 1,
    pageSize: 20
  }, { headers: { "x-correlation-id": correlationId, "Cache-Control": "no-store" } });
}
