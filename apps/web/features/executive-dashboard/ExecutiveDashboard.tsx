"use client";

import type React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Facebook,
  Film,
  HeartPulse,
  Instagram,
  Linkedin,
  RefreshCw,
  Search,
  ShieldCheck,
  Workflow,
  XCircle,
  Youtube
} from "lucide-react";
import type { ExecutiveDashboardData, MetricCard, StatusTone } from "@/types/executive-dashboard";
import styles from "./ExecutiveDashboard.module.css";

const metricIcons = [
  Workflow,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Bot,
  Activity,
  Film,
  CalendarDays,
  XCircle,
  ShieldCheck,
  CircleDollarSign,
  HeartPulse
];

function toneClass(tone: StatusTone) {
  return styles[`tone_${tone}`] ?? styles.tone_neutral;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${28 - ((value - min) / range) * 24}`).join(" ");

  return (
    <svg className={styles.sparkline} viewBox="0 0 100 32" role="img" aria-label="Metric trend">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function KpiCard({ metric, index }: { metric: MetricCard; index: number }) {
  const Icon = metricIcons[index % metricIcons.length];

  return (
    <article className={styles.kpiCard}>
      <div className={`${styles.iconTile} ${toneClass(metric.tone)}`}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className={styles.kpiBody}>
        <div className={styles.kpiLabel}>{metric.label}</div>
        <div className={styles.kpiValueRow}>
          <strong>{metric.value}</strong>
          <span className={metric.deltaDirection === "down" ? styles.deltaDown : styles.deltaUp}>{metric.delta}</span>
        </div>
        <div className={styles.kpiFoot}>
          <span>{metric.context}</span>
          <Sparkline values={metric.sparkline} />
        </div>
      </div>
    </article>
  );
}

function Donut({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className={`${styles.donut}${safeValue === 0 ? ` ${styles.emptyDonut}` : ""}`} style={{ "--value": `${safeValue * 3.6}deg` } as React.CSSProperties}>
      <div>
        <strong>{label}</strong>
        <span>Total</span>
      </div>
    </div>
  );
}

function LineChart({ data }: { data: ExecutiveDashboardData["throughput"] }) {
  if (!data.labels.length) return <EmptyState>No throughput records exist for the selected period.</EmptyState>;
  const width = 600;
  const height = 190;
  const all = [...data.created, ...data.completed, ...data.published, ...data.failed];
  const max = Math.max(...all, 1);
  const makePoints = (values: number[]) => values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * width},${height - (value / max) * (height - 20)}`).join(" ");

  return (
    <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Content throughput chart">
      {[0, 1, 2, 3].map((index) => (
        <line key={index} x1="0" x2={width} y1={index * 55 + 10} y2={index * 55 + 10} className={styles.gridLine} />
      ))}
      <polyline points={makePoints(data.created)} className={styles.seriesCreated} />
      <polyline points={makePoints(data.completed)} className={styles.seriesCompleted} />
      <polyline points={makePoints(data.published)} className={styles.seriesPublished} />
      <polyline points={makePoints(data.failed)} className={styles.seriesFailed} />
    </svg>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const key = channel.toLowerCase();
  if (key.includes("youtube")) return <Youtube size={15} aria-hidden="true" />;
  if (key.includes("facebook")) return <Facebook size={15} aria-hidden="true" />;
  if (key.includes("instagram")) return <Instagram size={15} aria-hidden="true" />;
  if (key.includes("linkedin")) return <Linkedin size={15} aria-hidden="true" />;
  return <Activity size={15} aria-hidden="true" />;
}

function PanelAction({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href}>{children} -&gt;</Link>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyState}>{children}</div>;
}

