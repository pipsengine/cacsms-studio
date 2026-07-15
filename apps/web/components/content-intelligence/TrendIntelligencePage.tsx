"use client";

import {
  BarChart3,
  Bell,
  CheckCircle2,
  CircleDot,
  Clock3,
  DatabaseZap,
  Globe2,
  Info,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Youtube,
  Zap,
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState, type ComponentType} from "react";
import styles from "./TrendIntelligencePage.module.css";

type Tone = "violet" | "blue" | "teal" | "green" | "amber" | "red";
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
type TrendRow = {
  id: string;
  name: string;
  category: string;
  velocity: number;
  reach: string;
  sources: string;
  durability: number;
  score: number;
  saturation: string;
  forecastConfidence: number;
  forecastGrowth: number;
  peakWindow: string;
  lifecycle: string;
  tone: Tone;
  spark: string;
};

const metricIcons: ComponentType<{size?: number}>[] = [TrendingUp, LineChart, Zap, Globe2];
const sources = [
  {name: "Search Trends", share: "28%", tone: "google", icon: Globe2},
  {name: "YouTube", share: "22%", tone: "youtube", icon: Youtube},
  {name: "LinkedIn", share: "19%", tone: "linkedin", icon: BarChart3},
  {name: "Social Listening", share: "17%", tone: "violet", icon: CircleDot},
  {name: "News and Research", share: "14%", tone: "gray", icon: Search},
] as const;

