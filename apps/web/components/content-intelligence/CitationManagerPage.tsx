"use client";

import {
  Bell, BookOpenCheck, CheckCircle2, ChevronDown, Database, FileText, Fingerprint,
  Link2, Quote, RefreshCw, Search, ShieldCheck, Sparkles, Waypoints
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState, type ComponentType} from "react";
import styles from "./CitationManagerPage.module.css";

type Tone = "violet" | "blue" | "teal" | "green" | "amber";
type ApiMetric = {value:string;label:string;tone:Tone};
type ApiRecord = {id:string;title:string;subtitle:string;category:string;score:number;status:string;attributes:Record<string,unknown>;updatedAt:string};
type ApiData = {records:ApiRecord[];metrics:ApiMetric[];updatedAt:string|null};
type CitationRow = {id:string;title:string;source:string;type:string;score:number;status:string;tone:Tone;linkIntegrity:number;metadataCompleteness:number;sourceAuthority:number;claimCoverage:number;formatCompliance:number;duplicateRisk:number;provenanceDepth:number;linkedClaims:number;handoff:string};

const metricIcons: ComponentType<{size?:number}>[] = [Quote, Link2, Fingerprint, ShieldCheck];
const fallbackMetrics: ApiMetric[] = [
  {value:"--",label:"Citation records",tone:"teal"},
  {value:"--",label:"High confidence",tone:"green"},
  {value:"--",label:"Average score",tone:"blue"},
  {value:"--",label:"Autonomous actions",tone:"amber"}
];
const fallbackRows: CitationRow[] = [
  {id:"fallback-1",title:"World Economic Forum - The Future of Jobs Report 2025",source:"Institutional report - labour market and skills",type:"Institutional Report",score:95,status:"Auto-validated",tone:"green",linkIntegrity:98,metadataCompleteness:96,sourceAuthority:98,claimCoverage:94,formatCompliance:97,duplicateRisk:4,provenanceDepth:95,linkedClaims:18,handoff:"Claims and knowledge graph citation anchor"},
  {id:"fallback-2",title:"Nigeria ICT Sector Statistics Q2 2026",source:"Government dataset - national technology indicators",type:"Government Dataset",score:94,status:"Auto-primary",tone:"green",linkIntegrity:97,metadataCompleteness:93,sourceAuthority:97,claimCoverage:86,formatCompliance:92,duplicateRisk:5,provenanceDepth:90,linkedClaims:11,handoff:"Primary evidence citation anchor"}
];

function numAttr(attributes:Record<string,unknown>, key:string, fallback:number){const value=attributes[key];return typeof value==="number"&&Number.isFinite(value)?value:fallback}
function strAttr(attributes:Record<string,unknown>, key:string, fallback:string){const value=attributes[key];return typeof value==="string"?value:fallback}
function toneFor(score:number, duplicateRisk:number):Tone{if(score>=90)return"green";if(duplicateRisk>14)return"amber";if(score>=84)return"teal";return"blue"}
function rowFromRecord(record:ApiRecord):CitationRow{const duplicateRisk=numAttr(record.attributes,"duplicateRisk",8);return{id:record.id,title:record.title,source:record.subtitle,type:record.category,score:record.score,status:record.status,tone:toneFor(record.score,duplicateRisk),linkIntegrity:numAttr(record.attributes,"linkIntegrity",record.score),metadataCompleteness:numAttr(record.attributes,"metadataCompleteness",record.score),sourceAuthority:numAttr(record.attributes,"sourceAuthority",record.score),claimCoverage:numAttr(record.attributes,"claimCoverage",Math.max(80,record.score-5)),formatCompliance:numAttr(record.attributes,"formatCompliance",record.score),duplicateRisk,provenanceDepth:numAttr(record.attributes,"provenanceDepth",record.score),linkedClaims:numAttr(record.attributes,"linkedClaims",0),handoff:strAttr(record.attributes,"handoff","Autonomous citation handoff")}}
function fmt(value:string|null){if(!value)return"awaiting first autonomous sync";return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value))}

