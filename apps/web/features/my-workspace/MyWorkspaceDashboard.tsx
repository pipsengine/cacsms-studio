import Link from "next/link";
import type React from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutList,
  Mic2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  Users,
  WandSparkles
} from "lucide-react";
import type {
  ActivityItem,
  ActiveProduction,
  DeadlineItem,
  FileAccessItem,
  MyWorkspaceResponse,
  NotificationItem,
  Priority,
  WorkspaceMetric,
  WorkspaceTask
} from "@/types/my-workspace";
import styles from "./MyWorkspace.module.css";

const priorityClass: Record<Priority, string> = {
  low: styles.low,
  medium: styles.medium,
  high: styles.high,
  critical: styles.critical
};

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 72;
      const y = 28 - ((value - min) / Math.max(max - min, 1)) * 22;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className={styles.sparkline} viewBox="0 0 72 32" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={styles.emptyState}>{children}</div>;
}

function MetricIcon({ metric }: { metric: WorkspaceMetric }) {
  const Icon = {
    tasks: LayoutList,
    production: Film,
    approval: CheckCircle2,
    review: Search,
    drafts: FileText,
    deadline: CalendarDays
  }[metric.icon];

  return (
    <span className={`${styles.metricIcon} ${styles[metric.tone]}`}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}

function MetricCard({ metric }: { metric: WorkspaceMetric }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <MetricIcon metric={metric} />
        <div>
          <p>{metric.label}</p>
          <strong>{metric.value}</strong>
        </div>
        <span className={`${styles.trend} ${metric.trendDirection === "down" ? styles.trendDown : styles.trendUp}`}>{metric.trendLabel}</span>
      </div>
      <div className={styles.metricFoot}>
        <span>vs last 30 days</span>
        <Sparkline values={metric.sparkline} />
      </div>
    </article>
  );
}

function PanelHeader({ title, href = "#", action = "View All" }: { title: string; href?: string; action?: string }) {
  return (
    <header className={styles.panelHeader}>
      <h2>{title}</h2>
      <Link href={href}>{action} <span>-&gt;</span></Link>
    </header>
  );
}

function StatusPill({ status }: { status: WorkspaceTask["status"] }) {
  const label = status.replace("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
  return <span className={`${styles.statusPill} ${styles[`status_${status.replace("-", "_")}`]}`}>{label}</span>;
}

function TaskTable({ tasks }: { tasks: WorkspaceTask[] }) {
  return (
    <section className={`${styles.panel} ${styles.tasksPanel}`}>
      <PanelHeader title="My Current Tasks" href="/dashboard/my-workspace/tasks" />
      <div className={styles.tabs} role="tablist" aria-label="Task filters">
        <button className={styles.activeTab} type="button">All ({tasks.length})</button>
        <button type="button">Assigned</button>
        <button type="button">Created By Me</button>
        <button type="button">Review</button>
        <button type="button">Approval</button>
      </div>
      {tasks.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Task / Item</th><th>Type</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><div className={styles.itemCell}><span className={styles.rowIcon}><FileText size={15} aria-hidden="true" /></span><div><strong>{task.title}</strong><small>{task.module}</small></div></div></td>
                  <td><span className={styles.typePill}>{task.type}</span></td>
                  <td><span className={styles.priority}><i className={priorityClass[task.priority]} />{task.priority}</span></td>
                  <td>{task.dueDate}</td>
                  <td><StatusPill status={task.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState>No tasks assigned yet.</EmptyState>}
    </section>
  );
}

function ProductionPanel({ productions }: { productions: ActiveProduction[] }) {
  return (
    <section className={`${styles.panel} ${styles.productionsPanel}`}>
      <PanelHeader title="My Active Productions" href="/dashboard/active-productions" />
      <div className={styles.productionList}>
        {productions.length ? productions.map((item) => (
          <article className={styles.productionRow} key={item.id}>
            <div className={styles.productionIdentity}><div className={styles.thumb}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <Film size={20} aria-hidden="true" />}</div><div><strong>{item.title}</strong><small>{item.subtitle}</small></div></div>
            <span className={styles.stagePill}>{item.stage}</span>
            <div className={styles.progressCell}><div className={styles.progressTrack}><i style={{ width: `${item.progress}%` }} /></div><strong>{item.progress}%</strong></div>
            <time>{item.deadline}</time>
            <span className={styles.priority}><i className={priorityClass[item.priority]} />{item.priority}</span>
          </article>
        )) : <EmptyState>No active productions assigned to this workspace.</EmptyState>}
      </div>
    </section>
  );
}

function MiniCalendar({ calendar }: { calendar: MyWorkspaceResponse["calendar"] }) {
  return (
    <section className={`${styles.panel} ${styles.calendarPanel}`}>
      <header className={styles.panelHeader}>
        <h2>My Calendar</h2>
        <div className={styles.calendarControls}><button type="button" aria-label="Previous month"><ChevronLeft size={15} /></button><button type="button">Today</button><button type="button" aria-label="Next month"><ChevronRight size={15} /></button></div>
      </header>
      <h3>{calendar.monthLabel}</h3>
      <div className={styles.weekdays}>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.calendarGrid}>
        {calendar.days.map((day, index) => (
          <button key={`${day.day}-${index}`} type="button" className={`${!day.isCurrentMonth ? styles.outsideDay : ""} ${day.isToday ? styles.today : ""}`}>
            {day.day}<span className={styles.eventDots}>{day.eventKinds?.map((kind, dotIndex) => <i key={dotIndex} className={styles[`dot_${kind}`]} />)}</span>
          </button>
        ))}
      </div>
      <footer className={styles.calendarLegend}><span><i className={styles.dot_deadline} />Deadlines {calendar.summary.deadlines}</span><span><i className={styles.dot_review} />Reviews {calendar.summary.reviews}</span><span><i className={styles.dot_event} />Events {calendar.summary.events}</span></footer>
    </section>
  );
}

