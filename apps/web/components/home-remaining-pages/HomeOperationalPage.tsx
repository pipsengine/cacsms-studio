"use client";

import { useCallback, useEffect, useState } from "react";
import { Filter, RefreshCw } from "lucide-react";
import { getHomeOperationalPage, runPageAction } from "@/lib/api/home-remaining-pages";
import type { HomeOperationalPageConfig } from "@/lib/home-operational-pages";
import type { HomeOperationalResponse, OperationalRow, PageMetric } from "@/types/home-remaining-pages";
import styles from "./HomeOperationalPage.module.css";

const empty: HomeOperationalResponse = {
  generatedAt: new Date(0).toISOString(),
  metrics: [],
  rows: [],
  panels: {},
  total: 0,
  page: 1,
  pageSize: 20
};

function statusClass(status?: string | null) {
  return status ? styles[status.replaceAll("-", "")] || "" : "";
}

function MetricCard({ metric }: { metric: PageMetric }) {
  const trend = metric.trend || "flat";
  const indicator = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  return (
    <article className={`${styles.card} ${styles.metric}`}>
      <div className={styles.metricLabel}>{metric.label}</div>
      <div className={styles.metricValue}>{metric.value}</div>
      <div className={`${styles.metricFoot} ${styles[trend] || ""}`}>
        {metric.percent == null ? metric.helper || "—" : `${indicator} ${Math.abs(metric.percent)}%`}
      </div>
    </article>
  );
}

function cellValue(row: OperationalRow, column: string) {
  const key = column.toLowerCase().replaceAll(" ", "");
  if (["Production", "Agent", "Event", "Notification", "Service"].includes(column)) {
    return <><div className={styles.primaryText}>{row.title}</div><div className={styles.meta}>{row.subtitle || row.id}</div></>;
  }
  if (column === "Status") {
    return <span className={`${styles.badge} ${statusClass(row.status)}`}>{row.status || "—"}</span>;
  }
  if (column === "Progress") {
    const progress = Math.min(100, Math.max(0, row.progress ?? Number(row.values.progress ?? 0)));
    return <div className={styles.progress}><div className={styles.track}><div className={styles.fill} style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>;
  }
  return String(row.values[key] ?? row.values[column] ?? "—");
}

export function HomeOperationalPage({ config }: { config: HomeOperationalPageConfig }) {
  const [data, setData] = useState<HomeOperationalResponse>(empty);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setLoading(true);
      setData(await getHomeOperationalPage(config.slug, signal));
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : `Unable to load ${config.title}.`);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [config.slug, config.title]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const metrics = data.metrics.length ? data.metrics : config.metricLabels.map((label, index) => ({
    key: `${config.slug}-${index}`,
    label,
    value: label.toLowerCase().includes("score") || label.toLowerCase().includes("success") || label.toLowerCase().includes("utilization") ? "0%" : 0,
    trend: "flat" as const
  }));

  async function pageAction(action: string) {
    try {
      setActionPending(true);
      setError(null);
      await runPageAction(config.slug, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionPending(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="operational-page-title">
      <header className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>Home / {config.title}</div>
          <h1 className={styles.title} id="operational-page-title">{config.title}</h1>
          <p className={styles.subtitle}>{config.description}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button">Workspace · CACSMS Studio</button>
          <button className={styles.button} type="button">Brand · CACSMS</button>
          <button className={styles.button} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <button className={styles.button} type="button"><Filter size={15} /> Filters</button>
          {config.slug === "system-health" && <button className={styles.primary} type="button" disabled={actionPending} onClick={() => void pageAction("run-checks")}>Run Health Checks</button>}
          {config.slug === "notifications" && <button className={styles.primary} type="button" disabled={actionPending} onClick={() => void pageAction("read-all")}>Mark All Read</button>}
        </div>
      </header>

      {error && <div className={`${styles.card} ${styles.error}`} role="alert">{error}</div>}
      <section className={styles.metrics} aria-label={`${config.title} metrics`}>
        {metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>{config.title} ({data.total})</div>
            <div className={styles.actions}><button className={styles.small} type="button">List</button><button className={styles.small} type="button">Export</button></div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{data.rows.map((row) => <tr key={row.id}>{config.columns.map((column) => <td key={column}>{cellValue(row, column)}</td>)}</tr>)}</tbody>
            </table>
            {!data.rows.length && <div className={styles.empty}>{loading ? "Loading…" : `No ${config.entityLabel.toLowerCase()} records available.`}</div>}
          </div>
        </article>

        <aside className={styles.side}>
          {config.panelTitles.map((title) => (
            <article className={styles.card} key={title}>
              <div className={styles.sectionHeader}><div className={styles.sectionTitle}>{title}</div></div>
              <div className={styles.panel}>
                {(data.panels[title] || []).map((item) => <div className={styles.item} key={item.id}><div className={styles.icon}>•</div><div><div className={styles.primaryText}>{item.title}</div><div className={styles.meta}>{item.subtitle || ""}</div></div>{item.status ? <span className={`${styles.badge} ${statusClass(item.status)}`}>{item.status}</span> : <strong>{item.value ?? ""}</strong>}</div>)}
                {!data.panels[title]?.length && <div className={styles.empty}>No data available.</div>}
              </div>
            </article>
          ))}
        </aside>
      </section>

      <footer className={styles.footer}><span>© 2026 CACSMS Autonomous Media Studio.</span><span>{loading ? "Updating operational data…" : `Updated ${new Date(data.generatedAt).toLocaleString()}`}</span></footer>
    </section>
  );
}
