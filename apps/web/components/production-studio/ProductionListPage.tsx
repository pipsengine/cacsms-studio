"use client";

import Link from "next/link";
import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchProductionStudioPage } from "@/lib/api/production-studio";
import type { ProductionPageConfig } from "@/lib/production-studio-pages";
import type { ProductionPageResponse } from "@/types/production-studio";
import styles from "./ProductionStudio.module.css";

const empty = (slug: string): ProductionPageResponse => ({ generatedAt: new Date(0).toISOString(), slug, metrics: [], records: [], panels: {}, total: 0 });

export function ProductionListPage({ config }: { config: ProductionPageConfig }) {
  const [data, setData] = useState(() => empty(config.slug));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { setData(await fetchProductionStudioPage(config.slug, signal)); }
    catch (cause) { if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "Unable to load this page."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [config.slug]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const records = data.records.filter((record) => `${record.title} ${record.code} ${record.owner} ${record.type}`.toLowerCase().includes(query.toLowerCase()));
  const metrics = config.metricLabels.map((label, index) => data.metrics[index] ?? { key: label, label, value: "—", helper: loading ? "Loading…" : "No data available" });

  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.breadcrumb}>Production Studio / {config.title}</div><h1 className={styles.title}>{config.title}</h1><p className={styles.subtitle}>{config.description}</p></div>
      <div className={styles.actions}><button className={styles.control}>Workspace · CACSMS Studio</button><button className={styles.button} onClick={() => void load()} disabled={loading}><RefreshCw size={13}/> Refresh</button><Link className={styles.primary} href="/production-studio/create-production">{config.primaryAction}</Link></div></header>
    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    <div className={styles.metrics}>{metrics.map((metric) => <article className={`${styles.card} ${styles.metric}`} key={metric.key}><div className={styles.metricLabel}>{metric.label}</div><div className={styles.metricValue}>{metric.value}</div><div className={styles.metricHelper}>{metric.helper}</div></article>)}</div>
    <div className={styles.gridTwo}><article className={styles.card}><div className={styles.sectionHeader}><div className={styles.sectionTitle}>{config.title}</div><span className={styles.meta}>{data.total} total</span></div><div className={styles.filters}><div className={styles.row + " " + styles.search}><Search size={14}/><input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search productions" /></div><button className={styles.button}><SlidersHorizontal size={13}/> Filters</button></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={record.id}>{config.columns.map((column) => <td key={column}>{renderCell(column, record)}</td>)}</tr>)}</tbody></table>{!loading && records.length === 0 ? <div className={styles.empty}>No production records found.</div> : null}{loading ? <div className={styles.empty}>Loading production data…</div> : null}</div></article>
      <aside className={styles.list}>{config.panelTitles.map((title) => <article className={styles.card} key={title}><div className={styles.sectionHeader}><div className={styles.sectionTitle}>{title}</div></div><div className={styles.panelBody}>{(data.panels[title] ?? []).map((item) => <div className={styles.panelItem} key={item.id}><span>{item.label}<small className={styles.meta}>{item.detail}</small></span><strong>{item.value}</strong></div>)}{!loading && !(data.panels[title]?.length) ? <div className={styles.empty}>No items to display.</div> : null}</div></article>)}</aside></div>
    <footer className={styles.footer}><span>© 2026 CACSMS Autonomous Media Studio.</span><span>{loading ? "Updating production data…" : `Updated ${new Date(data.generatedAt).toLocaleString()}`}</span></footer>
  </section>;
}

function renderCell(column: string, record: ProductionPageResponse["records"][number]) {
  const key = column.toLowerCase();
  if (key.includes("production") || key.includes("queue item")) return <div><div className={styles.primaryText}>{record.title}</div><div className={styles.meta}>{record.code}</div></div>;
  if (key === "progress") return <div className={styles.progress}><div className={styles.track}><div className={styles.fill} style={{ width: `${record.progress}%` }}/></div><strong>{record.progress}%</strong></div>;
  if (key === "status") return <span className={`${styles.badge} ${styles[record.status.replaceAll("-", "")] ?? ""}`}>{record.status.replaceAll("-", " ")}</span>;
  if (key === "type") return record.type; if (key === "stage") return record.stage; if (key === "owner") return record.owner;
  if (key === "deadline") return record.deadline ?? "—"; if (key === "updated") return new Date(record.updatedAt).toLocaleDateString();
  return String(record.values?.[key] ?? "—");
}