function numberAttr(attributes: Record<string, unknown>, key: string, fallback: number) {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringAttr(attributes: Record<string, unknown>, key: string, fallback: string) {
  const value = attributes[key];
  return typeof value === "string" ? value : fallback;
}

function toneFor(lifecycle: string, velocity: number, score: number): Tone {
  if (/declin/i.test(lifecycle) || velocity < 0) return "red";
  if (/breakout/i.test(lifecycle) || score >= 90) return "violet";
  if (/acceler/i.test(lifecycle)) return "blue";
  if (/emerg/i.test(lifecycle)) return "teal";
  if (score >= 75) return "green";
  return "amber";
}

function sparkFromVelocity(velocity: number) {
  const upward = velocity >= 0;
  return Array.from({length: 14}, (_, index) => {
    const x = 2 + index * 8;
    const wave = Math.sin(index * 1.7) * 3;
    const slope = upward ? 24 - index * Math.min(1.7, Math.max(0.4, velocity / 100)) : 4 + index * 1.7;
    const y = Math.max(0, Math.min(27, slope + wave));
    return `${x},${Math.round(y)}`;
  }).join(" ");
}

function rowFromRecord(record: ApiRecord): TrendRow {
  const velocity = numberAttr(record.attributes, "velocity", record.score - 40);
  const lifecycle = stringAttr(record.attributes, "lifecycle", record.status);
  return {
    id: record.id,
    name: record.title,
    category: record.subtitle || record.category,
    velocity,
    reach: stringAttr(record.attributes, "reach", `${Math.max(1, record.score / 10).toFixed(1)}M`),
    sources: `${numberAttr(record.attributes, "sourceDiversity", 5)} sources`,
    durability: numberAttr(record.attributes, "durability", record.score),
    score: record.score,
    saturation: stringAttr(record.attributes, "saturation", "Medium"),
    forecastConfidence: numberAttr(record.attributes, "forecastConfidence", Math.min(96, record.score + 2)),
    forecastGrowth: numberAttr(record.attributes, "forecastGrowth", Math.max(-10, Math.round(velocity * 0.2))),
    peakWindow: stringAttr(record.attributes, "peakWindow", "12-18 days"),
    lifecycle,
    tone: toneFor(lifecycle, velocity, record.score),
    spark: sparkFromVelocity(velocity),
  };
}

function formatTime(value: string | null) {
  if (!value) return "awaiting first autonomous sync";
  return new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"}).format(new Date(value));
}

function Sparkline({points, tone}: {points: string; tone: Tone}) {
  return <svg className={styles.spark} data-tone={tone} viewBox="0 0 110 30" preserveAspectRatio="none" aria-hidden="true"><polygon points={`2,30 ${points} 107,30`} /><polyline points={points}/></svg>;
}

export function TrendIntelligencePage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/content-intelligence/trend-intelligence", {cache: "no-store", signal});
      const payload = (await response.json()) as ApiData | {message?: string};
      if (!response.ok) throw new Error("message" in payload && payload.message ? payload.message : "Unable to load trend intelligence data.");
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

  const rows = useMemo(() => {
    const mapped = data?.records?.length ? data.records.map(rowFromRecord) : [];
    const lowered = query.trim().toLowerCase();
    if (!lowered) return mapped;
    return mapped.filter((item) => `${item.name} ${item.category} ${item.lifecycle}`.toLowerCase().includes(lowered));
  }, [data, query]);
  const top = rows[0];
  const accelerating = rows.filter((row) => row.velocity > 35).length;
  const breakout = rows.filter((row) => row.score >= 90 || /breakout/i.test(row.lifecycle)).length;
  const reach = rows.reduce((sum, row) => sum + Number.parseFloat(row.reach), 0);
  const metrics: ApiMetric[] = [
    {value: String(rows.length || data?.records?.length || "--"), label: "Trends monitored", tone: "violet"},
    {value: String(breakout || "--"), label: "Breakout signals", tone: "red"},
    {value: String(accelerating || "--"), label: "Accelerating", tone: "teal"},
    {value: rows.length ? `${Math.round(reach)}M` : "--", label: "Signal reach", tone: "teal"},
  ];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.crumb}>Content Intelligence <span>/</span> Trend Intelligence</div>
          <h1>Trend Intelligence</h1>
          <p>Autonomously monitors emerging conversations and forecasts timing windows before trends become saturated.</p>
        </div>
        <div className={styles.selectors}>
          <button>Workspace - CACSMS Studio</button>
          <button>Brand - CACSMS</button>
          <button aria-label="Notifications"><Bell size={15}/></button>
        </div>
      </header>

      <section className={styles.workspaceBar}>
        <i><TrendingUp size={23}/></i>
        <div><b>Autonomous Trend Intelligence Engine</b><small>Last autonomous update: {formatTime(data?.updatedAt ?? null)}</small></div>
        <span><i/>8 signal sources live</span>
        <button><RefreshCw className={loading ? styles.spin : ""} size={14}/>Auto-sync 30s</button>
        <button className={styles.primary}><ShieldCheck size={15}/>Autonomous monitors</button>
      </section>

      {error ? <p className={styles.notice}>{error}</p> : null}

      <div className={styles.layout}>
        <main>
          <section className={styles.metrics}>
            {metrics.map(({value, label, tone}, index) => {
              const Icon = metricIcons[index] ?? DatabaseZap;
              return <article data-tone={tone} key={label}><i><Icon size={25}/></i><div><strong>{value}</strong><span>{label}</span><small>{index === 0 ? "weighted-momentum-v2" : "Live autonomy"}</small></div></article>;
            })}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div><h2>Autonomous Trend Radar</h2><p>Weighted algorithm: velocity, reach, source diversity, durability, saturation advantage, geography, and audience fit.</p></div>
              <b>{rows.length} monitored trends</b>
              <button><CheckCircle2 size={14}/>Auto-ranked</button>
              <button><Zap size={14}/>Auto-handoff</button>
            </div>
            <nav className={styles.tabs}>
              {["Live autonomous trends", "Breakout", "Accelerating", "Emerging", "Declining"].map((name, index) => <button className={index === 0 ? styles.active : ""} key={name}>{name}</button>)}
            </nav>
            <div className={styles.tools}>
              <label><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Observer search across autonomous trend decisions..."/></label>
              <button><ShieldCheck size={14}/>Ranking locked</button>
              <button><Clock3 size={14}/>Forecasting</button>
              <button><DatabaseZap size={14}/>DB-backed</button>
            </div>
            <div className={styles.table}>
              <div className={styles.tableHead}><span>TREND / CATEGORY</span><span>7-DAY MOMENTUM <Info size={9}/></span><span>VELOCITY <Info size={9}/></span><span>REACH <Info size={9}/></span><span>SOURCE DIVERSITY</span><span>ALGO SCORE <Info size={9}/></span><span>LIFECYCLE <Info size={9}/></span><span>HANDOFF</span></div>
              {rows.map((item) => (
                <article key={item.id}>
                  <span><b>{item.name}</b><small>{item.category}</small></span>
                  <Sparkline points={item.spark} tone={item.tone}/>
                  <strong data-tone={item.tone}>{item.velocity > 0 ? "+" : ""}{item.velocity}%</strong>
                  <span>{item.reach}</span>
                  <span>{item.sources}</span>
                  <span className={styles.score}><b>{item.score} / 100</b><i><u data-tone={item.score < 65 ? "amber" : "green"} style={{width: `${item.score}%`}}/></i></span>
                  <em data-tone={item.tone}>{item.lifecycle}</em>
                  <span className={styles.handoff}><CheckCircle2 size={14}/>Auto</span>
                </article>
              ))}
              {rows.length === 0 ? <div className={styles.empty}>Waiting for autonomous trend records.</div> : null}
            </div>
            <footer className={styles.pagination}><span>{rows.length} autonomous trend decisions visible</span><div><button className={styles.current}>Live</button><button>Polling</button><button>Forecast</button></div></footer>
          </section>
        </main>

        <aside>
          <Forecast trend={top}/>
          <SignalSources/>
          <TrendAlerts rows={rows}/>
          <TrendBrief trend={top}/>
        </aside>
      </div>
    </section>
  );
}

