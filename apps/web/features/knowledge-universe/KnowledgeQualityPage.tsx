"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {Activity,AlertTriangle,Bell,BrainCircuit,CheckCircle2,Clock3,Database,Search,ShieldCheck,Sparkles,TriangleAlert,WandSparkles} from "lucide-react";
import type {KnowledgeQualityStatus,QualityDecision} from "@/lib/autonomous-knowledge-quality-engine";
import styles from "./KnowledgeQualityPage.module.css";

const empty:KnowledgeQualityStatus={enabled:true,state:"waiting",algorithmVersion:"multidimensional-quality-guardian-v5",intervalSeconds:30,nextRunAt:null,lastRun:null,decisions:[]};
const actionLabel=(action:string)=>action.replace(/^auto-/,"").replaceAll("-"," ");

export function KnowledgeQualityPage(){
  const [data,setData]=useState(empty);const [error,setError]=useState("");const [query,setQuery]=useState("");
  const load=useCallback(async()=>{try{const response=await fetch("/api/knowledge-universe/quality",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||"Quality telemetry is unavailable.");setData(body);setError("");}catch(reason){setError(reason instanceof Error?reason.message:"Quality telemetry is unavailable.");}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),10_000);return()=>window.clearInterval(timer);},[load]);
  const shown=useMemo(()=>data.decisions.filter(row=>`${row.title} ${row.type} ${row.status} ${row.source} ${row.action}`.toLowerCase().includes(query.toLowerCase())),[data.decisions,query]);
  const average=(key:keyof Pick<QualityDecision,"trust"|"accuracy"|"freshness"|"completeness"|"consistency"|"risk">)=>data.decisions.length?data.decisions.reduce((sum,row)=>sum+Number(row[key]),0)/data.decisions.length:0;
  const last=data.lastRun;
  return <main className={styles.page}>
    <header className={styles.global}><div><span>Knowledge Universe</span><i>/</i><b>Knowledge Quality</b></div><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search quality intelligence..."/></label><button aria-label="Notifications"><Bell/><em>12</em></button><button className={styles.avatar} aria-label="User profile">AS</button></header>
    <section className={styles.heading}><div><h1>Autonomous Knowledge Quality</h1><p>Continuously audits, certifies, remediates, and quarantines knowledge without operator input.</p></div><span><ShieldCheck/>Zero-input governance</span><span><Clock3/>Every {data.intervalSeconds}s</span></section>
    {error?<div className={styles.error}><AlertTriangle/>{error}</div>:null}
    <section className={styles.engine}><BrainCircuit/><div><small>KNOWLEDGE QUALITY AUTONOMY ENGINE</small><h2>Multidimensional quality guardian is active</h2><p>Trust scoring, evidence accuracy, freshness drift, completeness, consistency, anomaly detection, and semantic duplicate control run continuously.</p></div><aside><span><b>{last?.scanned??0}</b>Audited</span><span><b>{last?.certified??0}</b>Certified</span><span><b>{last?.remediated??0}</b>Remediated</span><span><b>{last?.quarantined??0}</b>Quarantined</span><span><b>{last?.averageConfidence??0}%</b>Confidence</span></aside><em><i/>{data.state}<small>{data.algorithmVersion}</small></em></section>
    <section className={styles.metrics}>
      <article><i><Database/></i><span><small>Records Audited</small><strong>{last?.scanned??0}</strong><em>Complete repository coverage</em></span></article>
      <article><i><CheckCircle2/></i><span><small>Auto-certified</small><strong>{last?.certified??0}</strong><em>No human validation</em></span></article>
      <article><i><WandSparkles/></i><span><small>Auto-remediating</small><strong>{last?.remediated??0}</strong><em>Safe corrections applied</em></span></article>
      <article><i><TriangleAlert/></i><span><small>Quality Health</small><strong>{last?.averageQuality??0}%</strong><em>{last?.anomalies??0} anomalies governed</em></span></article>
    </section>
    <div className={styles.grid}>
      <section className={styles.panel}><header><div><h2>Autonomous Quality Dimensions</h2><p>Repository-wide multidimensional audit results</p></div><Sparkles/></header><div className={styles.dimensions}>{[["Source Trust",average("trust")],["Evidence Accuracy",average("accuracy")],["Freshness",average("freshness")],["Completeness",average("completeness")],["Consistency",average("consistency")],["Risk Containment",100-average("risk")]].map(([label,value])=><div key={String(label)}><span>{label}<b>{Number(value).toFixed(1)}%</b></span><i><u style={{width:`${Number(value)}%`}}/></i></div>)}</div></section>
      <aside className={styles.panel}><header><div><h2>Machine Decisions</h2><p>Latest autonomous dispositions</p></div><Activity/></header><div className={styles.distribution}>{[["Certified",last?.certified??0],["Remediating",last?.remediated??0],["Quarantined",last?.quarantined??0],["Monitored",last?.monitored??0]].map(([label,value])=><div key={String(label)}><i data-state={String(label).toLowerCase()}/><span>{label}</span><b>{value}</b></div>)}</div><div className={styles.insight}><BrainCircuit/><b>Zero-input assurance</b><p>Unsafe records are isolated automatically. Recoverable records are repaired and rescored on the next cycle.</p></div></aside>
    </div>
    <section className={styles.panel}><header><div><h2>Autonomous Quality Registry</h2><p>{shown.length} records governed by the quality engine</p></div><span className={styles.healthy}><i/>{data.state}</span></header><div className={styles.table}><div><b>Knowledge record</b><b>Disposition</b><b>Quality</b><b>Trust</b><b>Accuracy</b><b>Freshness</b><b>Completeness</b><b>Risk</b></div>{shown.map(row=><div key={row.recordId}><span><b>{row.title}</b><small>{row.type} · {row.source}</small></span><em data-action={row.action}>{actionLabel(row.action)}</em><strong>{row.score.toFixed(1)}%</strong><span>{row.trust.toFixed(1)}%</span><span>{row.accuracy.toFixed(1)}%</span><span>{row.freshness.toFixed(1)}%</span><span>{row.completeness.toFixed(1)}%</span><span>{row.risk.toFixed(1)}%</span></div>)}</div>{!shown.length?<div className={styles.empty}><ShieldCheck/><h3>Awaiting the first autonomous quality cycle</h3><p>The engine will populate this registry without operator action.</p></div>:null}</section>
  </main>;
}
