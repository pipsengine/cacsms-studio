"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Rocket,
  Star,
  XCircle
} from "lucide-react";

import { exportRecentProductions, getRecentProductions } from "@/lib/recent-productions-api";
import type {
  RecentProduction,
  RecentProductionMetric,
  RecentProductionsQuery,
  RecentProductionsResponse,
  RecentProductionStatus
} from "@/types/recent-productions";

import styles from "./RecentProductionsPage.module.css";

const emptyResponse: RecentProductionsResponse = {
  generatedAt: new Date().toISOString(),
  filters: { workspaceId: null, brandId: null, from: null, to: null },
  metrics: [],
  productions: [],
  statusBreakdown: [],
  typeBreakdown: [],
  performance: [],
  channelPerformance: [],
  activity: [],
  total: 0,
  page: 1,
  pageSize: 10
};

const statusLabel: Record<RecentProductionStatus, string> = {
  completed: "Completed",
  published: "Published",
  archived: "Archived",
  cancelled: "Cancelled",
  failed: "Failed"
};

const metricIcons = [CheckCircle2, Rocket, Archive, XCircle, Star, BarChart3];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value: string | null) {
  if (!value) return "-";
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

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.emptyPanel}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function MetricCard({ metric, index }: { metric: RecentProductionMetric; index: number }) {
  const trend = metric.trend || "flat";
  const Icon = metricIcons[index % metricIcons.length];

  return (
    <article className={`${styles.card} ${styles.metricCard}`}>
      <div className={styles.metricTop}>
        <div>
          <div className={styles.metricLabel}>{metric.label}</div>
          <div className={styles.metricValue}>{metric.value}</div>
        </div>
        <div className={styles.metricIcon} aria-hidden="true">
          <Icon size={18} />
        </div>
      </div>
      <div className={styles.metricFooter}>
        <span className={`${styles.trend} ${styles[trend]}`}>
          {metric.percent == null ? metric.helper || "No change" : `${trend === "up" ? "Up" : trend === "down" ? "Down" : "Flat"} ${Math.abs(metric.percent)}%`}
        </span>
        <svg className={styles.spark} viewBox="0 0 76 24" aria-label={`${metric.label} trend`}>
          <polyline
            points="1,18 10,15 18,17 27,7 35,12 43,5 53,11 62,7 75,9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </div>
    </article>
  );
}

function ProductionRow({ production }: { production: RecentProduction }) {
  const score = production.performanceScore ?? production.qualityScore ?? 0;

  return (
    <tr>
      <td>
        <div className={styles.productionCell}>
          {production.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={production.thumbnailUrl} alt="" className={styles.thumbnail} />
          ) : (
            <div className={styles.thumbnail} aria-hidden="true" />
          )}
          <div>
            <div className={styles.productionTitle}>{production.title}</div>
            <div className={styles.meta}>{production.code}</div>
          </div>
        </div>
      </td>
      <td>{production.type}</td>
      <td>
        <span className={`${styles.badge} ${styles[production.status]}`}>{statusLabel[production.status]}</span>
      </td>
      <td>
        <div className={styles.owner}>
          <div className={styles.avatar}>{initials(production.owner.name)}</div>
          <span>{production.owner.name}</span>
        </div>
      </td>
      <td>{formatDate(production.completedAt)}</td>
      <td>{formatDate(production.publishedAt)}</td>
      <td>{production.channel || "-"}</td>
      <td>
        <div className={styles.score}>
          <div className={styles.scoreTrack}>
            <div className={styles.scoreFill} style={{ width: `${score}%` }} />
          </div>
          <strong>{score}%</strong>
        </div>
      </td>
      <td>
        <button className={styles.smallButton} type="button" aria-label={`Actions for ${production.title}`}>
          <MoreHorizontal size={16} />
        </button>
      </td>
    </tr>
  );
}

