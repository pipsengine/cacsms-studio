"use client";

import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  DatabaseZap,
  FileCheck2,
  FileText,
  Info,
  Link2,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import styles from "./SourceAnalysisPage.module.css";

type Tone = "violet" | "green" | "amber" | "red" | "blue";
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
type SourceRow = {
  id: string;
  title: string;
  publisher: string;
  type: string;
  authority: number;
  methodology: number;
  evidenceDepth: number;
  recency: number;
  transparency: number;
  biasNeutrality: number;
  corroboration: number;
  linkIntegrity: number;
  primaryRatio: number;
  claimsExtracted: number;
  citationCount: number;
  riskScore: number;
  score: number;
  status: string;
  handoff: string;
  icon: LucideIcon;
};

const metricIcons: LucideIcon[] = [ScanSearch, ShieldCheck, BarChart3, DatabaseZap, Link2];
const fallbackMetrics: ApiMetric[] = [
  {value: "--", label: "Sources scored", tone: "violet"},
  {value: "--", label: "High confidence", tone: "green"},
  {value: "--", label: "Average score", tone: "blue"},
  {value: "--", label: "Autonomous actions", tone: "amber"},
];
const fallbackRows: SourceRow[] = [
  {id: "fallback-1", title: "World Economic Forum - Future of Jobs 2025", publisher: "World Economic Forum - Institutional report", type: "Institutional Report", authority: 98, methodology: 94, evidenceDepth: 96, recency: 92, transparency: 95, biasNeutrality: 91, corroboration: 88, linkIntegrity: 98, primaryRatio: 64, claimsExtracted: 42, citationCount: 184, riskScore: 9, score: 94, status: "Auto-trusted", handoff: "Fact verification and knowledge extraction", icon: Building2},
  {id: "fallback-2", title: "Nigeria ICT Sector Statistics Q2 2026", publisher: "National Bureau of Statistics - Government dataset", type: "Government Dataset", authority: 97, methodology: 92, evidenceDepth: 89, recency: 98, transparency: 94, biasNeutrality: 93, corroboration: 78, linkIntegrity: 97, primaryRatio: 92, claimsExtracted: 28, citationCount: 74, riskScore: 9, score: 91, status: "Auto-primary", handoff: "Primary evidence linked", icon: Building2},
];

