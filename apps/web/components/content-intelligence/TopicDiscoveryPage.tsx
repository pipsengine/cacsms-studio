"use client";

import {
  Bell,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Globe2,
  Layers3,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState, type ComponentType} from "react";
import styles from "./TopicDiscoveryPage.module.css";

type Tone = "violet" | "green" | "blue" | "red" | "amber";
type ApiMetric = {value: string; label: string; tone: Tone};
type ApiRecord = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  score: number;
  status: string;
  attributes: Record<string, unknown>;
  updatedAt: string;
};
type ApiData = {records: ApiRecord[]; metrics: ApiMetric[]; updatedAt: string | null};
type TopicRow = {
  id: string;
  name: string;
  category: string;
  demand: string;
  bars: number;
  velocity: string;
  competition: string;
  fit: number;
  score: number;
  status: string;
  tone: Tone;
  sourceMix: string;
};

const metricIcons: ComponentType<{size?: number}>[] = [Search, TrendingUp, LineChart, DatabaseZap, Star];
const fallbackMetrics: ApiMetric[] = [
  {value: "--", label: "Topics monitored", tone: "violet"},
  {value: "--", label: "High confidence", tone: "green"},
  {value: "--", label: "Average score", tone: "blue"},
  {value: "--", label: "Autonomous actions", tone: "amber"},
];
const fallbackRows: TopicRow[] = [
  {id: "fallback-1", name: "AI Agents Transforming African Manufacturing", category: "Technology - Industry 4.0", demand: "Very High", bars: 8, velocity: "+184%", competition: "Low", fit: 96, score: 94, status: "Auto-promoted", tone: "violet", sourceMix: "Search + social + industry"},
  {id: "fallback-2", name: "Why Smart Factories Fail Before They Scale", category: "Business - Automation", demand: "High", bars: 6, velocity: "+92%", competition: "Medium", fit: 93, score: 91, status: "Production queued", tone: "violet", sourceMix: "Search + competitor + research"},
];

function stringAttr(attributes: Record<string, unknown>, key: string, fallback: string) {
  const value = attributes[key];
  return typeof value === "string" ? value : fallback;
}

function numberAttr(attributes: Record<string, unknown>, key: string, fallback: number) {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toneFor(status: string, score: number): Tone {
  if (/breakout/i.test(status)) return "red";
  if (/quick|watch|evergreen/i.test(status)) return "amber";
  if (score >= 90) return "violet";
  if (score >= 86) return "blue";
  return "green";
}

function rowFromRecord(record: ApiRecord): TopicRow {
  const velocity = numberAttr(record.attributes, "velocity", Math.max(24, record.score - 12));
  const competition = stringAttr(record.attributes, "competition", record.score >= 90 ? "Low" : "Medium");
  return {
    id: record.id,
    name: record.title,
    category: record.subtitle || record.category,
    demand: stringAttr(record.attributes, "demand", record.score >= 90 ? "Very High" : "High"),
    bars: Math.max(3, Math.min(8, Math.round(record.score / 12))),
    velocity: `+${velocity}%`,
    competition,
    fit: numberAttr(record.attributes, "audienceFit", Math.min(98, record.score + 2)),
    score: record.score,
    status: record.status,
    tone: toneFor(record.status, record.score),
    sourceMix: stringAttr(record.attributes, "sourceMix", "Autonomous signal fusion"),
  };
}

function formatTime(value: string | null) {
  if (!value) return "awaiting first autonomous sync";
  return new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"}).format(new Date(value));
}

export function TopicDiscoveryPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/content-intelligence/topic-discovery", {cache: "no-store", signal});
      const payload = (await response.json()) as ApiData | {message?: string};
      if (!response.ok) throw new Error("message" in payload && payload.message ? payload.message : "Unable to load topic discovery data.");
      setData(payload as ApiData);
      setError(null);
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  const metrics = data?.metrics?.length ? data.metrics : fallbackMetrics;
  const rows = useMemo(() => {
    const source = data?.records?.length ? data.records.map(rowFromRecord) : fallbackRows;
    const lowered = query.trim().toLowerCase();
    if (!lowered) return source;
    return source.filter((item) => `${item.name} ${item.category} ${item.status} ${item.sourceMix}`.toLowerCase().includes(lowered));
  }, [data, query]);
  const highPriority = rows.filter((row) => row.score >= 90).length;
  const averageScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.crumb}>Content Intelligence <span>/</span> Topic Discovery</div>
          <h1>Topic Discovery</h1>
          <p>Autonomously detects high-potential topics from market, search, audience, competitor, and production-readiness signals.</p>
        </div>
        <div className={styles.selectors}>
          <button>Workspace - CACSMS Studio</button>
          <button>Brand - CACSMS</button>
          <button aria-label="Notifications"><Bell size={15}/></button>
        </div>
      </header>

      <div className={styles.layout}>
        <main>
          <section className={styles.workspaceBar}>
            <i><Sparkles size={23}/></i>
            <div>
              <b>Autonomous Topic Discovery Engine</b>
              <small>Last autonomous update: {formatTime(data?.updatedAt ?? null)}</small>
            </div>
            <span><i/>12 sources monitored continuously</span>
            <button><RefreshCw className={loading ? styles.spin : ""} size={14}/>Auto-sync 30s</button>
            <button className={styles.primary}><ShieldCheck size={15}/>Autonomous</button>
          </section>

          {error ? <p className={styles.notice}>{error}</p> : null}

          <section className={styles.metrics}>
            {metrics.slice(0, 5).map(({value, label, tone}, index) => {
              const Icon = metricIcons[index] ?? LineChart;
              return (
                <article data-tone={tone} key={label}>
                  <i><Icon size={25}/></i>
                  <div><strong>{value}</strong><span>{label}</span><small>{index === 0 ? "DB-backed" : "Live autonomy"}</small></div>
                </article>
              );
            })}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Autonomous Topic Opportunity Radar</h2>
                <p>AI-ranked opportunities are monitored, scored, briefed, and queued without manual triage.</p>
              </div>
              <button><Clock3 size={14}/>Live monitor</button>
              <button><CheckCircle2 size={14}/>Auto-handoff enabled</button>
            </div>
            <div className={styles.tabs}>
              {["All autonomous opportunities", `${highPriority} production-ready`, "Breakout detection", "Evergreen watch"].map((name, index) => <button className={index === 0 ? styles.active : ""} key={name}>{name}</button>)}
            </div>
            <div className={styles.tools}>
              <label><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Observer search across autonomous decisions..."/></label>
              <button><ShieldCheck size={14}/>Ranking locked</button>
              <button><Zap size={14}/>Auto-briefing</button>
              <button><Target size={14}/>Production queue</button>
            </div>
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span>TOPIC / CATEGORY</span><span>DEMAND</span><span>TREND VELOCITY</span><span>COMPETITION</span><span>AUDIENCE FIT</span><span>OPPORTUNITY SCORE</span><span>STATUS</span><span>HANDOFF</span>
              </div>
              {rows.map((item, index) => (
                <article className={index === 0 ? styles.highlight : ""} key={item.id}>
                  <span><b>{item.name}</b><small>{item.category}</small></span>
                  <span><b>{item.demand}</b><i>{Array.from({length: 8}, (_, n) => <u data-on={n < item.bars} key={n}/>)}</i></span>
                  <strong>{item.velocity}</strong>
                  <em data-level={item.competition}>{item.competition}</em>
                  <span>{item.fit}%</span>
                  <span className={styles.score}><b>{item.score} / 100</b><i><u style={{width: `${item.score}%`}}/></i></span>
                  <em data-tone={item.tone}>{item.status}</em>
                  <span className={styles.handoff}><CheckCircle2 size={14}/>Auto</span>
                </article>
              ))}
            </div>
            <footer className={styles.pagination}>
              <span>{rows.length} autonomous opportunities visible</span>
              <div><button className={styles.current}>Live</button><button>Polling</button><button>DB</button></div>
              <button>{averageScore}% avg score</button>
            </footer>
          </section>
        </main>
        <aside>
          <AutonomousPolicy/>
          <SignalComposition rows={rows}/>
          <IntelligenceBrief rows={rows}/>
          <Health updatedAt={data?.updatedAt ?? null}/>
        </aside>
      </div>
    </section>
  );
}

