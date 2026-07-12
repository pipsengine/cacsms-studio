"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Download,
  Filter,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Upload,
  UserPlus
} from "lucide-react";

import { exportActiveProductions, getActiveProductions } from "@/lib/active-productions-api";
import type {
  ActiveProduction,
  ActiveProductionsQuery,
  ActiveProductionsResponse,
  HealthStatus,
  MetricCard
} from "@/types/active-productions";

import styles from "./ActiveProductionsPage.module.css";

const fallback: ActiveProductionsResponse = {
  generatedAt: new Date().toISOString(),
  filters: { workspaceId: null, brandId: null, from: null, to: null },
  metrics: [],
  productions: [],
  stageBreakdown: [],
  healthBreakdown: [],
  deadlines: [],
  risks: [],
  activity: [],
  workload: [],
  total: 0,
  page: 1,
  pageSize: 10
};

const healthLabel: Record<HealthStatus, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  delayed: "Delayed",
  paused: "Paused"
};

const healthClass: Record<HealthStatus, string> = {
  "on-track": styles.onTrack,
  "at-risk": styles.atRisk,
  delayed: styles.delayed,
  paused: styles.paused
};

const metricIcons = [Activity, BarChart3, AlertTriangle, CalendarDays, List, Grid2X2];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return rtf.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

