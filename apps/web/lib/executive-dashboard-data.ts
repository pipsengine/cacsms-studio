import { contentTypeDefinitions, navigationModules, productionPipeline } from "@cacsms/contracts";
import type { ExecutiveDashboardData, MetricCard, StatusTone } from "@/types/executive-dashboard";

const metricLabels = [
  "Active Productions",
  "Productions Completed",
  "Productions at Risk",
  "Awaiting Approval",
  "Active AI Agents",
  "Running Automations",
  "Rendering Jobs",
  "Scheduled Publications",
  "Failed Jobs",
  "Compliance Exceptions",
  "Est. Production Cost",
  "Platform Health Score"
];

export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    platform: {
      status: "Running",
      autonomousMode: "Fully Autonomous",
      currentOperation: "Monitoring studio readiness",
      currentStage: "Executive overview",
      stageProgress: `${productionPipeline.length} / ${productionPipeline.length}`,
      activeProductions: 0,
      runningWorkflows: 0,
      activeAgents: 0,
      renderingJobs: 0,
      publishingJobs: 0,
      criticalExceptions: 0,
      lastHealthCheck: formatHealthTime(generatedAt)
    },
    metrics: buildMetrics(),
    portfolio: [
      { label: "Draft", value: 0, percent: 0 },
      { label: "In Production", value: 0, percent: 0 },
      { label: "Review", value: 0, percent: 0 },
      { label: "Ready to Publish", value: 0, percent: 0 }
    ],
    pipeline: productionPipeline.map((stage) => ({
      key: stage.id,
      label: stage.label,
      count: 0,
      atRisk: 0
    })),
    throughput: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      created: [0, 0, 0, 0, 0, 0, 0],
      completed: [0, 0, 0, 0, 0, 0, 0],
      published: [0, 0, 0, 0, 0, 0, 0],
      failed: [0, 0, 0, 0, 0, 0, 0]
    },
    agents: {
      total: 0,
      active: 0,
      idle: 0,
      busy: 0,
      degraded: 0,
      failed: 0,
      top: []
    },
    publishing: ["YouTube", "Facebook", "Instagram", "LinkedIn"].map((channel) => ({
      channel,
      status: "Not connected",
      scheduled: 0,
      ready: 0,
      failed: 0,
      lastPublished: "None",
      nextPublish: "None"
    })),
    quality: {
      totalIssues: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      areas: [
        { label: "Content QA", score: 0 },
        { label: "Fact Verification", score: 0 },
        { label: "Copyright Review", score: 0 },
        { label: "Platform Compliance", score: 0 }
      ]
    },
    deadlines: {
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      dueNextWeek: 0,
      estimatedCost: "$0.00",
      budgetUtilization: 0,
      costTrend: [0, 0, 0, 0, 0, 0, 0]
    },
    exceptions: [],
    activity: [
      {
        title: "Executive dashboard initialized",
        subtitle: `${navigationModules.length} modules, ${contentTypeDefinitions.length} production types, and ${productionPipeline.length} pipeline stages loaded.`,
        time: "Now",
        tone: "info"
      }
    ],
    systemHealth: [
      { service: "Next.js Runtime", status: "Operational" },
      { service: "Contracts Package", status: "Operational" },
      { service: "API Services", status: "Local health only" },
      { service: "Database", status: "Not configured" },
      { service: "Queue Services", status: "Not configured" },
      { service: "Rendering Services", status: "Not configured" },
      { service: "Publishing Services", status: "Not connected" }
    ]
  };
}

function buildMetrics(): MetricCard[] {
  return metricLabels.map((label, index) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    value: metricValue(label),
    delta: "0%",
    deltaDirection: "flat",
    tone: metricTone(index),
    sparkline: [0, 0, 0, 0, 0, 0, 0]
  }));
}

function metricValue(label: string) {
  if (label === "Platform Health Score") return "Config OK";
  if (label === "Est. Production Cost") return "$0.00";
  return "0";
}

function metricTone(index: number): StatusTone {
  if ([2, 8, 9].includes(index)) return "danger";
  if ([3, 6, 7].includes(index)) return "warning";
  if ([4, 5, 11].includes(index)) return "info";
  return "success";
}

function formatHealthTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
