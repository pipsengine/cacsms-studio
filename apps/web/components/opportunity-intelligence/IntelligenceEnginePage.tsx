"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Download, Filter, Fingerprint,
  Footprints, Globe2, Grid2X2, HeartPulse, Lightbulb, Link2, Map, MapPin, MoreVertical,
  Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, TrendingUp, Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createEngineOpportunity, loadEngine, openEngine, saveEngine, scanEngine } from "@/lib/intelligence-engine-api";
import { engineDefinitions } from "@/lib/intelligence-engine-definitions";
import type { EngineData, EngineItem, EngineSettings } from "@/types/intelligence-engine";
import { PageTop } from "./OpportunityDashboard";
import base from "./OpportunityIntelligence.module.css";
import styles from "./IntelligenceEnginePage.module.css";

const icons: Record<string, LucideIcon> = {
  globe: Globe2, heart: HeartPulse, fingerprint: Fingerprint,
  lightbulb: Lightbulb, footprints: Footprints, trend: TrendingUp
};

export function IntelligenceEnginePage({ slug }: { slug: string }) {
  const definition = engineDefinitions[slug];
  const Icon = icons[definition.icon] || Sparkles;
  const [data, setData] = useState<EngineData | null>(null);
  const [settings, setSettings] = useState<EngineSettings | null>(null);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(definition.totalLabel);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setBusy("refresh");
    try {
      const next = await loadEngine(slug, signal);
      setData(next);
      setSettings(next.settings);
      setSelected((id) => id || next.items[0]?.id || "");
      setMessage("");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setMessage((error as Error).message);
    } finally { setBusy(""); }
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const items = useMemo(() => data?.items.filter((item) =>
    `${item.title} ${item.subtitle} ${item.category}`.toLowerCase().includes(query.toLowerCase()) &&
    (tab === definition.totalLabel || item.category.toLowerCase().includes(tab.toLowerCase()) ||
      item.state.toLowerCase().includes(tab.toLowerCase()) || (tab === "Watchlist" && item.watchlisted))) || [],
  [data, definition.totalLabel, query, tab]);
  const active = data?.items.find((item) => item.id === selected) || items[0];

  async function scan() {
    setBusy("scan");
    try {
      const item = await scanEngine(slug);
      await refresh();
      setSelected(item.id);
      setMessage("New intelligence record saved to the database.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(""); }
  }
  async function save() {
    if (!settings) return;
    setBusy("save");
    try {
      await saveEngine(slug, settings);
      await refresh();
      setShowConfig(false);
      setMessage("Engine configuration saved.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(""); }
  }
  async function act(action: "open" | "create") {
    if (!active) return;
    setBusy(action);
    try {
      if (action === "open") await openEngine(slug, active.id);
      else await createEngineOpportunity(slug, active.id);
      setMessage(action === "open" ? "Dossier activity saved." : "Opportunity created and linked to this intelligence record.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(""); }
  }

  return <div className={base.page} data-engine={slug}>
    <PageTop current={definition.title} title={definition.title} subtitle={definition.subtitle} />
    <section className={base.workspaceBar}>
      <span className={base.heroIcon}><Icon /></span>
      <div><b>{definition.center}</b><small>Last update: {ago(data?.settings.lastRunAt)}　<i /> {definition.centerSubtitle}</small></div>
      <div className={base.barActions}>
        <button onClick={() => refresh()}><RefreshCw />Refresh</button>
        <button onClick={() => setShowConfig((value) => !value)}><Settings />Configure</button>
        <button className={base.primary} onClick={scan} disabled={!!busy}><Plus />{busy === "scan" ? "Running..." : definition.primaryAction}</button>
      </div>
    </section>
    {showConfig && settings ? <Config value={settings} onChange={setSettings} onSave={save} busy={busy} /> : null}
    {message ? <div className={base.notice}>{message}</div> : null}
    <div className={base.metrics} style={{ gridTemplateColumns: `repeat(${data?.metrics.length || 5},1fr)` }}>
      {data?.metrics.map((metric, index) => {
        const MetricIcon = metricIcons(slug, Icon)[index] || Icon;
        return <article key={metric.label} data-tone={metric.tone}><span><MetricIcon /></span><div><strong>{metric.value}</strong><b>{metric.label}</b><small>{metric.detail}</small></div></article>;
      })}
    </div>
    <div className={styles.layout}>
      <main>
        <section className={base.panel}>
          <header className={base.panelHead}><div><h2>{definition.registry}</h2><p>{definition.registrySubtitle}</p></div><button><Download />Export</button><button><MoreVertical /></button></header>
          <nav className={base.tabs}>{definition.tabs.map((name, index) => <button key={name} className={tab === name ? base.active : ""} onClick={() => setTab(name)}>{name}{index === 0 ? <b>{data?.items.length || 0}</b> : null}</button>)}</nav>
          <div className={base.tools}><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={definition.search} /></label><button><Filter />Filters <b>7</b></button><button>Sort: {definition.sort}<ChevronDown /></button><span><button className={base.selected}><BarChart3 /></button><button><Grid2X2 /></button></span></div>
          <ScoreStrip items={data?.items || []} />
          <EngineTable definition={definition} items={items} selected={active?.id} onSelect={setSelected} />
          <footer className={base.pagination}>Showing 1-{items.length} of {data?.items.length || 0}<span>&lt;　<b>1</b>　2　3　...　32　&gt;</span></footer>
        </section>
      </main>
      <aside className={styles.rail}><EngineAuxiliary slug={slug} definition={definition} item={active} onAct={act} busy={busy} /></aside>
    </div>
    <div className={styles.bottomRow}>
      <div className={styles.summary}>{definition.summaryCards.map(([value, label, detail], index) => <article key={label}><span data-tone={index === 1 ? "green" : index === 2 ? "blue" : "purple"}><MetricGlyph index={index} /></span><div><b>{value}　{label}</b><small>{detail}</small><button>View details　→</button></div></article>)}</div>
      <section className={base.brief}><h3><Sparkles /> {definition.briefTitle}<b>{definition.briefTag}</b></h3><p>{definition.brief}</p><span><b>High confidence</b><b>Strong evidence</b><b>Responsible fit</b></span><div className={base.splitButtons}><button className={base.primary} onClick={() => act("open")} disabled={!!busy}>Review intelligence ↗</button><button onClick={() => act("create")} disabled={!!busy}>{definition.createAction}</button></div></section>
    </div>
  </div>;
}

function Config({ value, onChange, onSave, busy }: { value: EngineSettings; onChange: (value: EngineSettings) => void; onSave: () => void; busy: string }) {
  return <section className={styles.config}><label>Primary market<select value={value.primaryMarket} onChange={(event) => onChange({ ...value, primaryMarket: event.target.value })}><option>Global</option><option>Africa</option><option>Nigeria + West Africa</option><option>Global audiences</option><option>West Africa</option></select></label><label>Signal sensitivity<input type="range" min="1" max="100" value={value.signalSensitivity} onChange={(event) => onChange({ ...value, signalSensitivity: Number(event.target.value) })} /><b>{value.signalSensitivity}</b></label><label><input type="checkbox" checked={value.autoCreateOpportunities} onChange={(event) => onChange({ ...value, autoCreateOpportunities: event.target.checked })} /> Auto-create high-confidence opportunities</label><button className={base.primary} onClick={onSave} disabled={!!busy}>{busy === "save" ? "Saving..." : "Apply configuration"}</button></section>;
}

function ScoreStrip({ items }: { items: EngineItem[] }) {
  const average=items.length?Math.round(items.reduce((sum,item)=>sum+item.score,0)/items.length):0;
  const values:Array<[string,string]>=[["Average score",`${average}%`],["Database records",String(items.length)],["Watchlisted",String(items.filter(x=>x.watchlisted).length)],["Risk records",String(items.filter(x=>x.risk||x.score<60).length)]];
  return <div className={base.scoreStrip}>{values.map(([label, value], index) => <span key={label}>{index === 3 ? <AlertTriangle /> : index === 1 ? <ShieldCheck /> : <TrendingUp />} {label}<b>{value}</b></span>)}</div>;
}

function EngineTable({ definition, items, selected, onSelect }: { definition: (typeof engineDefinitions)[string]; items: EngineItem[]; selected?: string; onSelect: (id: string) => void }) {
  const columns = `minmax(210px,2fr) ${definition.columns.map(() => "minmax(76px,1fr)").join(" ")} 100px 105px 20px`;
  return <div className={styles.table}><header style={{ gridTemplateColumns: columns }}><span>INTELLIGENCE / SUBJECT</span>{definition.columns.map((column) => <span key={column.key}>{column.label}</span>)}<span>{definition.sort.toUpperCase()}</span><span>STATE</span><span /></header>{items.map((item, index) => <button style={{ gridTemplateColumns: columns }} className={selected === item.id ? styles.selected : ""} onClick={() => onSelect(item.id)} key={item.id}><span className={styles.title}><em>{index + 1}</em><i><b>{item.title}</b><small>{item.subtitle}</small></i></span>{definition.columns.map((column) => <span key={column.key}>{format(item, column.key)}</span>)}<span className={base.score}><b>{item.score}/100</b><i><u style={{ width: `${item.score}%` }} /></i></span><i data-risk={item.risk}>{item.state}</i><MoreVertical /></button>)}</div>;
}

function EngineAuxiliary({ slug, definition, item, onAct, busy }: { slug: string; definition: (typeof engineDefinitions)[string]; item?: EngineItem; onAct: (action: "open" | "create") => void; busy: string }) {
  if (slug === "global-intelligence") return <><GlobalMap /><BarPanel title="Global Forces" rows={[["Technology acceleration",94],["Regulatory change",82],["Workforce transformation",88],["Capital investment",79],["Supply-chain shifts",76],["Consumer demand",64]]} /><AlertPanel title="Critical Global Alerts" rows={["New AI export-control proposals","Currency volatility rising","Data-sovereignty rules expanding","Industrial investment incentives"]} /></>;
  if (!item) return null;
  return <><Selected definition={definition} item={item} onAct={onAct} busy={busy} />
    {slug === "human-interest-intelligence" ? <><SentimentLandscape /><AlertPanel title="Ethics & Sensitivity Monitor" rows={["Consent evidence verified","6 narratives need identity protection","3 stories contain trauma indicators","9 claims require local verification"]} /></> : null}
    {slug === "mystery-intelligence" ? <><BarPanel title="Hypothesis Matrix" rows={[["Industrial vibration",38],["Subterranean infrastructure",27],["Marine acoustic source",19],["Atmospheric resonance",10],["Unknown",6]]} /><AlertPanel title="Evidence Integrity Monitor" rows={["12 sources independently corroborated","6 witness accounts geolocated","2 claims lack primary evidence","1 manipulated video excluded"]} /></> : null}
    {slug === "curiosity-engine" ? <><JourneyPanel title="Curiosity Anatomy" nodes={[["22%","Known context"],["46%","Unanswered gap"],["20%","Unexpected reveal"],["12%","Useful resolution"]]} /><BarPanel title="Audience Question Sources" rows={[["Search behavior",38],["Comments & forums",24],["Research gaps",18],["Trend anomalies",12],["Competitor omissions",8]]} /><Guardrails title="Integrity Guardrails" rows={["No false promise","Evidence available","Headline matches content","Emotional manipulation"]} /></> : null}
    {slug === "emotional-opportunity-engine" ? <><JourneyPanel title="Emotional Journey" nodes={[["82%","Uncertainty"],["46%","Understanding"],["68%","Capability"],["91%","Confidence"]]} /><div className={styles.splitPanels}><BarPanel title="Emotional Landscape" rows={[["Hope",28],["Concern",24],["Empowerment",18],["Belonging",13],["Pride",10],["Frustration",7]]} /><Guardrails title="Ethical Activation Guardrails" rows={["Dignity preserved","No fear amplification","Evidence supports promise","Vulnerable audiences protected"]} /></div></> : null}
    {slug === "life-explorer-engine" ? <><JourneyPanel title="Life Journey Map" nodes={[["04:30","Pre-shift briefing"],["06:00","Network inspection"],["10:30","Emergency repair"],["14:00","Community impact"],["19:00","Night handover"]]} /><div className={styles.splitPanels}><LifeMap /><Guardrails title="Field Access & Ethics" rows={["Local partner confirmed","Informed consent plan","Safety assessment","Representation balance","Restricted location permit"]} /></div></> : null}
    {slug === "trend-intelligence" ? <><TrendLifecycle /><div className={styles.splitPanels}><BarPanel title="Regional Momentum" rows={[["West Africa",96],["East Africa",88],["Southern Africa",84],["Europe",79],["North America",82],["Asia-Pacific",86]]} /><AlertPanel title="Trend Alerts" rows={["12 trends approaching saturation","9 signals losing momentum","18 breakout trends detected","6 regional adoption shifts"]} /></div></> : null}
  </>;
}

function Selected({ definition, item, onAct, busy }: { definition: (typeof engineDefinitions)[string]; item: EngineItem; onAct: (action: "open" | "create") => void; busy: string }) {
  const facts = profileFacts(definition.slug, item);
  return <section className={base.smallPanel}><small>{definition.selectedTitle}</small><h3>{item.title}</h3><div className={base.selectedOpportunity}><div className={base.ring}><b>{item.score}</b><small>/ 100</small></div><div>{facts.map(([label, value]) => <p key={label}><span>{label}</span><i><u style={{ width: `${Math.min(100, Number(value))}%` }} /></i><b>{value}</b></p>)}</div></div><div className={styles.evidence}><span><Users /> 12 sources</span><span><Link2 /> 6 segments</span><span><MapPin /> 4 formats</span></div><div className={base.splitButtons}><button className={base.primary} onClick={() => onAct("open")} disabled={!!busy}>{definition.selectedAction} ↗</button><button onClick={() => onAct("create")} disabled={!!busy}>{definition.createAction}</button></div></section>;
}

function GlobalMap() {
  return <section className={`${base.smallPanel} ${styles.globalMap}`}><h3>Global Opportunity Map <span>Opportunity　 Risk</span></h3><div className={styles.world}><i data-region="na">81</i><i data-region="eu">74</i><i data-region="af">92</i><i data-region="me">79</i><i data-region="ap">88</i><i data-region="la">68</i></div><div className={styles.regionScores}>{[["Africa",92],["Europe",74],["Asia-Pacific",88],["North America",81],["Middle East",79],["Latin America",68]].map(([region,score]) => <span key={String(region)}>{region}<b>{score}</b></span>)}</div><footer><Globe2 /> 38 countries monitored　　<Users /> 6 priority markets</footer></section>;
}

function SentimentLandscape() {
  return <section className={base.smallPanel}><h3>Human Sentiment Landscape <span>Emotion　 Community</span></h3><div className={styles.sentiment}><div className={styles.donut}><HeartPulse /></div><div>{[["Hope","31%"],["Concern","24%"],["Determination","18%"],["Pride","12%"],["Frustration","9%"],["Fear","6%"]].map(([label,value],index) => <p key={label}><i data-color={index}/><span>{label}</span><b>{value}</b></p>)}</div></div><footer><Users /> 68 communities represented　　<Globe2 /> 14 countries covered</footer></section>;
}

function BarPanel({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return <section className={base.smallPanel}><h3>{title}</h3><div className={styles.overview}>{rows.map(([label, value], index) => <p key={label}><span>{label}</span><i><u style={{ width: `${value}%` }} /></i><b>{value}</b><em>{index < 3 ? "↑" : "→"}</em></p>)}</div></section>;
}

function AlertPanel({ title, rows }: { title: string; rows: string[] }) {
  return <section className={base.smallPanel}><h3>{title}</h3><div className={styles.alerts}>{rows.map((row, index) => <p key={row}><i data-level={index}>{index < 2 ? "!" : "i"}</i><span>{row}</span><small>{index * 3 + 2}h ago　›</small></p>)}</div></section>;
}

function JourneyPanel({ title, nodes }: { title: string; nodes: Array<[string, string]> }) {
  return <section className={base.smallPanel}><h3>{title}</h3><div className={styles.journey}>{nodes.map(([value, label], index) => <div key={label}><span>{value}</span><b>{label}</b>{index < nodes.length - 1 ? <i>→</i> : null}</div>)}</div></section>;
}

function Guardrails({ title, rows }: { title: string; rows: string[] }) {
  return <section className={base.smallPanel}><h3>{title}</h3><div className={styles.guardrails}>{rows.map((row, index) => <p key={row}><CheckCircle2 /><span>{row}</span><b>{index === rows.length - 1 ? "Review" : "Pass"}</b></p>)}</div></section>;
}

function LifeMap() {
  return <section className={`${base.smallPanel} ${styles.lifeMap}`}><h3>Exploration Landscape <span>Map　 Domains</span></h3><div><Map /><i/><i/><i/><i/><i/></div><footer><Users /> 94 communities　 <Globe2 /> 18 countries</footer></section>;
}

function TrendLifecycle() {
  return <section className={base.smallPanel}><h3>Trend Lifecycle</h3><div className={styles.lifecycle}><span>Emerging</span><span>Accelerating</span><span>Maturing</span><span>Peaking</span><span>Declining</span><svg viewBox="0 0 500 110" preserveAspectRatio="none"><path d="M0 100 C90 82 120 42 200 38 S330 3 400 36 S470 70 500 78"/><circle cx="160" cy="48" r="10"/></svg></div></section>;
}

function profileFacts(slug: string, item: EngineItem): Array<[string, number]> {
  const a = item.attributes;
  const maps: Record<string, Array<[string, string]>> = {
    "human-interest-intelligence": [["Emotional depth","a"],["Social relevance","b"],["Authenticity","authenticity"],["Representation","c"],["Narrative potential","a"],["Ethical readiness","c"]],
    "mystery-intelligence": [["Evidence strength","credibility"],["Anomaly significance","interest"],["Source diversity","a"],["Public interest","interest"],["Expert consensus","c"],["Narrative potential","b"]],
    "curiosity-engine": [["Novelty","novelty"],["Surprise","a"],["Information gap","b"],["Audience relevance","pull"],["Emotional tension","c"],["Answerability","answerability"],["Integrity","c"]],
    "emotional-opportunity-engine": [["Emotional intensity","a"],["Audience prevalence","prevalence"],["Unmet need","b"],["Relevance","a"],["Durability","c"],["Authenticity","authenticity"],["Ethical readiness","c"]],
    "life-explorer-engine": [["Human depth","depth"],["Uniqueness","a"],["Visual potential","visual"],["Social value","b"],["Access feasibility","feasibility"],["Evidence readiness","c"],["Production fit","a"]],
    "trend-intelligence": [["Velocity","a"],["Adoption growth","b"],["Geographic spread","c"],["Source agreement","a"],["Durability","b"],["Strategic relevance","c"],["Whitespace","b"]]
  };
  return (maps[slug] || [["Confidence","a"],["Relevance","b"],["Readiness","c"]]).map(([label,key]) => [label, Number(a[key] ?? item.score)]);
}

function metricIcons(slug: string, fallback: LucideIcon): LucideIcon[] {
  const standard = [fallback, TrendingUp, Users, ShieldCheck, AlertTriangle];
  if (slug === "global-intelligence") return [Globe2, MapPin, TrendingUp, Globe2];
  if (slug === "mystery-intelligence") return [Fingerprint, AlertTriangle, Link2, ShieldCheck, AlertTriangle];
  if (slug === "life-explorer-engine") return [Footprints, MapPin, Users, Map, AlertTriangle];
  return standard;
}

function MetricGlyph({ index }: { index: number }) { return index === 0 ? <Sparkles /> : index === 1 ? <Globe2 /> : <TrendingUp />; }
function format(item: EngineItem, key: string) { const value = key === "category" ? item.category : item.attributes[key]; if (typeof value === "number") return key === "velocity" ? `${value > 0 ? "+" : ""}${value}%` : `${value}%`; return String(value ?? "-"); }
function ago(value?: string | null) { if (!value) return "never"; const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 60 ? `${minutes} minutes ago` : `${Math.round(minutes / 60)} hours ago`; }