function EmptyList({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.emptyList}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function KpiCard({ item, index }: { item: MetricCard; index: number }) {
  const trend = item.trend || "flat";
  const Icon = metricIcons[index % metricIcons.length];

  return (
    <article className={`${styles.card} ${styles.kpiCard}`}>
      <div className={styles.kpiTop}>
        <div>
          <div className={styles.kpiLabel}>{item.label}</div>
          <div className={styles.kpiValue}>{item.value}</div>
        </div>
        <div className={styles.kpiIcon} aria-hidden="true">
          <Icon size={18} />
        </div>
      </div>
      <div className={styles.kpiFoot}>
        <span className={`${styles.kpiTrend} ${styles[trend]}`}>
          {item.percent == null ? item.helper || "No change" : `${trend === "up" ? "Up" : trend === "down" ? "Down" : "Flat"} ${Math.abs(item.percent)}%`}
        </span>
        <svg className={styles.spark} viewBox="0 0 76 24" role="img" aria-label={`${item.label} trend`}>
          <polyline
            points="1,18 10,14 18,17 27,8 35,13 43,6 53,12 62,7 75,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </div>
    </article>
  );
}

function ProductionRow({ production }: { production: ActiveProduction }) {
  return (
    <tr>
      <td>
        <div className={styles.productionCell}>
          {production.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.thumbnail} src={production.thumbnailUrl} alt="" />
          ) : (
            <div className={styles.thumbnail} aria-hidden="true" />
          )}
          <div>
            <div className={styles.prodTitle}>{production.title}</div>
            <div className={styles.meta}>{production.code}</div>
          </div>
        </div>
      </td>
      <td>{production.type}</td>
      <td>
        <div className={styles.prodTitle}>{production.stage}</div>
        <div className={styles.meta}>{production.stageDetail || ""}</div>
      </td>
      <td>
        <div className={styles.owner}>
          <div className={styles.avatar}>{initials(production.owner.name)}</div>
          <span>{production.owner.name}</span>
        </div>
      </td>
      <td>
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${production.progress}%` }} />
          </div>
          <strong>{production.progress}%</strong>
        </div>
      </td>
      <td>
        <span className={`${styles.badge} ${healthClass[production.healthStatus]}`}>
          {healthLabel[production.healthStatus]}
        </span>
      </td>
      <td>
        <div>{formatDate(production.deadline)}</div>
        <div className={styles.meta}>{production.daysRemaining} days</div>
      </td>
      <td>
        <span className={styles.priority}>
          <span className={`${styles.dot} ${styles[production.priority]}`} />
          {production.priority}
        </span>
      </td>
      <td>
        <button className={styles.smallButton} type="button" aria-label={`Actions for ${production.title}`}>
          <MoreHorizontal size={16} />
        </button>
      </td>
    </tr>
  );
}

export function ActiveProductionsPage() {
  const [data, setData] = useState<ActiveProductionsResponse>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<ActiveProductionsQuery>({
    page: 1,
    pageSize: 10,
    sort: "deadline:asc"
  });

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const next = await getActiveProductions(query, controller.signal);
      setData(next);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Unable to load active productions.");
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize)));
  const visiblePages = useMemo(
    () => Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1),
    [pageCount]
  );

  const metrics = data.metrics.length
    ? data.metrics
    : [
        { key: "active", label: "Active Productions", value: data.total, trend: "flat" as const },
        { key: "track", label: "On Track", value: 0, trend: "flat" as const },
        { key: "risk", label: "At Risk", value: 0, trend: "flat" as const },
        { key: "delayed", label: "Delayed", value: 0, trend: "flat" as const },
        { key: "paused", label: "Paused", value: 0, trend: "flat" as const },
        { key: "progress", label: "Avg. Progress", value: "0%", trend: "flat" as const }
      ];

  return (
    <section className={styles.shell} aria-labelledby="active-productions-title">
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>Home / Active Productions</div>
            <h1 className={styles.title} id="active-productions-title">
              Active Productions
            </h1>
            <p className={styles.subtitle}>
              Monitor productions currently in progress. Track status, deadlines, risks, team activity, and workload.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.control} type="button">Workspace: CACSMS Studio</button>
            <button className={styles.control} type="button">Brand: CACSMS</button>
            <button className={styles.control} type="button">Date Range</button>
            <button className={styles.iconButton} type="button" onClick={() => void load()}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className={styles.iconButton} type="button">
              <Filter size={15} /> Filters
            </button>
          </div>
        </header>

        {error && (
          <section className={styles.alert} role="alert">
            <strong>Some data could not be loaded.</strong> {error}
            <button className={styles.smallButton} type="button" onClick={() => void load()}>
              Retry
            </button>
          </section>
        )}

        <section className={styles.kpiGrid} aria-label="Production metrics">
          {metrics.map((item, index) => (
            <KpiCard key={item.key} item={item} index={index} />
          ))}
        </section>

        <section className={styles.mainGrid}>
          <article className={`${styles.card} ${styles.tableCard}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Active Productions ({data.total})</div>
              <div className={styles.sectionActions}>
                <button className={styles.smallButton} type="button">
                  <List size={14} /> List
                </button>
                <button className={styles.smallButton} type="button">
                  <Grid2X2 size={14} /> Grid
                </button>
                <select
                  className={styles.smallButton}
                  value={query.sort}
                  onChange={(event) => setQuery((current) => ({ ...current, sort: event.target.value, page: 1 }))}
                  aria-label="Sort productions"
                >
                  <option value="deadline:asc">Deadline (Soonest)</option>
                  <option value="deadline:desc">Deadline (Latest)</option>
                  <option value="progress:desc">Progress (Highest)</option>
                  <option value="updatedAt:desc">Recently Updated</option>
                </select>
                <button className={styles.smallButton} type="button" onClick={() => void exportActiveProductions(query)}>
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Production</th>
                    <th>Type</th>
                    <th>Stage</th>
                    <th>Owner</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Deadline</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.productions.map((production) => (
                    <ProductionRow key={production.id} production={production} />
                  ))}
                </tbody>
              </table>
              {!loading && data.productions.length === 0 && (
                <div className={styles.empty}>
                  <h3>No active productions</h3>
                  <p>Productions will appear here when work begins.</p>
                  <button className={styles.primaryButton} type="button">
                    <Plus size={16} /> Create Production
                  </button>
                </div>
              )}
            </div>
            <div className={styles.pagination}>
              <span>
                Showing {data.productions.length ? (data.page - 1) * data.pageSize + 1 : 0} to{" "}
                {Math.min(data.page * data.pageSize, data.total)} of {data.total} results
              </span>
              <div className={styles.pages}>
                {visiblePages.map((page) => (
                  <button
                    key={page}
                    className={`${styles.pageButton} ${page === data.page ? styles.active : ""}`}
                    type="button"
                    onClick={() => setQuery((current) => ({ ...current, page }))}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </article>

          <aside className={styles.sideStack}>
            <article className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Productions by Stage</div>
                <button className={styles.smallButton} type="button">
                  View Report <ChevronRight size={14} />
                </button>
              </div>
              <div className={`${styles.chartBody} ${styles.donutLayout}`}>
                <div className={styles.donut}>
                  <div className={styles.donutCenter}>
                    <div>
                      <div className={styles.donutTotal}>{data.total}</div>
                      <small>Total</small>
                    </div>
                  </div>
                </div>
                <div className={styles.legend}>
                  {data.stageBreakdown.length ? (
                    data.stageBreakdown.map((item, index) => (
                      <div className={styles.legendRow} key={item.stage}>
                        <span className={styles.legendSwatch} style={{ background: ["#6437f2", "#2563eb", "#2f80ed", "#f59e0b", "#ef4444", "#cbd5e1"][index % 6] }} />
                        <span>{item.stage}</span>
                        <strong>{item.count}</strong>
                        <span>{item.percentage}%</span>
                      </div>
                    ))
                  ) : (
                    <EmptyList title="No stages yet" detail="Stage distribution will appear once productions start." />
                  )}
                </div>
              </div>
            </article>

            <article className={`${styles.card} ${styles.chartCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Productions Health</div>
                <button className={styles.smallButton} type="button">
                  View All <ChevronRight size={14} />
                </button>
              </div>
              <div className={styles.chartBody}>
                <div className={styles.healthList}>
                  {data.healthBreakdown.map((item) => {
                    const color = item.status === "on-track" ? "#16a34a" : item.status === "at-risk" ? "#f97316" : item.status === "delayed" ? "#ef4444" : "#64748b";
                    return (
                      <div className={styles.healthRow} key={item.status}>
                        <span>{healthLabel[item.status]}</span>
                        <div className={styles.healthTrack}>
                          <div className={styles.healthFill} style={{ width: `${item.percentage}%`, background: color }} />
                        </div>
                        <strong>{item.count} ({item.percentage}%)</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          </aside>
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Upcoming Deadlines</div>
              <button className={styles.smallButton} type="button">View Calendar</button>
            </div>
            <div className={`${styles.compactBody} ${styles.list}`}>
              {data.deadlines.length ? data.deadlines.slice(0, 5).map((item) => (
                <div className={styles.listItem} key={item.productionId}>
                  <div className={styles.dateBadge}>{formatDate(item.deadline).split(" ").slice(0, 2).join(" ")}</div>
                  <div><div className={styles.listTitle}>{item.title}</div><div className={styles.listSub}>{item.type}</div></div>
                  <span className={`${styles.badge} ${styles.atRisk}`}>{item.daysRemaining} days</span>
                </div>
              )) : <EmptyList title="No deadlines" detail="Upcoming production deadlines will show here." />}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Risk & Issues</div>
              <button className={styles.smallButton} type="button">View All</button>
            </div>
            <div className={`${styles.compactBody} ${styles.list}`}>
              {data.risks.length ? data.risks.map((item) => (
                <div className={styles.listItem} key={item.key}>
                  <div className={styles.riskIcon}>!</div>
                  <div><div className={styles.listTitle}>{item.label}</div><div className={styles.listSub}>{item.description}</div></div>
                  <strong>{item.count}</strong>
                </div>
              )) : <EmptyList title="No open risks" detail="Issues will appear when a production needs attention." />}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Recent Activity</div>
              <button className={styles.smallButton} type="button">View All</button>
            </div>
            <div className={`${styles.compactBody} ${styles.list}`}>
              {data.activity.length ? data.activity.slice(0, 5).map((item) => (
                <div className={styles.listItem} key={item.id}>
                  <div className={styles.avatar}>{initials(item.actor)}</div>
                  <div><div className={styles.listTitle}>{item.actor} {item.action}</div><div className={styles.listSub}>{item.productionTitle}</div></div>
                  <span className={styles.meta}>{relativeTime(item.createdAt)}</span>
                </div>
              )) : <EmptyList title="No activity yet" detail="Production updates will stream here." />}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Team Workload</div>
              <button className={styles.smallButton} type="button">View All</button>
            </div>
            <div className={`${styles.compactBody} ${styles.list}`}>
              {data.workload.length ? data.workload.slice(0, 5).map((item) => (
                <div className={styles.listItem} key={item.userId}>
                  <div className={styles.avatar}>{initials(item.name)}</div>
                  <div><div className={styles.listTitle}>{item.name}</div><div className={styles.listSub}>{item.role}</div></div>
                  <div><div className={styles.workloadBar}><div className={styles.workloadFill} style={{ width: `${item.workloadPercent}%` }} /></div><div className={styles.meta}>{item.workloadPercent}%</div></div>
                </div>
              )) : <EmptyList title="No workload assigned" detail="Team load will appear after assignments are created." />}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Quick Actions</div>
            </div>
            <div className={`${styles.compactBody} ${styles.quickGrid}`}>
              {[
                ["New Production", Plus],
                ["Import Idea", Upload],
                ["Assign Task", UserPlus],
                ["Request Review", AlertTriangle],
                ["Upload Asset", Upload],
                ["Production Report", BarChart3]
              ].map(([label, Icon]) => (
                <button className={styles.quickAction} type="button" key={String(label)}>
                  <Icon size={18} />
                  <span>{String(label)}</span>
                </button>
              ))}
            </div>
          </article>
        </section>

        <footer className={styles.footer}>
          <span>CACSMS Autonomous Media Studio</span>
          <span>Times shown in your local timezone</span>
        </footer>
      </div>
    </section>
  );
}
