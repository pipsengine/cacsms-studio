"use client";

import {
  Bell,
  BookOpen,
  BrainCircuit,
  CheckCheck,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Eye,
  FlaskConical,
  Globe2,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import styles from "./ResearchWorkspacePage.module.css";

type Tone = "teal" | "blue" | "violet" | "amber" | "green";
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
type ResearchRow = {
  id: string;
  title: string;
  category: string;
  sources: number;
  diversity: number;
  freshness: number;
  provenance: number;
  risk: number;
  readiness: number;
  score: number;
  status: string;
  handoff: string;
  route: string;
};

const metricIcons: LucideIcon[] = [DatabaseZap, BookOpen, ShieldCheck, CheckCheck];
const fallbackMetrics: ApiMetric[] = [
  {value: "--", label: "Research records", tone: "teal"},
  {value: "--", label: "High confidence", tone: "green"},
  {value: "--", label: "Evidence score", tone: "blue"},
  {value: "--", label: "Autonomous actions", tone: "amber"},
];
const moduleSignals = [
  ["Opportunity Intelligence", "20", Target, "teal"],
  ["Knowledge Intelligence", "1.8M", BookOpen, "blue"],
  ["Writing Studio", "19", Sparkles, "violet"],
  ["Story & Learning", "17", BrainCircuit, "green"],
  ["Storyboard Studio", "15", Layers3, "amber"],
  ["Visual Studio", "20", Eye, "teal"],
] as const;
const agentSignals: [string, string, LucideIcon, string][] = [
  ["Scout Agent", "Collecting cross-source evidence", Eye, "blue"],
  ["Analyst Agent", "Clustering claims and themes", BrainCircuit, "violet"],
  ["Verifier Agent", "Resolving contradiction risk", CheckCheck, "green"],
  ["Synthesizer Agent", "Preparing production handoff", Zap, "amber"],
];
const fallbackRows: ResearchRow[] = [
  {id: "fallback-1", title: "AI in Nigerian Manufacturing", category: "Industrial AI", sources: 38, diversity: 92, freshness: 95, provenance: 94, risk: 8, readiness: 91, score: 92, status: "Auto-synthesizing", handoff: "Script brief queued", route: "Scout -> Analyst -> Verifier -> Production handoff"},
  {id: "fallback-2", title: "Digital Twins for Industrial Automation", category: "Industry 4.0", sources: 31, diversity: 88, freshness: 90, provenance: 91, risk: 11, readiness: 86, score: 88, status: "Evidence clustering", handoff: "Storyboard pack queued", route: "Scout -> Analyst -> Verifier -> Production handoff"},
];

function numberAttr(attributes: Record<string, unknown>, key: string, fallback: number) {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringAttr(attributes: Record<string, unknown>, key: string, fallback: string) {
  const value = attributes[key];
  return typeof value === "string" ? value : fallback;
}

function rowFromRecord(record: ApiRecord): ResearchRow {
  return {
    id: record.id,
    title: record.title,
    category: record.category || record.subtitle,
    sources: numberAttr(record.attributes, "sourceCount", Math.max(12, Math.round(record.score / 3))),
    diversity: numberAttr(record.attributes, "evidenceDiversity", Math.min(96, record.score + 1)),
    freshness: numberAttr(record.attributes, "freshness", Math.min(98, record.score + 2)),
    provenance: numberAttr(record.attributes, "provenance", Math.min(97, record.score + 1)),
    risk: numberAttr(record.attributes, "contradictionRisk", Math.max(4, 100 - record.score)),
    readiness: numberAttr(record.attributes, "synthesisReadiness", Math.min(95, record.score)),
    score: record.score,
    status: record.status,
    handoff: stringAttr(record.attributes, "handoff", "Autonomous handoff queued"),
    route: stringAttr(record.attributes, "agentRoute", "Scout -> Analyst -> Verifier -> Production handoff"),
  };
}

function formatTime(value: string | null) {
  if (!value) return "awaiting first autonomous sync";
  return new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"}).format(new Date(value));
}

export function ResearchWorkspacePage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/content-intelligence/research-workspace", {cache: "no-store", signal});
      const payload = (await response.json()) as ApiData | {message?: string};
      if (!response.ok) throw new Error("message" in payload && payload.message ? payload.message : "Unable to load autonomous research data.");
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
    return source.filter((row) => `${row.title} ${row.category} ${row.status} ${row.handoff} ${row.route}`.toLowerCase().includes(lowered));
  }, [data, query]);
  const top = rows[0];
  const verifiedSources = rows.reduce((sum, row) => sum + row.sources, 0);
  const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  const highConfidence = rows.filter((row) => row.score >= 88).length;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.crumb}>Content Intelligence <span>/</span> Research Workspace</div>
          <h1>Autonomous Research Workspace</h1>
          <p>Continuously discovers, collects, verifies, synthesizes, and hands off research through autonomous agent orchestration.</p>
        </div>
        <div className={styles.selectors}>
          <button>Workspace - CACSMS Studio</button>
          <button>Brand - CACSMS</button>
          <button aria-label="Notifications"><Bell size={15}/></button>
        </div>
      </header>

      <section className={styles.engineBar}>
        <i><FlaskConical size={23}/></i>
        <div>
          <b>Autonomous Research Orchestration Engine</b>
          <small>Last autonomous sync: {formatTime(data?.updatedAt ?? null)} | algorithm: autonomous-evidence-fusion-v2</small>
        </div>
        <span><i/>Scout, Analyst, Verifier, Synthesizer live</span>
        <button><RefreshCw className={loading ? styles.spin : ""} size={14}/>Auto-sync 30s</button>
        <button className={styles.primary}><ShieldCheck size={15}/>No human input</button>
      </section>

      {error ? <p className={styles.notice}>{error}</p> : null}

      <section className={styles.metrics}>
        {metrics.slice(0, 4).map(({value, label, tone}, index) => {
          const Icon = metricIcons[index] ?? DatabaseZap;
          return (
            <article data-tone={tone} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{index === 0 ? "DB-backed records" : "Live autonomous scoring"}</p>
              <Icon/>
            </article>
          );
        })}
      </section>

      <section className={styles.modules}>
        {moduleSignals.map(([label, value, Icon, tone]) => <article data-tone={tone} key={label}><Icon size={17}/><strong>{value}</strong><span>{label}</span></article>)}
      </section>

      <div className={styles.grid}>
        <main>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <div>
                <h2><BrainCircuit size={16}/>Autonomous Research Queue</h2>
                <p>Evidence packs are ranked by source depth, diversity, freshness, provenance, risk, and synthesis readiness.</p>
              </div>
              <button><Clock3 size={14}/>Continuous</button>
              <button><CheckCircle2 size={14}/>Auto-handoff</button>
            </div>
            <div className={styles.tabs}>
              {["Autonomous queue", `${highConfidence} high confidence`, `${verifiedSources} verified sources`, `${avgScore}% avg score`].map((label, index) => <button className={index === 0 ? styles.active : ""} key={label}>{label}</button>)}
            </div>
            <label className={styles.search}><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Observer search across autonomous research decisions..."/></label>
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span>RESEARCH SUBJECT</span><span>SOURCES</span><span>DIVERSITY</span><span>PROVENANCE</span><span>RISK</span><span>SCORE</span><span>AUTONOMOUS STATUS</span>
              </div>
              {rows.map((row, index) => (
                <article className={index === 0 ? styles.highlight : ""} key={row.id}>
                  <span><b>{row.title}</b><small>{row.category} | {row.handoff}</small></span>
                  <strong>{row.sources}</strong>
                  <span className={styles.bar}><b>{row.diversity}%</b><i><u style={{width: `${row.diversity}%`}}/></i></span>
                  <span className={styles.bar}><b>{row.provenance}%</b><i><u style={{width: `${row.provenance}%`}}/></i></span>
                  <em data-risk={row.risk <= 10 ? "low" : row.risk <= 14 ? "medium" : "high"}>{row.risk}%</em>
                  <span className={styles.score}><b>{row.score} / 100</b><i><u style={{width: `${row.score}%`}}/></i></span>
                  <em>{row.status}</em>
                </article>
              ))}
            </div>
            <footer>{rows.length} autonomous research decisions visible</footer>
          </section>
        </main>

        <aside>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h2><Sparkles size={16}/>Research Agents</h2>
              <button>Policy locked</button>
            </div>
            <div className={styles.agents}>
              {agentSignals.map(([name, detail, Icon, tone]) => <article key={name}><i data-tone={tone}><Icon/></i><span><b>{name}</b><small>{detail}</small></span><em>Live</em></article>)}
            </div>
          </section>

          <AutonomyPolicy/>
          <IntelligenceBrief top={top}/>
        </aside>
      </div>

      <div className={styles.bottom}>Autonomous sync policy: continuous DB-backed refresh every 30 seconds</div>
    </section>
  );
}