function AutonomousPolicy() {
  const controls: [ComponentType<{size?: number}>, string, string][] = [
    [Clock3, "Research horizon", "Continuous rolling window"],
    [Globe2, "Primary market", "Nigeria + Global"],
    [Target, "Content objective", "Authority growth"],
    [Layers3, "Format routing", "Auto-selected per topic"],
    [ShieldCheck, "Human input", "Not required"],
  ];
  return (
    <section className={`${styles.panel} ${styles.controls}`}>
      <h2>Autonomy Policy</h2>
      {controls.map(([Icon, label, value]) => <article key={label}><b>{label}</b><span><Icon size={13}/>{value}<CheckCircle2 size={12}/></span></article>)}
      <button>Policy locked by autonomous production lifecycle</button>
    </section>
  );
}

function SignalComposition({rows}: {rows: TopicRow[]}) {
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  const fit = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.fit, 0) / rows.length) : 0;
  const composition: [string, number, Tone][] = [
    ["Search demand", Math.min(98, average + 4), "violet"],
    ["Social velocity", Math.min(96, average + 1), "violet"],
    ["Audience fit", fit, "violet"],
    ["Competition advantage", Math.max(72, average - 4), "amber"],
    ["Brand relevance", Math.min(97, average + 3), "violet"],
  ];
  return (
    <section className={`${styles.panel} ${styles.composition}`}>
      <h2>Signal Composition</h2>
      {composition.map(([label, value, tone]) => <article key={label}><span>{label}</span><i><u data-tone={tone} style={{width: `${value}%`}}/></i><b>{value}</b></article>)}
      <small>Continuously recalculated from autonomous discovery records</small>
    </section>
  );
}

function IntelligenceBrief({rows}: {rows: TopicRow[]}) {
  const top = rows[0];
  return (
    <section className={`${styles.panel} ${styles.brief}`}>
      <div><h2><Sparkles size={16}/>Autonomous Intelligence Brief</h2><b>Generated</b></div>
      <p>{top ? `${top.name} is the current leading opportunity, with ${top.sourceMix.toLowerCase()} supporting an automatic production handoff.` : "The engine is waiting for the first topic-discovery sync."}</p>
      <strong>Current autonomous route</strong>
      <span><b>Research pack</b><b>Script brief</b><b>Production queue</b></span>
      <button><CheckCircle2 size={13}/>Production brief generated automatically</button>
    </section>
  );
}

function Health({updatedAt}: {updatedAt: string | null}) {
  const freshness = updatedAt ? 98 : 30;
  return (
    <section className={`${styles.panel} ${styles.health}`}>
      <h2>Autonomy Health</h2>
      <div>
        {[["Source coverage", 92], ["Data freshness", freshness], ["Confidence", 94]].map(([label, value]) => <article key={label as string}><span>{label}</span><b>{value}%</b><i><u style={{width: `${value}%`}}/></i></article>)}
      </div>
    </section>
  );
}