function numberAttr(attributes: Record<string, unknown>, key: string, fallback: number) {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringAttr(attributes: Record<string, unknown>, key: string, fallback: string) {
  const value = attributes[key];
  return typeof value === "string" ? value : fallback;
}

function sourceIcon(category: string) {
  if (/dataset|government|institution/i.test(category)) return Building2;
  if (/research|analysis|survey/i.test(category)) return BarChart3;
  if (/standard|technical/i.test(category)) return FileCheck2;
  if (/repository|report/i.test(category)) return BookOpen;
  return FileText;
}

function rowFromRecord(record: ApiRecord): SourceRow {
  const icon = sourceIcon(record.category);
  return {
    id: record.id,
    title: record.title,
    publisher: record.subtitle || "Autonomous source registry",
    type: record.category,
    authority: numberAttr(record.attributes, "authority", Math.min(98, record.score + 3)),
    methodology: numberAttr(record.attributes, "methodology", Math.min(96, record.score)),
    evidenceDepth: numberAttr(record.attributes, "evidenceDepth", Math.min(97, record.score + 1)),
    recency: numberAttr(record.attributes, "recency", Math.min(98, record.score + 2)),
    transparency: numberAttr(record.attributes, "transparency", Math.min(96, record.score)),
    biasNeutrality: numberAttr(record.attributes, "biasNeutrality", Math.min(94, record.score - 1)),
    corroboration: numberAttr(record.attributes, "corroboration", Math.min(90, record.score - 4)),
    linkIntegrity: numberAttr(record.attributes, "linkIntegrity", 94),
    primaryRatio: numberAttr(record.attributes, "primaryRatio", 60),
    claimsExtracted: numberAttr(record.attributes, "claimsExtracted", 24),
    citationCount: numberAttr(record.attributes, "citationCount", 72),
    riskScore: numberAttr(record.attributes, "riskScore", Math.max(4, 100 - record.score)),
    score: record.score,
    status: record.status,
    handoff: stringAttr(record.attributes, "handoff", "Autonomous evidence handoff"),
    icon,
  };
}

function formatTime(value: string | null) {
  if (!value) return "awaiting first autonomous sync";
  return new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"}).format(new Date(value));
}

function riskTone(risk: number) {
  if (risk <= 10) return "green";
  if (risk <= 18) return "amber";
  return "red";
}

export function SourceAnalysisPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/content-intelligence/source-analysis", {cache: "no-store", signal});
      const payload = (await response.json()) as ApiData | {message?: string};
      if (!response.ok) throw new Error("message" in payload && payload.message ? payload.message : "Unable to load autonomous source analysis data.");
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
    return source.filter((row) => `${row.title} ${row.publisher} ${row.type} ${row.status} ${row.handoff}`.toLowerCase().includes(lowered));
  }, [data, query]);
  const top = rows[0];
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  const links = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.linkIntegrity, 0) / rows.length) : 0;
  const primary = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.primaryRatio, 0) / rows.length) : 0;
  const corroboration = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.corroboration, 0) / rows.length) : 0;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.crumb}>Content Intelligence <span>/</span> Source Analysis</div>
          <h1>Autonomous Source Analysis</h1>
          <p>Continuously scores source authority, methodology, evidence depth, recency, bias neutrality, corroboration, and link integrity.</p>
        </div>
        <div className={styles.selectors}><button>Workspace - CACSMS Studio<ChevronDown size={13}/></button><button>Brand - CACSMS<ChevronDown size={13}/></button><button aria-label="Notifications"><Bell size={15}/></button></div>
      </header>

      <div className={styles.layout}>
        <main>
          <section className={styles.workspaceBar}>
            <i><ScanSearch size={23}/></i>
            <div><b>Autonomous Source Forensics Engine</b><small>Last autonomous sync: {formatTime(data?.updatedAt ?? null)} | algorithm: source-credibility-ensemble-v2</small></div>
            <span><i/>Source scoring active</span>
            <button><RefreshCw className={loading ? styles.spin : ""} size={14}/>Auto-sync 30s</button>
          </section>
          {error ? <p className={styles.notice}>{error}</p> : null}

          <section className={styles.metrics}>
            {metrics.slice(0, 5).map(({value, label, tone}, index) => {
              const Icon = metricIcons[index] ?? ScanSearch;
              return <article data-tone={tone} key={label}><i><Icon size={25}/></i><div><strong>{value}</strong><span>{label}</span><small>{index === 0 ? "DB-backed" : "Autonomous scoring"}</small></div></article>;
            })}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div><h2>Autonomous Source Forensics Registry</h2><p>Evidence is ranked by authority, methodology, corroboration, neutrality, link integrity, and lifecycle handoff readiness.</p></div>
              <button><ShieldCheck size={14}/>Policy locked</button>
              <button><Zap size={14}/>Auto-handoff</button>
            </div>
            <nav className={styles.tabs}>{["Autonomous sources", `${rows.filter((row) => row.score >= 90).length} high confidence`, `${corroboration}% corroboration`, `${average}% avg score`].map((name, index) => <button className={index === 0 ? styles.active : ""} key={name}>{name}</button>)}</nav>
            <div className={styles.tools}><label><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Observer search across autonomous source decisions..."/></label><button><ShieldCheck size={14}/>Quality model locked</button><button>Sort: Credibility Score<ChevronDown size={13}/></button><button><DatabaseZap size={14}/>DB-backed</button></div>
            <section className={styles.evidence}><article><ShieldCheck/><span>Independent corroboration<b>{corroboration}%</b></span></article><article><FileText/><span>Primary-source ratio<b>{primary}%</b></span></article><article><Link2/><span>Link integrity<b>{links}%</b></span></article></section>
            <div className={styles.table}>
              <div className={styles.tableHead}><span/><span>SOURCE / PUBLISHER</span><span>SOURCE TYPE</span><span>AUTHORITY</span><span>METHODOLOGY</span><span>RISK</span><span>CORROBORATION</span><span>CREDIBILITY <Info size={9}/></span><span>HANDOFF</span><span/></div>
              {rows.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article className={index === 0 ? styles.highlight : ""} key={item.id}>
                    <span>{index + 1}</span>
                    <span><b>{item.title}</b><small>{item.publisher}</small></span>
                    <span className={styles.type}><i><Icon size={13}/></i>{item.type}</span>
                    <span className={styles.authority}><b>{item.authority}%</b><i><u data-tone="green" style={{width: `${item.authority}%`}}/></i></span>
                    <span>{item.methodology}%</span>
                    <em data-tone={riskTone(item.riskScore)}>{item.riskScore}%</em>
                    <span>{item.corroboration}%</span>
                    <span className={styles.score}><b>{item.score} / 100</b><i><u style={{width: `${item.score}%`}}/></i></span>
                    <em data-tone={item.score >= 88 ? "green" : "amber"}>{item.status}</em>
                    <span><CheckCircle2 size={14}/></span>
                  </article>
                );
              })}
            </div>
            <footer className={styles.pagination}><span>{rows.length} autonomous source decisions visible</span><div><button className={styles.current}>Live</button><button>Polling</button><button>DB</button></div></footer>
          </section>
        </main>

        <aside>
          <SelectedSource source={top}/>
          <BiasProfile source={top}/>
          <QualitySignals source={top}/>
          <SourceBrief source={top}/>
        </aside>
      </div>
    </section>
  );
}