function LineChart({ points }: { points: MyWorkspaceResponse["contentPerformance"]["points"] }) {
  const series = [
    { key: "views" as const, className: styles.linePurple },
    { key: "engagement" as const, className: styles.lineBlue },
    { key: "subscribers" as const, className: styles.lineGreen },
    { key: "watchTime" as const, className: styles.lineOrange }
  ];
  const max = Math.max(...points.flatMap((point) => [point.views, point.engagement, point.subscribers, point.watchTime]), 1);

  return (
    <div className={styles.chart}>
      <svg viewBox="0 0 760 210" preserveAspectRatio="none" role="img" aria-label="Content performance line chart">
        {[20, 60, 100, 140, 180].map((y) => <line key={y} x1="42" y1={y} x2="748" y2={y} className={styles.gridLine} />)}
        {series.map(({ key, className }) => {
          const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${42 + index * (706 / Math.max(points.length - 1, 1))} ${190 - (point[key] / max) * 155}`).join(" ");
          return <path key={key} d={d} className={className} />;
        })}
      </svg>
      <div className={styles.chartLabels}>{points.filter((_, index) => index % Math.max(Math.floor(points.length / 4), 1) === 0).map((point) => <span key={point.label}>{point.label}</span>)}</div>
    </div>
  );
}

function PerformancePanel({ performance }: { performance: MyWorkspaceResponse["contentPerformance"] }) {
  return (
    <section className={`${styles.panel} ${styles.performancePanel}`}>
      <PanelHeader title="My Content Performance (This Month)" href="/analytics" />
      <div className={styles.performanceSummary}>{performance.summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><em>{item.delta}</em></div>)}</div>
      <div className={styles.chartLegend}><span className={styles.legendPurple}>Views</span><span className={styles.legendBlue}>Engagement</span><span className={styles.legendGreen}>Subscribers</span><span className={styles.legendOrange}>Watch Time</span></div>
      <LineChart points={performance.points} />
    </section>
  );
}

function ActivityPanel({ items }: { items: ActivityItem[] }) {
  return (
    <section className={`${styles.panel} ${styles.activityPanel}`}>
      <PanelHeader title="My Recent Activity" href="/home/agent-activity" />
      <div className={styles.feed}>{items.map((item) => <article key={item.id}><span className={`${styles.feedIcon} ${styles[item.tone]}`}><Activity size={16} aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.module}</small></div><time>{item.timeAgo}</time></article>)}</div>
    </section>
  );
}

function NotificationPanel({ items }: { items: NotificationItem[] }) {
  return (
    <section className={`${styles.panel} ${styles.notificationPanel}`}>
      <PanelHeader title="My Notifications" href="/home/notifications" action={`View All (${items.length})`} />
      <div className={styles.feed}>{items.map((item) => <article key={item.id}><span className={`${styles.feedIcon} ${styles[item.tone]}`}><Bell size={16} aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><time>{item.timeAgo}</time>{item.unread ? <i className={styles.unreadDot} /> : null}</article>)}</div>
    </section>
  );
}

function DeadlinePanel({ items }: { items: DeadlineItem[] }) {
  return (
    <section className={`${styles.panel} ${styles.deadlinePanel}`}>
      <PanelHeader title="My Deadlines" href="/home/calendar" />
      <div className={styles.deadlineList}>{items.length ? items.map((item) => <article key={item.id}><time>{item.date}</time><div><strong>{item.title}</strong><small>{item.module}</small></div><span>{item.remaining}</span><em className={priorityClass[item.priority]}>{item.priority}</em></article>) : <EmptyState>No deadlines scheduled.</EmptyState>}</div>
    </section>
  );
}

function FileAccessPanel({ items }: { items: FileAccessItem[] }) {
  const iconMap = { document: FileText, storyboard: LayoutList, media: ImageIcon, template: WandSparkles, shared: Users, audio: Mic2 };

  return (
    <section className={`${styles.panel} ${styles.filePanel}`}>
      <PanelHeader title="My File & Asset Access" href="/assets" />
      <div className={styles.fileList}>{items.map((item) => {
        const Icon = iconMap[item.icon];
        return <Link href="/assets" key={item.id}><span><Icon size={17} aria-hidden="true" />{item.label}</span><strong>{item.count}</strong><ChevronRight size={15} aria-hidden="true" /></Link>;
      })}</div>
    </section>
  );
}

function StoragePanel({ storage }: { storage: MyWorkspaceResponse["storage"] }) {
  const percent = Math.round((storage.usedGb / Math.max(storage.totalGb, 1)) * 100);

  return (
    <section className={`${styles.panel} ${styles.storagePanel}`}>
      <h2>Workspace Storage</h2>
      <div className={styles.storageContent}><div className={styles.donut} style={{ "--percent": `${percent * 3.6}deg` } as React.CSSProperties}><span><strong>{percent}%</strong>Used</span></div><div className={styles.storageLegend}>{storage.slices.map((slice) => <div key={slice.label}><span><i className={styles[slice.tone]} />{slice.label}</span><strong>{slice.valueGb} GB</strong></div>)}</div></div>
      <footer><span>{storage.usedGb} GB / {storage.totalGb} GB</span><Link href="/assets/storage">Manage Storage -&gt;</Link></footer>
    </section>
  );
}

function QuickActions() {
  const actions = [
    { label: "New Production", icon: Plus, href: "/production-studio/create-production" },
    { label: "Upload Media", icon: Upload, href: "/assets" },
    { label: "Create Script", icon: FileText, href: "/writing/script-generator" },
    { label: "Schedule Publish", icon: CalendarDays, href: "/publishing/scheduler" },
    { label: "AI Research", icon: WandSparkles, href: "/content-intelligence/research-workspace" },
    { label: "View Reports", icon: Activity, href: "/analytics" }
  ];

  return <section className={`${styles.panel} ${styles.quickPanel}`}><h2>Quick Actions</h2><div>{actions.map(({ label, icon: Icon, href }) => <Link key={label} href={href}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}</div></section>;
}

export function MyWorkspaceDashboard({ data }: { data: MyWorkspaceResponse }) {
  return (
    <section className={styles.page} aria-labelledby="my-workspace-title">
      <header className={styles.pageHeader}>
        <div>
          <nav><Link href="/dashboard">Home</Link><span>/</span><strong>My Workspace</strong></nav>
          <h1 id="my-workspace-title">My Workspace</h1>
          <p>Your personal command center. Track your tasks, productions, deadlines, approvals, and productivity.</p>
        </div>
        <div className={styles.headerTools}>
          <Link href="/dashboard/my-workspace">Workspace<br /><strong>CACSMS Studio</strong></Link>
          <Link href="/settings/branding">Brand<br /><strong>CACSMS</strong></Link>
          <Link className={styles.dateButton} href="/home/calendar">{new Date(data.generatedAt).toLocaleDateString()} <CalendarDays size={16} /></Link>
          <Link href="/dashboard/my-workspace"><Activity size={16} /> Refresh</Link>
          <Link href="/dashboard/my-workspace/search" aria-label="Search"><Search size={17} /></Link>
          <Link href="/settings" aria-label="More"><MoreHorizontal size={17} /></Link>
          <span className={styles.avatarButton}>{data.user.initials}</span>
        </div>
      </header>

      <section className={styles.metricsGrid}>{data.metrics.map((metric) => <MetricCard metric={metric} key={metric.key} />)}</section>
      <section className={styles.topGrid}><TaskTable tasks={data.tasks} /><ProductionPanel productions={data.productions} /><MiniCalendar calendar={data.calendar} /></section>
      <section className={styles.middleGrid}><PerformancePanel performance={data.contentPerformance} /><ActivityPanel items={data.activity} /><NotificationPanel items={data.notifications} /></section>
      <section className={styles.bottomGrid}><DeadlinePanel items={data.deadlines} /><FileAccessPanel items={data.fileAccess} /><StoragePanel storage={data.storage} /><QuickActions /></section>
      <footer className={styles.pageFooter}><span>CACSMS Autonomous Media Studio.</span><span>Times shown in your local timezone.</span></footer>
    </section>
  );
}