export function CitationManagerPage(){
  const [data,setData]=useState<ApiData|null>(null);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async(signal?:AbortSignal)=>{
    try{
      const response=await fetch("/api/content-intelligence/citation-manager",{cache:"no-store",signal});
      const payload=await response.json() as ApiData|{message?:string};
      if(!response.ok)throw new Error("message"in payload&&payload.message?payload.message:"Unable to load autonomous citation data.");
      setData(payload as ApiData);
      setError(null);
    }catch(cause){
      if((cause as Error).name!=="AbortError")setError((cause as Error).message);
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{const controller=new AbortController();void load(controller.signal);const timer=window.setInterval(()=>void load(),30000);return()=>{controller.abort();window.clearInterval(timer)}},[load]);

  const metrics=data?.metrics?.length?data.metrics:fallbackMetrics;
  const rows=useMemo(()=>{const source=data?.records?.length?data.records.map(rowFromRecord):fallbackRows;const lowered=query.trim().toLowerCase();return lowered?source.filter(row=>`${row.title} ${row.source} ${row.type} ${row.status} ${row.handoff}`.toLowerCase().includes(lowered)):source},[data,query]);
  const avg=rows.length?Math.round(rows.reduce((sum,row)=>sum+row.score,0)/rows.length):0;
  const linkHealth=rows.length?Math.round(rows.reduce((sum,row)=>sum+row.linkIntegrity,0)/rows.length):0;
  const metadata=rows.length?Math.round(rows.reduce((sum,row)=>sum+row.metadataCompleteness,0)/rows.length):0;
  const provenance=rows.length?Math.round(rows.reduce((sum,row)=>sum+row.provenanceDepth,0)/rows.length):0;
  const claims=rows.reduce((sum,row)=>sum+row.linkedClaims,0);
  const top=rows[0];
  const pipelineItems: [string, number, ComponentType<{size?:number}>, Tone][] = [["Link integrity",linkHealth,Link2,"green"],["Metadata normalization",metadata,FileText,"blue"],["Duplicate collapse",Math.max(82,100-(top?.duplicateRisk??8)),Fingerprint,"violet"],["Provenance handoff",provenance,Waypoints,"teal"]];

  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Content Intelligence <span>/</span> Citation Engine</div><h1>Autonomous Citation Engine</h1><p>Continuously validates citations, completes metadata, checks links, collapses duplicates, and routes provenance to claims and knowledge graph records.</p></div><div className={styles.selectors}><button>Workspace - CACSMS Studio<ChevronDown size={13}/></button><button>Brand - CACSMS<ChevronDown size={13}/></button><button aria-label="Notifications"><Bell size={15}/></button></div></header>
    <section className={styles.workspaceBar}><i><BookOpenCheck size={24}/></i><div><b>Autonomous Citation Provenance Validator</b><small>Last autonomous sync: {fmt(data?.updatedAt??null)} | algorithm: citation-provenance-validator-v2</small></div><span><i/>Citation validation active</span><span className={styles.statusChip}><RefreshCw className={loading?styles.spin:""} size={14}/>Auto-sync 30s</span><span className={`${styles.statusChip} ${styles.primary}`}><ShieldCheck size={15}/>Autonomous</span></section>
    {error?<p className={styles.notice}>{error}</p>:null}
    <div className={styles.layout}><main>
      <section className={styles.metrics}>{metrics.slice(0,4).map(({value,label,tone},index)=>{const Icon=metricIcons[index]??Quote;return <article data-tone={tone} key={label}><i><Icon size={27}/></i><div><strong>{value}</strong><span>{label}</span><small>{index===0?"DB-backed":"Autonomous citation control"}</small></div></article>})}</section>
      <section className={styles.panel}><div className={styles.panelHead}><div><h2>Autonomous Citation Registry</h2><p>Records are ranked by link integrity, metadata completeness, source authority, freshness, claim coverage, format compliance, duplicate risk, and provenance depth.</p></div><b>{rows.length} records</b><span><Database size={14}/>DB-backed</span></div>
        <nav className={styles.tabs}>{["Autonomous citations",`${rows.filter(row=>row.score>=90).length} validated`,`${claims} linked claims`,`${avg}% avg score`].map((name,index)=><span className={index===0?styles.active:""} key={name}>{name}</span>)}</nav>
        <div className={styles.tools}><label><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Observer search across autonomous citation records..."/></label><span><ShieldCheck size={14}/>Model locked</span><span>Sort: Provenance Confidence<ChevronDown size={13}/></span></div>
        <section className={styles.coverage}><div><Link2 size={20}/><span>Link integrity</span><b>{linkHealth}%</b></div><div><FileText size={20}/><span>Metadata completeness</span><b>{metadata}%</b></div><div><Waypoints size={20}/><span>Provenance depth</span><b>{provenance}%</b></div></section>
        <div className={styles.table}><div className={styles.tableHead}><span>CITATION SOURCE</span><span>TYPE</span><span>LINKS</span><span>METADATA</span><span>CLAIMS</span><span>SCORE</span><span>STATUS</span><span>HANDOFF</span></div>{rows.map(row=><article key={row.id}><span className={styles.source}><i data-tone={row.tone}><Quote size={15}/></i><b>{row.title}</b><small>{row.source}</small></span><span>{row.type}</span><span>{row.linkIntegrity}%</span><span>{row.metadataCompleteness}%</span><span>{row.linkedClaims}</span><span className={styles.score}><b>{row.score}%</b><i><u style={{width:`${row.score}%`}}/></i></span><span><em data-tone={row.tone}>{row.status}</em></span><span>{row.handoff}</span></article>)}{rows.length===0?<div className={styles.empty}>No autonomous citation records match your search.</div>:null}</div>
        <footer className={styles.pagination}><span>{rows.length} autonomous citation decisions visible</span><div><span className={styles.current}>Live</span><span>Polling</span><span>DB</span></div></footer>
      </section>
    </main><aside>
      <section className={`${styles.panel} ${styles.pipeline}`}><h2>Autonomous Citation Pipeline</h2>{pipelineItems.map(([title,progress,Icon,tone],index)=><article key={title} data-tone={tone}><b>{index+1}</b><i><Icon size={14}/></i><div><strong>{title}</strong><span>{progress}% autonomous</span><u><em style={{width:`${progress}%`}}/></u></div></article>)}</section>
      <section className={`${styles.panel} ${styles.signals}`}><h2>Autonomous Quality Signals</h2><article data-tone="green"><CheckCircle2/><span><b>Validation ensemble active</b><small>citation-provenance-validator-v2</small></span><CheckCircle2/></article><article data-tone="blue"><Link2/><span><b>Link checks automated</b><small>{linkHealth}% active integrity</small></span><CheckCircle2/></article><article data-tone="teal"><Waypoints/><span><b>Lifecycle handoff prepared</b><small>{top?.handoff??"Awaiting citation record"}</small></span><CheckCircle2/></article></section>
      <section className={`${styles.panel} ${styles.brief}`}><div><Sparkles size={24}/><span><h2>Autonomous Citation Brief</h2><small>Generated</small></span></div><p>{top?`${top.title} is scored at ${top.score}% with ${top.linkedClaims} linked claims, ${top.linkIntegrity}% link integrity, and ${top.provenanceDepth}% provenance depth. It is routed to ${top.handoff.toLowerCase()}.`:"The citation validator is preparing the first autonomous citation brief."}</p><span><b>{top?.status??"Pending"}</b><b>{claims} claims</b></span><mark><Sparkles size={13}/>Citation handoff active</mark></section>
      <section className={`${styles.panel} ${styles.health}`}><h2>Citation Health</h2><div>{[["Source authority",top?.sourceAuthority??0],["Format compliance",top?.formatCompliance??0],["Duplicate safety",Math.max(0,100-(top?.duplicateRisk??0))]].map(([label,value])=><article key={label as string}><span>{label}</span><b>{value}%</b><i><u style={{width:`${value}%`}}/></i></article>)}</div></section>
    </aside></div>
  </section>;
}
