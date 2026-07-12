import type React from "react";
import Link from "next/link";
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
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
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
          <span>vs previous period</span>
          <Sparkline values={metric.sparkline} />
        </div>
      </div>
    </article>
  );
}

function Donut({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.donut} style={{ "--value": `${Math.min(100, Math.max(0, value)) * 3.6}deg` } as React.CSSProperties}>
      <div>
        <strong>{label}</strong>
        <span>Total</span>
      </div>
    </div>
  );
}

function LineChart({ data }: { data: ExecutiveDashboardData["throughput"] }) {
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

export function ExecutiveDashboard({ data }: { data: ExecutiveDashboardData }) {
  const portfolioTotal = data.portfolio.reduce((sum, item) => sum + item.value, 0);

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
          <div className={styles.selectButton}>Workspace <strong>CACSMS Studio</strong></div>
          <div className={styles.selectButton}>Brand <strong>CACSMS</strong></div>
          <div className={styles.selectButton}>Current period <strong>{new Date(data.generatedAt).toLocaleDateString()}</strong></div>
          <Link className={styles.iconButton} href="/dashboard/executive-dashboard" aria-label="Refresh">
            <RefreshCw size={17} aria-hidden="true" />
          </Link>
          <Link className={styles.iconButton} href="/dashboard/my-workspace" aria-label="Search">
            <Search size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className={styles.commandBar} aria-label="Executive command summary">
        <div className={styles.commandCell}>
          <span className={styles.statusPill}>{data.platform.status}</span>
          <small>Platform Status</small>
        </div>
        <div className={styles.commandCell}><small>Autonomous Mode</small><strong>{data.platform.autonomousMode}</strong></div>
        <div className={styles.commandCell}><small>Current Operation</small><strong>{data.platform.currentOperation}</strong></div>
        <div className={styles.commandCell}><small>Current Stage</small><strong>{data.platform.currentStage}</strong><div className={styles.progress}><span style={{ width: "100%" }} /></div></div>
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
          <button className={styles.startButton} type="button"><Play size={14} aria-hidden="true" />Start</button>
          <button className={styles.pauseButton} type="button"><Pause size={14} aria-hidden="true" />Pause</button>
          <button className={styles.stopButton} type="button"><Square size={13} aria-hidden="true" />Stop</button>
        </div>
      </section>

      <section className={styles.kpiGrid} aria-label="Executive metrics">
        {data.metrics.map((metric, index) => <KpiCard key={metric.key} metric={metric} index={index} />)}
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Production Portfolio Overview</h2></div>
          <div className={styles.portfolioBody}>
            <div className={styles.legendList}>{data.portfolio.map((item) => <div key={item.label}><span className={styles.legendDot} /><span>{item.label}</span><strong>{item.value}</strong><small>{item.percent}%</small></div>)}</div>
            <Donut value={portfolioTotal ? 74 : 0} label={String(portfolioTotal)} />
          </div>
        </article>

        <article className={`${styles.panel} ${styles.widePanel}`}>
          <div className={styles.panelHeader}><h2>Production Pipeline</h2><PanelAction href="/dashboard/production-pipeline">View Pipeline</PanelAction></div>
          <div className={styles.pipeline}>{data.pipeline.map((stage, index) => <div className={styles.pipelineStage} key={stage.key}><div className={styles.pipelineIcon}>{index + 1}</div><strong>{stage.label}</strong><span>{stage.count}</span><small>{stage.atRisk} at risk</small></div>)}</div>
          <div className={styles.pipelineBars}><div><span>In Progress</span><div><i style={{ width: "0%" }} /></div><strong>0 (0%)</strong></div><div><span>Completed</span><div><i style={{ width: "0%" }} /></div><strong>0 (0%)</strong></div></div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Content Throughput</h2><PanelAction href="/analytics/production-analytics">View Report</PanelAction></div>
          <div className={styles.chartLegend}><span>Created</span><span>Completed</span><span>Published</span><span>Failed</span></div>
          <LineChart data={data.throughput} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>AI Agent Overview</h2><PanelAction href="/agents">View All</PanelAction></div>
          <div className={styles.agentBody}>
            <Donut value={data.agents.total ? 75 : 0} label={String(data.agents.total)} />
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
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Quality & Risk Overview</h2><PanelAction href="/quality">View All</PanelAction></div>
          <div className={styles.qualityBody}><Donut value={0} label={String(data.quality.totalIssues)} /><div className={styles.scoreList}>{data.quality.areas.map((area) => <div key={area.label}><span>{area.label}</span><strong>{area.score}%</strong></div>)}</div></div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Deadline & Cost Intelligence</h2></div>
          <div className={styles.deadlineGrid}><div><span>Overdue Deadlines</span><strong>{data.deadlines.overdue}</strong></div><div><span>Due Today</span><strong>{data.deadlines.dueToday}</strong></div><div><span>This Week</span><strong>{data.deadlines.dueThisWeek}</strong></div><div><span>Next Week</span><strong>{data.deadlines.dueNextWeek}</strong></div></div>
          <div className={styles.costBox}><small>Estimated Cost (This Period)</small><strong>{data.deadlines.estimatedCost}</strong><Sparkline values={data.deadlines.costTrend} /><div className={styles.budget}><span style={{ width: `${data.deadlines.budgetUtilization}%` }} /></div></div>
        </article>

        <article className={`${styles.panel} ${styles.widePanel}`}>
          <div className={styles.panelHeader}><h2>Operational Exceptions</h2><PanelAction href="/dashboard/system-health">View All</PanelAction></div>
          <div className={`${styles.table} ${styles.exceptionTable}`}>
            <div className={styles.tableHead}><span>Severity</span><span>Category</span><span>Description</span><span>Affected</span><span>First Detected</span><span>Status</span></div>
            {data.exceptions.length ? data.exceptions.map((row, index) => <div className={styles.tableRow} key={`${row.affected}-${index}`}><span><b className={styles.severity}>{row.severity}</b></span><span>{row.category}</span><span>{row.description}</span><span>{row.affected}</span><span>{row.firstDetected}</span><span><b className={styles.open}>{row.status}</b></span></div>) : <EmptyState>No operational exceptions detected.</EmptyState>}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Recent Executive Activity</h2></div>
          <div className={styles.activityList}>{data.activity.map((item, index) => <div key={`${item.title}-${index}`}><span className={`${styles.activityIcon} ${toneClass(item.tone)}`}><Clock3 size={14} aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><time>{item.time}</time></div>)}</div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>System Health Summary</h2><PanelAction href="/dashboard/system-health">View All</PanelAction></div>
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