export function ExecutiveDashboard({ data: initialData }: { data: ExecutiveDashboardData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const portfolioTotal = data.portfolio.reduce((sum, item) => sum + item.value, 0);
  const pipelineTotal = data.pipeline.reduce((sum, item) => sum + item.count, 0);
  const completedTotal = data.portfolio.filter((item) => ["Completed", "Published"].includes(item.label)).reduce((sum, item) => sum + item.value, 0);
  const inProgressPercent = pipelineTotal ? Math.round(data.platform.activeProductions / pipelineTotal * 100) : 0;
  const completedPercent = pipelineTotal ? Math.round(completedTotal / pipelineTotal * 100) : 0;
  const agentActivePercent = data.agents.total ? Math.round(data.agents.active / data.agents.total * 100) : 0;
  const qualityRiskPercent = data.quality.totalIssues ? Math.round((data.quality.critical + data.quality.high) / data.quality.totalIssues * 100) : 0;

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...data.metrics.map((item) => ({ label: item.label, detail: item.value, href: "#executive-metrics" })),
      ...data.pipeline.map((item) => ({ label: item.label, detail: `${item.count} productions`, href: "#production-pipeline-summary" })),
      ...data.activity.map((item) => ({ label: item.title, detail: item.subtitle, href: "#recent-executive-activity" })),
      ...data.systemHealth.map((item) => ({ label: item.service, detail: item.status, href: "#system-health-summary" }))
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 12);
  }, [data, searchQuery]);

  async function loadDashboard(filters: { workspace?: string; brand?: string; period?: number } = {}) {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        workspace: filters.workspace ?? data.filters.workspaceId,
        period: String(filters.period ?? data.filters.periodDays)
      });
      const selectedBrand = filters.brand === undefined ? data.filters.brandId : filters.brand;
      if (selectedBrand) params.set("brand", selectedBrand);
      const response = await fetch(`/api/dashboard/executive-dashboard?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to refresh the dashboard.");
      setData(await response.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="executive-dashboard-title">
      <header className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            Home <span>/</span> Executive Dashboard
          </div>
          <h1 id="executive-dashboard-title">Executive Dashboard</h1>
          <p>Monitor autonomous production, content performance, AI activity, publishing readiness, operational risks, and overall platform health.</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.selectButton}>Workspace
            <select value={data.filters.workspaceId} onChange={(event) => void loadDashboard({ workspace: event.target.value, brand: "" })} disabled={loading}>
              {data.filters.workspaces.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className={styles.selectButton}>Brand
            <select value={data.filters.brandId ?? ""} onChange={(event) => void loadDashboard({ brand: event.target.value })} disabled={loading}>
              <option value="">All brands</option>
              {data.filters.brands.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className={styles.selectButton}>Current period
            <select value={data.filters.periodDays} onChange={(event) => void loadDashboard({ period: Number(event.target.value) })} disabled={loading}>
              <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
            </select>
          </label>
          <button className={styles.iconButton} type="button" onClick={() => void loadDashboard()} aria-label="Refresh" disabled={loading}>
            <RefreshCw size={17} aria-hidden="true" />
          </button>
          <button className={styles.iconButton} type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="Search dashboard">
            <Search size={17} aria-hidden="true" />
          </button>
          {searchOpen ? <div className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search metrics, stages, activity, or services…" />
            {searchQuery ? <div className={styles.searchResults}>{searchResults.length ? searchResults.map((item, index) => <a href={item.href} key={`${item.label}-${index}`} onClick={() => setSearchOpen(false)}><strong>{item.label}</strong><span>{item.detail}</span></a>) : <span>No dashboard matches found.</span>}</div> : null}
          </div> : null}
        </div>
      </header>

      {message ? <div className={styles.feedback} role="status">{message}</div> : null}

      <section className={styles.commandBar} aria-label="Executive command summary">
        <div className={styles.commandCell}>
          <span className={styles.statusPill} data-status={data.platform.status}>{data.platform.status}</span>
          <small>Platform Status</small>
        </div>
        <div className={styles.commandCell}><small>Autonomous Mode</small><strong title={data.platform.autonomousMode}>{data.platform.autonomousMode}</strong></div>
        <div className={styles.commandCell}><small>Current Operation</small><strong title={data.platform.currentOperation}>{data.platform.currentOperation}</strong></div>
        <div className={styles.commandCell}><small>Current Stage</small><strong title={data.platform.currentStage}>{data.platform.currentStage}</strong><div className={styles.progress}><span style={{ width: `${data.platform.stageProgressPercent}%` }} /></div></div>
        <div className={styles.commandStat}><strong>{data.platform.stageProgress}</strong></div>
        {[
          ["Active Productions", data.platform.activeProductions],
          ["Running Workflows", data.platform.runningWorkflows],
          ["Active Agents", data.platform.activeAgents],
          ["Rendering Jobs", data.platform.renderingJobs],
          ["Publishing Jobs", data.platform.publishingJobs],
          ["Critical Exceptions", data.platform.criticalExceptions]
        ].map(([label, value]) => (
          <div className={styles.commandStat} key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
        <div className={styles.commandStat}><small>Last Health Check</small><strong>{data.platform.lastHealthCheck}</strong></div>
        <div className={styles.runActions}>
          <span><ShieldCheck size={14} aria-hidden="true" />Runtime controlled by sticky system bar</span>
        </div>
      </section>

      <section className={styles.kpiGrid} id="executive-metrics" aria-label="Executive metrics">
        {data.metrics.map((metric, index) => <KpiCard key={metric.key} metric={metric} index={index} />)}
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Production Portfolio Overview</h2></div>
          <div className={styles.portfolioBody}>
            {data.portfolio.length ? <><div className={styles.legendList}>{data.portfolio.map((item) => <div key={item.label}><span className={styles.legendDot} /><span>{item.label}</span><strong>{item.value}</strong><small>{item.percent}%</small></div>)}</div><Donut value={portfolioTotal ? 100 : 0} label={String(portfolioTotal)} /></> : <EmptyState>No productions exist for the selected workspace and brand.</EmptyState>}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.widePanel}`} id="production-pipeline-summary">
          <div className={styles.panelHeader}><h2>Production Pipeline</h2><PanelAction href="/production-pipeline/index.html">View Pipeline</PanelAction></div>
          <div className={styles.pipeline}>{data.pipeline.map((stage, index) => <div className={styles.pipelineStage} key={stage.key}><div className={styles.pipelineIcon}>{index + 1}</div><strong>{stage.label}</strong><span>{stage.count}</span><small>{stage.atRisk} at risk</small></div>)}</div>
          <div className={styles.pipelineBars}><div><span>In Progress</span><div><i style={{ width: `${inProgressPercent}%` }} /></div><strong>{data.platform.activeProductions} ({inProgressPercent}%)</strong></div><div><span>Completed</span><div><i style={{ width: `${completedPercent}%` }} /></div><strong>{completedTotal} ({completedPercent}%)</strong></div></div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Content Throughput</h2><PanelAction href="/analytics/production-analytics">View Report</PanelAction></div>
          <div className={styles.chartLegend}><span>Created</span><span>Completed</span><span>Published</span><span>Failed</span></div>
          <LineChart data={data.throughput} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>AI Agent Overview</h2><PanelAction href="/agents">View All</PanelAction></div>
          <div className={styles.agentBody}>
            <Donut value={agentActivePercent} label={String(data.agents.total)} />
            <div className={styles.miniTable}>
              {data.agents.top.length ? data.agents.top.map((agent) => <div key={agent.name}><strong>{agent.name}</strong><span>{agent.role}</span><em>{agent.status}</em><small>{agent.successRate}</small></div>) : <EmptyState>No active agents yet.</EmptyState>}
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.widePanel}`}>
          <div className={styles.panelHeader}><h2>Publishing Overview</h2><PanelAction href="/publishing">View All</PanelAction></div>
          <div className={styles.table}>
            <div className={styles.tableHead}><span>Channel</span><span>Status</span><span>Scheduled</span><span>Ready</span><span>Failed</span><span>Last Published</span><span>Next Publish</span></div>
            {data.publishing.map((row) => <div className={styles.tableRow} key={row.channel}><span><ChannelIcon channel={row.channel} />{row.channel}</span><span><b className={styles.emptyPill}>{row.status}</b></span><span>{row.scheduled}</span><span>{row.ready}</span><span>{row.failed}</span><span>{row.lastPublished}</span><span>{row.nextPublish}</span></div>)}
            {!data.publishing.length ? <EmptyState>No publishing jobs exist for the selected filters.</EmptyState> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Quality & Risk Overview</h2><PanelAction href="/quality">View All</PanelAction></div>
          <div className={styles.qualityBody}><Donut value={qualityRiskPercent} label={String(data.quality.totalIssues)} />{data.quality.totalIssues ? <div className={styles.scoreList}><div><span>Critical</span><strong>{data.quality.critical}</strong></div><div><span>High</span><strong>{data.quality.high}</strong></div><div><span>Other</span><strong>{Math.max(0, data.quality.totalIssues - data.quality.critical - data.quality.high)}</strong></div></div> : <EmptyState>No quality or compliance issues detected.</EmptyState>}</div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Deadline & Cost Intelligence</h2></div>
          <div className={styles.deadlineGrid}><div><span>Overdue Deadlines</span><strong>{data.deadlines.overdue}</strong></div><div><span>Due Today</span><strong>{data.deadlines.dueToday}</strong></div><div><span>This Week</span><strong>{data.deadlines.dueThisWeek}</strong></div><div><span>Next Week</span><strong>{data.deadlines.dueNextWeek}</strong></div></div>
          <div className={styles.costBox}><small>Estimated Cost (This Period)</small><strong>{data.deadlines.estimatedCost}</strong><Sparkline values={data.deadlines.costTrend} /><div className={styles.budget}><span style={{ width: `${data.deadlines.budgetUtilization}%` }} /></div></div>
        </article>

        <article className={`${styles.panel} ${styles.widePanel}`}>
          <div className={styles.panelHeader}><h2>Operational Exceptions</h2><PanelAction href="/home/system-health">View All</PanelAction></div>
          <div className={`${styles.table} ${styles.exceptionTable}`}>
            <div className={styles.tableHead}><span>Severity</span><span>Category</span><span>Description</span><span>Affected</span><span>First Detected</span><span>Status</span></div>
            {data.exceptions.length ? data.exceptions.map((row, index) => <div className={styles.tableRow} key={`${row.affected}-${index}`}><span><b className={styles.severity}>{row.severity}</b></span><span>{row.category}</span><span>{row.description}</span><span>{row.affected}</span><span>{row.firstDetected}</span><span><b className={styles.open}>{row.status}</b></span></div>) : <EmptyState>No operational exceptions detected.</EmptyState>}
          </div>
        </article>

        <article className={styles.panel} id="recent-executive-activity">
          <div className={styles.panelHeader}><h2>Recent Executive Activity</h2></div>
          <div className={styles.activityList}>{data.activity.map((item, index) => <div key={`${item.title}-${index}`}><span className={`${styles.activityIcon} ${toneClass(item.tone)}`}><Clock3 size={14} aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><time>{item.time}</time></div>)}{!data.activity.length ? <EmptyState>No executive activity has been recorded yet.</EmptyState> : null}</div>
        </article>

        <article className={styles.panel} id="system-health-summary">
          <div className={styles.panelHeader}><h2>System Health Summary</h2><PanelAction href="/home/system-health">View All</PanelAction></div>
          <div className={styles.healthList}>{data.systemHealth.map((item) => <div key={item.service}><span>{item.service}</span><b>{item.status}</b></div>)}</div>
        </article>
      </section>

      <footer className={styles.footer}>
        <span>CACSMS Autonomous Media Studio.</span>
        <span>Times shown in your local timezone.</span>
      </footer>
    </section>
  );
}