function AutonomyPolicy() {
  const items: [LucideIcon, string, string][] = [
    [Globe2, "Research horizon", "Continuous rolling window"],
    [DatabaseZap, "Source intake", "Automatic DB-backed ingestion"],
    [ShieldCheck, "Human input", "Not required"],
    [Layers3, "Lifecycle handoff", "Research -> Script -> Storyboard"],
  ];
  return (
    <section className={`${styles.panel} ${styles.policy}`}>
      <h2>Autonomy Policy</h2>
      {items.map(([Icon, label, value]) => <article key={label}><b>{label}</b><span><Icon size={13}/>{value}<CheckCircle2 size={12}/></span></article>)}
    </section>
  );
}

function IntelligenceBrief({top}: {top?: ResearchRow}) {
  return (
    <section className={`${styles.panel} ${styles.brief}`}>
      <div className={styles.panelTitle}><h2><Sparkles size={16}/>Autonomous Intelligence Brief</h2><button>Generated</button></div>
      <article>
        <b>RESEARCH MOMENTUM</b>
        <p>{top ? `${top.title} is leading the research queue. The engine has fused ${top.sources} sources with ${top.provenance}% provenance confidence and routed it through ${top.route.toLowerCase()}.` : "The engine is waiting for the first autonomous research sync."}</p>
        <small>Lifecycle handoff is governed by autonomous evidence confidence.</small>
      </article>
      <footer><span>Evidence score <b>{top ? `${top.score}%` : "--"}</b></span><span>Handoff <b>{top?.handoff ?? "Pending"}</b></span></footer>
    </section>
  );
}
