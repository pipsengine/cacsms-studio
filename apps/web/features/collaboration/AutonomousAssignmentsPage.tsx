"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import styles from "./autonomous-assignments.module.css";

type Assignment = {
  id: string;
  task: string;
  production: string;
  stage: string;
  agent: string;
  agentCode: string;
  priority: "Critical" | "High" | "Normal" | "Low";
  confidence: number;
  progress: number;
  status: "Running" | "Queued" | "Blocked" | "Review";
  dueAt: string;
};

type AgentLoad = { name: string; code: string; active: number; capacity: number; state: string };
type Capability = { name: string; detail: string; configured: boolean };
type DashboardData = {
  engineOnline: boolean;
  activeAssignments: number;
  agentsCoordinated: number;
  averageConfidence: number;
  nextRebalanceSeconds: number;
  assignments: Assignment[];
  agents: AgentLoad[];
  capabilities: Capability[];
  updatedAt: string;
};

const API = "/api/collaboration/assignments";

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    route: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 6h8M7.4 7.5l3.2 8M16.6 7.5l-3.2 8"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></>,
    spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    play: <path d="m8 5 11 7-11 7Z"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

function initials(value: string) {
  return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function AutonomousAssignmentsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [engineBusy, setEngineBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(API, { cache: "no-store" });
      if (!response.ok) throw new Error("Assignment telemetry could not be loaded.");
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unexpected telemetry error.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!data?.engineOnline) return;
    const timer = window.setInterval(() => setData((current) => current ? {
      ...current,
      nextRebalanceSeconds: current.nextRebalanceSeconds <= 1 ? 30 : current.nextRebalanceSeconds - 1,
    } : current), 1000);
    return () => window.clearInterval(timer);
  }, [data?.engineOnline]);

  const assignments = useMemo(() => (data?.assignments ?? []).filter((item) => {
    const text = `${item.task} ${item.production} ${item.stage} ${item.agent}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === "All statuses" || item.status === status);
  }), [data?.assignments, query, status]);

  async function engineAction(action: "pause" | "resume" | "rebalance") {
    setEngineBusy(true); setError("");
    try {
      const response = await fetch(`${API}/engine`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("The engine action was not completed.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Engine action failed."); }
    finally { setEngineBusy(false); }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><span /> Collaboration / Autonomous Assignments</div>
          <h1>Autonomous Assignments</h1>
          <p>Monitor how specialist agents are matched, balanced and routed across the production pipeline.</p>
        </div>
        <div className={styles.heroActions}>
          <span className={`${styles.liveBadge} ${data?.engineOnline ? styles.online : styles.offline}`}><i />{data?.engineOnline ? "Engine online" : "Engine paused"}</span>
          <span className={styles.health}><i/>Zero-input routing · every 30s</span>
        </div>
      </header>

      {error && <div className={styles.errorBanner} role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}

      <section className={styles.metrics} aria-label="Assignment overview">
        <Metric icon="route" tone="blue" label="Active assignments" value={loading ? "—" : String(data?.activeAssignments ?? 0)} note="Across all production stages" />
        <Metric icon="users" tone="violet" label="Agents coordinated" value={loading ? "—" : String(data?.agentsCoordinated ?? 0)} note="Specialists currently available" />
        <Metric icon="shield" tone="green" label="Average confidence" value={loading ? "—" : `${data?.averageConfidence ?? 0}%`} note="Quality-gated routing score" />
        <Metric icon="timer" tone="amber" label="Next rebalance" value={loading ? "—" : `${data?.nextRebalanceSeconds ?? 0}s`} note="Continuous queue optimization" />
      </section>

      <section className={styles.grid}>
        <div className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><h2>Live agent assignments</h2><p>Current work allocation across the media-production pipeline.</p></div>
              <button className={styles.iconButton} aria-label="Refresh telemetry" onClick={() => void load()}><Icon name="refresh"/></button>
            </div>
            <div className={styles.toolbar}>
              <label className={styles.search}><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, production or agent…" /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
                {['All statuses','Running','Queued','Blocked','Review'].map((value) => <option key={value}>{value}</option>)}
              </select>
              <span className={styles.resultCount}>{assignments.length} assignments</span>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Assignment</th><th>Assigned agent</th><th>Priority</th><th>Confidence</th><th>Progress</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {loading ? Array.from({ length: 5 }).map((_, index) => <tr key={index} className={styles.skeletonRow}><td colSpan={7}><span /></td></tr>) : assignments.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.task}</strong><small>{item.production} · {item.stage}</small></td>
                      <td><div className={styles.agent}><span>{initials(item.agent)}</span><div><strong>{item.agent}</strong><small>{item.agentCode}</small></div></div></td>
                      <td><span className={`${styles.priority} ${styles[item.priority.toLowerCase()]}`}>{item.priority}</span></td>
                      <td><div className={styles.confidence}><strong>{item.confidence}%</strong><span><i style={{ width: `${item.confidence}%` }}/></span></div></td>
                      <td><div className={styles.progress}><span><i style={{ width: `${item.progress}%` }}/></span><b>{item.progress}%</b></div></td>
                      <td><span className={`${styles.status} ${styles[item.status.toLowerCase()]}`}><i />{item.status}</span></td>
                      <td><button className={styles.rowAction} aria-label={`Open ${item.task}`}><Icon name="chevron"/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && assignments.length === 0 && <div className={styles.empty}><Icon name="route"/><h3>No assignments found</h3><p>Change the search or status filter to see more work.</p></div>}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Assignment autonomy engine</h2><p>Routing controls and quality gates applied continuously.</p></div><span className={styles.health}><i/>Healthy · every 30s</span></div>
            <div className={styles.capabilityGrid}>{(data?.capabilities ?? []).map((item) => <div className={styles.capability} key={item.name}><span className={styles.capabilityIcon}><Icon name="shield"/></span><div><strong>{item.name}</strong><p>{item.detail}</p></div><span className={styles.configured}>{item.configured ? "Configured" : "Review"}</span></div>)}</div>
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Agent workload</h2><p>Utilization by specialist.</p></div><button className={styles.textButton}>View agents</button></div>
            <div className={styles.workloads}>{(data?.agents ?? []).map((agent) => {
              const load = Math.round((agent.active / Math.max(agent.capacity, 1)) * 100);
              return <div className={styles.workload} key={agent.code}><div className={styles.workloadTop}><div className={styles.agent}><span>{initials(agent.name)}</span><div><strong>{agent.name}</strong><small>{agent.active} of {agent.capacity} assignments</small></div></div><b>{load}%</b></div><span className={styles.loadBar}><i className={load >= 85 ? styles.hotLoad : ""} style={{ width: `${Math.min(load,100)}%` }}/></span></div>;
            })}</div>
          </article>
          <article className={`${styles.panel} ${styles.insightPanel}`}>
            <span className={styles.insightIcon}><Icon name="spark"/></span>
            <h2>Routing insight</h2>
            <p>Visual and audio agents are nearing preferred capacity. The next rebalance can shift review work to available QA specialists.</p>
            <span className={styles.textButton}>Applied automatically <Icon name="chevron"/></span>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Routing health</h2><p>Last 24 hours</p></div><strong className={styles.bigScore}>96%</strong></div>
            <div className={styles.healthRows}><Health label="Successful handoffs" value={98}/><Health label="SLA compliance" value={96}/><Health label="Quality gate pass" value={93}/></div>
          </article>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return <article className={styles.metric}><span className={`${styles.metricIcon} ${styles[tone]}`}><Icon name={icon}/></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

function Health({ label, value }: { label: string; value: number }) {
  return <div><span><b>{label}</b><strong>{value}%</strong></span><i><em style={{ width: `${value}%` }}/></i></div>;
}