function SelectedSource({source}: {source?: SourceRow}) {
  return <section className={`${styles.panel} ${styles.selectedSource}`}><h2>Selected Autonomous Source</h2><h3>{source?.title ?? "Awaiting autonomous source"}</h3><div><figure><svg viewBox="0 0 120 75"><path d="M15 65 A45 45 0 1 1 105 65"/><path className={styles.gauge} d="M15 65 A45 45 0 1 1 105 65"/></svg><b>{source?.score ?? "--"}<small>/ 100</small></b><em>{source?.status ?? "Pending"}</em></figure><section>{[["Authority",source?.authority ?? 0],["Methodology",source?.methodology ?? 0],["Evidence depth",source?.evidenceDepth ?? 0],["Recency",source?.recency ?? 0],["Transparency",source?.transparency ?? 0],["Bias neutrality",source?.biasNeutrality ?? 0]].map(([name,value])=><article key={name as string}><span>{name}</span><i><u style={{width:`${value}%`}}/></i><b>{value}</b></article>)}</section></div><button><Sparkles size={13}/>Autonomous methodology generated</button></section>;
}

function BiasProfile({source}: {source?: SourceRow}) {
  return <section className={`${styles.panel} ${styles.bias}`}><h2>Bias & Evidence Profile</h2>{[["Bias neutrality",`${source?.biasNeutrality ?? "--"}%`],["Risk score",`${source?.riskScore ?? "--"}%`],["Evidence type",source && source.primaryRatio >= 70 ? "Primary-led" : "Mixed evidence"],["Citations",String(source?.citationCount ?? "--")],["Claims extracted",String(source?.claimsExtracted ?? "--")],["Link integrity",`${source?.linkIntegrity ?? "--"}%`]].map(([name,value])=><article key={name}><span>{name}</span><b data-alert={name==="Risk score" && (source?.riskScore ?? 0) > 18}>{value}</b></article>)}<div><span>Risk</span><span>Neutral</span><span>Trusted</span><i><u/></i></div></section>;
}

function QualitySignals({source}: {source?: SourceRow}) {
  return <section className={`${styles.panel} ${styles.alerts}`}><h2>Autonomous Quality Signals</h2><article data-tone="blue"><Info/><span><b>Claims extracted automatically</b><small>{source?.claimsExtracted ?? "--"} claims linked to evidence graph</small></span><CheckCircle2/></article><article data-tone="green"><ShieldCheck/><span><b>Credibility ensemble active</b><small>source-credibility-ensemble-v2</small></span><CheckCircle2/></article><article data-tone="amber"><Link2/><span><b>Lifecycle handoff prepared</b><small>{source?.handoff ?? "Awaiting autonomous score"}</small></span><CheckCircle2/></article></section>;
}

function SourceBrief({source}: {source?: SourceRow}) {
  return <section className={`${styles.panel} ${styles.brief}`}><div><h2><Sparkles size={17}/>Autonomous Source Brief</h2><b>Generated</b></div><p>{source ? `${source.title} is scored at ${source.score}/100 and routed to ${source.handoff.toLowerCase()} with ${source.corroboration}% corroboration and ${source.linkIntegrity}% link integrity.` : "The source forensics engine is preparing the first autonomous source brief."}</p><span><b>{source?.status ?? "Pending"}</b><b>{source?.claimsExtracted ?? "--"} claims</b><b>{source?.citationCount ?? "--"} citations</b></span><footer><button><CheckCircle2 size={12}/>Evidence map generated</button><button>Autonomous handoff active</button></footer></section>;
}