export function RecentProductionsPage() {
  const [data, setData] = useState<RecentProductionsResponse>(emptyResponse);
  const [query, setQuery] = useState<RecentProductionsQuery>({
    page: 1,
    pageSize: 10,
    sort: "completedAt:desc"
  });
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await getRecentProductions(
        {
          ...query,
          status: activeStatus === "all" ? undefined : activeStatus
        },
        controller.signal
      );
      setData(result);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Unable to load recent productions.");
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [activeStatus, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize)));
  const visiblePages = useMemo(
    () => Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1),
    [pageCount]
  );

  const chartPoints = useMemo(() => {
    if (!data.performance.length) {
      return {
        completed: "0,170 100,170 200,170 300,170 400,170 500,170 600,170",
        published: "0,175 100,175 200,175 300,175 400,175 500,175 600,175",
        failed: "0,180 100,180 200,180 300,180 400,180 500,180 600,180"
      };
    }

    const max = Math.max(1, ...data.performance.flatMap((point) => [point.completed, point.published, point.failed]));

    const toPoints = (field: "completed" | "published" | "failed") =>
      data.performance
        .map((point, index) => {
          const x = (index / Math.max(1, data.performance.length - 1)) * 600;
          const y = 180 - (point[field] / max) * 150;
          return `${x},${y}`;
        })
        .join(" ");

    return {
      completed: toPoints("completed"),
      published: toPoints("published"),
      failed: toPoints("failed")
    };
  }, [data.performance]);

  const metricFallback: RecentProductionMetric[] = [
    { key: "recent", label: "Recent Productions", value: data.total, trend: "flat" },
    { key: "completed", label: "Completed", value: 0, trend: "flat" },
    { key: "published", label: "Published", value: 0, trend: "flat" },
    { key: "archived", label: "Archived", value: 0, trend: "flat" },
    { key: "failed", label: "Failed", value: 0, trend: "flat" },
    { key: "quality", label: "Avg. Quality Score", value: "0%", trend: "flat" }
  ];

  const colors = ["#16a34a", "#2563eb", "#64748b", "#f59e0b", "#ef4444"];

  return (
    <section className={styles.shell} aria-labelledby="recent-productions-title">
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>Home / Recent Productions</div>
            <h1 className={styles.title} id="recent-productions-title">Recent Productions</h1>
            <p className={styles.subtitle}>
              Review productions recently completed, published, archived, cancelled, or failed.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.control} type="button">Workspace: CACSMS Studio</button>
            <button className={styles.control} type="button">Brand: CACSMS</button>
            <button className={styles.control} type="button">Date Range</button>
            <button className={styles.button} type="button" onClick={() => void load()}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className={styles.button} type="button">
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

        <section className={styles.metricGrid} aria-label="Recent production metrics">
          {(data.metrics.length ? data.metrics : metricFallback).map((metric, index) => (
            <MetricCard key={metric.key} metric={metric} index={index} />
          ))}
        </section>

        <section className={styles.overviewGrid}>
          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Recent Productions ({data.total})</div>
              <div className={styles.sectionActions}>
                <select
                  className={styles.select}
                  value={query.sort}
                  onChange={(event) => setQuery((current) => ({ ...current, sort: event.target.value, page: 1 }))}
                  aria-label="Sort recent productions"
                >
                  <option value="completedAt:desc">Recently Completed</option>
                  <option value="publishedAt:desc">Recently Published</option>
                  <option value="qualityScore:desc">Highest Quality</option>
                  <option value="performanceScore:desc">Best Performance</option>
                </select>
                <button
                  className={styles.smallButton}
                  type="button"
                  onClick={() => void exportRecentProductions({ ...query, status: activeStatus === "all" ? undefined : activeStatus })}
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            <div className={styles.tabs}>
              {[
                ["all", "All"],
                ["completed", "Completed"],
                ["published", "Published"],
                ["archived", "Archived"],
                ["cancelled", "Cancelled"],
                ["failed", "Failed"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`${styles.tab} ${activeStatus === value ? styles.tabActive : ""}`}
                  type="button"
                  onClick={() => {
                    setActiveStatus(value);
                    setQuery((current) => ({ ...current, page: 1 }));
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Production</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Completed</th>
                    <th>Published</th>
                    <th>Channel</th>
                    <th>Score</th>
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
                  <h3>No recent productions</h3>
                  <p>Completed, published, archived, cancelled, and failed productions will appear here.</p>
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
                    type="button"
                    className={`${styles.pageButton} ${page === data.page ? styles.activePage : ""}`}
                    onClick={() => setQuery((current) => ({ ...current, page }))}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </article>

          <aside className={styles.sideStack}>
            <article className={styles.card}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Productions by Status</div>
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
                  {data.statusBreakdown.map((item, index) => (
                    <div className={styles.legendRow} key={item.status}>
                      <span className={styles.legendSwatch} style={{ background: colors[index % colors.length] }} />
                      <span>{statusLabel[item.status]}</span>
                      <strong>{item.count}</strong>
                      <span>{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Production Types</div>
                <button className={styles.smallButton} type="button">
                  View All <ChevronRight size={14} />
                </button>
              </div>
              <div className={styles.chartBody}>
                <div className={styles.typeList}>
                  {data.typeBreakdown.length ? data.typeBreakdown.map((item) => (
                    <div className={styles.typeRow} key={item.type}>
                      <span>{item.type}</span>
                      <div className={styles.bar}>
                        <div className={styles.barFill} style={{ width: `${item.percentage}%` }} />
                      </div>
                      <strong>{item.count} ({item.percentage}%)</strong>
                    </div>
                  )) : <EmptyPanel title="No production types" detail="Type distribution will appear after productions complete." />}
                </div>
              </div>
            </article>
          </aside>
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Recent Production Performance</div>
              <button className={styles.smallButton} type="button">
                View Analytics <ChevronRight size={14} />
              </button>
            </div>
            <div className={styles.performanceBody}>
              <div className={styles.performanceSummary}>
                {[
                  ["Completed", data.statusBreakdown.find((item) => item.status === "completed")?.count ?? 0],
                  ["Published", data.statusBreakdown.find((item) => item.status === "published")?.count ?? 0],
                  ["Failed", data.statusBreakdown.find((item) => item.status === "failed")?.count ?? 0],
                  [
                    "Success Rate",
                    data.total
                      ? `${Math.round((((data.statusBreakdown.find((item) => item.status === "completed")?.count ?? 0) + (data.statusBreakdown.find((item) => item.status === "published")?.count ?? 0)) / data.total) * 100)}%`
                      : "0%"
                  ]
                ].map(([label, value]) => (
                  <div className={styles.summaryItem} key={String(label)}>
                    <div className={styles.summaryLabel}>{label}</div>
                    <div className={styles.summaryValue}>{value}</div>
                  </div>
                ))}
              </div>
              <svg className={styles.chart} viewBox="0 0 600 190" preserveAspectRatio="none" aria-label="Recent production performance chart">
                {[30, 65, 100, 135, 170].map((y) => (
                  <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e8ebf1" strokeWidth="1" />
                ))}
                <polyline points={chartPoints.completed} fill="none" stroke="#16a34a" strokeWidth="3" />
                <polyline points={chartPoints.published} fill="none" stroke="#2563eb" strokeWidth="3" />
                <polyline points={chartPoints.failed} fill="none" stroke="#ef4444" strokeWidth="2" />
              </svg>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Channel Performance</div>
              <button className={styles.smallButton} type="button">View All</button>
            </div>
            <div className={styles.list}>
              {data.channelPerformance.length ? data.channelPerformance.slice(0, 6).map((item) => (
                <div className={styles.listItem} key={item.channel}>
                  <div className={styles.channelIcon}><Rocket size={16} /></div>
                  <div>
                    <div className={styles.listTitle}>{item.channel}</div>
                    <div className={styles.listSub}>{item.productions} productions / {item.views.toLocaleString()} views</div>
                  </div>
                  <strong>{item.engagementRate}%</strong>
                </div>
              )) : <EmptyPanel title="No channel data" detail="Channel performance will appear after publishing." />}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>Recent Activity</div>
              <button className={styles.smallButton} type="button">View All</button>
            </div>
            <div className={styles.list}>
              {data.activity.length ? data.activity.slice(0, 6).map((item) => (
                <div className={styles.listItem} key={item.id}>
                  <div className={styles.avatar}>{initials(item.actor)}</div>
                  <div>
                    <div className={styles.listTitle}>{item.actor} {item.action}</div>
                    <div className={styles.listSub}>{item.productionTitle}</div>
                  </div>
                  <span className={styles.meta}>{relativeTime(item.createdAt)}</span>
                </div>
              )) : <EmptyPanel title="No recent activity" detail="Completion and publishing updates will show here." />}
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