function Forecast({trend}: {trend?: TrendRow}) {
  const growth = trend?.forecastGrowth ?? 0;
  return (
    <section className={`${styles.panel} ${styles.forecast}`}>
      <div className={styles.sideHead}><h2>Autonomous Trend Forecast <Info size={11}/></h2><button>Continuous</button></div>
      <b>{trend?.name ?? "Awaiting trend selection"}</b>
      <div className={styles.chart}>
        <span>Interest index forecast</span>
        <svg viewBox="0 0 390 120" preserveAspectRatio="none">
          <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a5cf5" stopOpacity=".26"/><stop offset="1" stopColor="#8a5cf5" stopOpacity="0"/></linearGradient></defs>
          <g className={styles.gridLines}><line x1="28" y1="20" x2="382" y2="20"/><line x1="28" y1="45" x2="382" y2="45"/><line x1="28" y1="70" x2="382" y2="70"/><line x1="28" y1="95" x2="382" y2="95"/></g>
          <path className={styles.forecastArea} d="M28 88 C55 84 70 82 92 76 S135 68 160 58 S205 45 230 39 S278 28 310 26 S350 20 382 17 L382 105 L28 105Z"/>
          <path className={styles.forecastLine} d="M28 88 C55 84 70 82 92 76 S135 68 160 58 S205 45 230 39 S278 28 310 26 S350 20 382 17"/>
          <line className={styles.now} x1="160" y1="10" x2="160" y2="105"/>
          <g className={styles.axis}><text x="2" y="23">250</text><text x="2" y="48">200</text><text x="2" y="73">150</text><text x="2" y="98">100</text><text x="28" y="117">-20d</text><text x="112" y="117">-10d</text><text x="151" y="117">Now</text><text x="225" y="117">+10d</text><text x="302" y="117">+20d</text><text x="360" y="117">+30d</text></g>
        </svg>
        <b className={styles.nowLabel}>Now</b><b className={styles.forecastLabel}>Forecast {growth >= 0 ? "+" : ""}{growth}%</b>
      </div>
      <footer>{[["Current velocity", trend ? `${trend.velocity > 0 ? "+" : ""}${trend.velocity}%` : "--"], ["Peak window", trend?.peakWindow ?? "--"], ["Saturation", trend?.saturation ?? "--"], ["Forecast confidence", trend ? `${trend.forecastConfidence}%` : "--"]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</footer>
    </section>
  );
}

function SignalSources() {
  return (
    <section className={`${styles.panel} ${styles.sources}`}>
      <div className={styles.sideHead}><h2>Signal Sources <Info size={11}/></h2><span>8 / 8 sources connected</span></div>
      {sources.map(({name, share, tone, icon: Icon}) => <article key={name}><i data-tone={tone}><Icon size={13}/></i><b>{name}</b><span>{share}</span><u><em style={{width: share}}/></u><small>Live</small></article>)}
    </section>
  );
}

function TrendAlerts({rows}: {rows: TrendRow[]}) {
  const top = rows.slice(0, 3);
  return (
    <section className={`${styles.panel} ${styles.alerts}`}>
      <h2>Autonomous Alerts</h2>
      {top.map((row, index) => {
        const Icon = row.velocity < 0 ? TrendingDown : TrendingUp;
        return <article data-tone={index === 0 ? "red" : index === 1 ? "amber" : "blue"} key={row.id}><Icon/><span><b>{row.lifecycle}</b><small>{row.name}</small></span><time>auto</time><CheckCircle2/></article>;
      })}
    </section>
  );
}

function TrendBrief({trend}: {trend?: TrendRow}) {
  return (
    <section className={`${styles.panel} ${styles.brief}`}>
      <h2>Autonomous Trend Brief <Info size={11}/></h2>
      <div><i><Sparkles size={20}/></i><span><b>Timing opportunity</b><p>{trend ? `${trend.name} is being routed automatically because the forecast window is ${trend.peakWindow} with ${trend.forecastConfidence}% confidence.` : "The engine is preparing the first autonomous trend brief."}</p></span></div>
      <footer><span><b>Auto brief</b><b>Production queue</b><b>High confidence</b></span><button><CheckCircle2 size={12}/>Opportunity created automatically</button></footer>
    </section>
  );
}
