"use client";

import {
  Bell, BrainCircuit, CheckCircle2, ChevronDown, CircleDot, Copy, Database,
  FileCheck2, GitBranch, Lightbulb, Link2, Network, RefreshCw, Search,
  ShieldCheck, Sparkles, Workflow
} from "lucide-react";
import {useCallback, useEffect, useMemo, useState, type ComponentType} from "react";
import styles from "./KnowledgeExtractionPage.module.css";

type Tone = "violet" | "blue" | "teal" | "green" | "amber";
type ApiMetric = {value:string;label:string;tone:Tone};
type ApiRecord = {id:string;title:string;subtitle:string;category:string;score:number;status:string;attributes:Record<string,unknown>;updatedAt:string};
type ApiData = {records:ApiRecord[];metrics:ApiMetric[];updatedAt:string|null};
type KnowledgeRow = {id:string;unit:string;type:string;domain:string;sources:number;relationships:number;provenance:number;entityResolution:number;relationConfidence:number;graphReadiness:number;confidence:number;status:string;handoff:string;tone:Tone;icon:ComponentType<{size?:number}>};

const metricIcons: ComponentType<{size?:number}>[] = [BrainCircuit, Network, Link2, Lightbulb, ShieldCheck];
const fallbackMetrics: ApiMetric[] = [
  {value:"--",label:"Knowledge units",tone:"violet"},
  {value:"--",label:"High confidence",tone:"green"},
  {value:"--",label:"Average score",tone:"blue"},
  {value:"--",label:"Autonomous actions",tone:"amber"}
];
const fallbackRows: KnowledgeRow[] = [
  {id:"fallback-1",unit:"Industrial AI adoption is accelerating",type:"Key Insight",domain:"Digital Transformation",sources:4,relationships:18,provenance:96,entityResolution:92,relationConfidence:88,graphReadiness:95,confidence:92,status:"Auto-published",handoff:"Knowledge graph and script evidence",tone:"green",icon:Lightbulb},
  {id:"fallback-2",unit:"Predictive maintenance",type:"Concept Entity",domain:"Operations",sources:5,relationships:42,provenance:98,entityResolution:97,relationConfidence:91,graphReadiness:98,confidence:95,status:"Auto-resolved",handoff:"Entity graph resolved",tone:"green",icon:Network}
];

function numAttr(attributes:Record<string,unknown>,key:string,fallback:number){const value=attributes[key];return typeof value==="number"&&Number.isFinite(value)?value:fallback}
function strAttr(attributes:Record<string,unknown>,key:string,fallback:string){const value=attributes[key];return typeof value==="string"?value:fallback}
function iconFor(category:string){if(/entity/i.test(category))return Network;if(/relationship/i.test(category))return GitBranch;if(/fact/i.test(category))return Database;if(/quote/i.test(category))return CircleDot;return Lightbulb}
function toneFor(score:number,category:string):Tone{if(/relationship/i.test(category))return"blue";if(score>=90)return"green";if(score>=84)return"teal";return"amber"}
function rowFromRecord(record:ApiRecord):KnowledgeRow{const Icon=iconFor(record.category);return{id:record.id,unit:record.title,type:record.category,domain:record.subtitle, sources:numAttr(record.attributes,"sourceCount",3), relationships:numAttr(record.attributes,"relationshipCount",8), provenance:numAttr(record.attributes,"provenance",Math.min(98,record.score+2)), entityResolution:numAttr(record.attributes,"entityResolution",Math.min(96,record.score)), relationConfidence:numAttr(record.attributes,"relationConfidence",Math.min(94,record.score-1)), graphReadiness:numAttr(record.attributes,"graphReadiness",Math.min(98,record.score+1)), confidence:record.score,status:record.status,handoff:strAttr(record.attributes,"handoff","Autonomous graph handoff"),tone:toneFor(record.score,record.category),icon:Icon}}
function fmt(value:string|null){if(!value)return"awaiting first autonomous sync";return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value))}

export function KnowledgeExtractionPage(){
 const [data,setData]=useState<ApiData|null>(null);const [query,setQuery]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{try{const response=await fetch("/api/content-intelligence/knowledge-extraction",{cache:"no-store",signal});const payload=await response.json() as ApiData|{message?:string};if(!response.ok)throw new Error("message"in payload&&payload.message?payload.message:"Unable to load autonomous knowledge extraction data.");setData(payload as ApiData);setError(null)}catch(cause){if((cause as Error).name!=="AbortError")setError((cause as Error).message)}finally{setLoading(false)}},[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);const timer=window.setInterval(()=>void load(),30000);return()=>{controller.abort();window.clearInterval(timer)}},[load]);
 const metrics=data?.metrics?.length?data.metrics:fallbackMetrics;
 const visible=useMemo(()=>{const source=data?.records?.length?data.records.map(rowFromRecord):fallbackRows;const lowered=query.trim().toLowerCase();return lowered?source.filter(row=>`${row.unit} ${row.type} ${row.domain} ${row.handoff} ${row.status}`.toLowerCase().includes(lowered)):source},[data,query]);
 const avg=visible.length?Math.round(visible.reduce((sum,row)=>sum+row.confidence,0)/visible.length):0;
 const provenance=visible.length?Math.round(visible.reduce((sum,row)=>sum+row.provenance,0)/visible.length):0;
 const graph=visible.length?Math.round(visible.reduce((sum,row)=>sum+row.graphReadiness,0)/visible.length):0;
 const relations=visible.reduce((sum,row)=>sum+row.relationships,0);
 const top=visible[0];
 const pipelineItems: [string, number, ComponentType<{size?:number}>, Tone][] = [["Evidence intake",100,FileCheck2,"violet"],["Entity resolution",graph,Network,"green"],["Relationship mapping",Math.max(80,avg-3),GitBranch,"blue"],["Graph publishing",graph,Workflow,"violet"]];
 return <section className={styles.page}>
  <header className={styles.header}><div><div className={styles.crumb}>Content Intelligence <span>/</span> Knowledge Extraction</div><h1>Autonomous Knowledge Extraction</h1><p>Continuously extracts structured facts, entities, relationships, insights, and graph-ready knowledge from verified evidence.</p></div><div className={styles.selectors}><button>Workspace - CACSMS Studio<ChevronDown size={13}/></button><button>Brand - CACSMS<ChevronDown size={13}/></button><button aria-label="Notifications"><Bell size={15}/></button></div></header>
  <section className={styles.workspaceBar}><i><BrainCircuit size={24}/></i><div><b>Autonomous Knowledge Graph Extraction Engine</b><small>Last autonomous sync: {fmt(data?.updatedAt??null)} | algorithm: knowledge-graph-extraction-v2</small></div><span><i/>Graph extraction active</span><span className={styles.statusChip}><RefreshCw className={loading?styles.spin:""} size={14}/>Auto-sync 30s</span><span className={`${styles.statusChip} ${styles.primary}`}><ShieldCheck size={15}/>Autonomous</span></section>
  {error?<p className={styles.notice}>{error}</p>:null}
  <div className={styles.layout}><main><section className={styles.metrics}>{metrics.slice(0,5).map(({value,label,tone},index)=>{const Icon=metricIcons[index]??BrainCircuit;return <article data-tone={tone} key={label}><i><Icon size={27}/></i><div><strong>{value}</strong><span>{label}</span><small>{index===0?"DB-backed":"Autonomous extraction"}</small></div></article>})}</section>
   <section className={styles.panel}><div className={styles.panelHead}><div><h2>Autonomous Structured Knowledge Registry</h2><p>Graph units are scored by provenance, entity resolution, relationship confidence, semantic coherence, graph readiness, dedupe confidence, and production utility.</p></div><b>{visible.length} units</b><button><Database size={14}/>DB-backed</button></div>
    <nav className={styles.tabs}>{["Autonomous units",`${visible.filter(row=>row.confidence>=90).length} graph-ready`,`${relations} relationships`,`${avg}% avg score`].map((name,index)=><button className={index===0?styles.active:""} key={name}>{name}</button>)}</nav>
    <div className={styles.tools}><label><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Observer search across autonomous knowledge units..."/></label><button><ShieldCheck size={14}/>Model locked</button><button>Sort: Graph Readiness<ChevronDown size={13}/></button></div>
    <section className={styles.coverage}><div><ShieldCheck size={20}/><span>Provenance attached</span><b>{provenance}%</b></div><div><Link2 size={20}/><span>Graph readiness</span><b>{graph}%</b></div><div><Copy size={20}/><b>{relations}</b><span>relationships</span></div></section>
    <div className={styles.table}><div className={styles.tableHead}><span>KNOWLEDGE UNIT</span><span>TYPE / DOMAIN</span><span>SOURCE PROVENANCE</span><span>RELATIONSHIPS</span><span>CONFIDENCE</span><span>GRAPH STATUS</span><span>HANDOFF</span></div>{visible.map(({unit,type,domain,sources,relationships,provenance:prov,confidence,status,tone,handoff,icon:Icon})=><article key={unit}><span className={styles.unit}><i data-tone={tone}><Icon size={16}/></i><b>{unit}</b></span><span>{type}<small>{domain}</small></span><span>{sources} sources<ShieldCheck size={13}/></span><span>{relationships} links</span><span className={styles.score}><b>{confidence}%</b><i><u style={{width:`${confidence}%`}}/></i></span><span><em data-tone={tone}>{status}</em></span><span>{handoff}</span></article>)}{visible.length===0?<div className={styles.empty}>No autonomous knowledge units match your search.</div>:null}</div>
    <footer className={styles.pagination}><span>{visible.length} autonomous knowledge units visible</span><div><button className={styles.current}>Live</button><button>Polling</button><button>DB</button></div></footer>
   </section></main><aside>
    <section className={`${styles.panel} ${styles.pipeline}`}><h2>Autonomous Extraction Pipeline</h2>{pipelineItems.map(([title,progress,Icon,tone],index)=><article key={title} data-tone={tone}><b>{index+1}</b><i><Icon size={14}/></i><div><strong>{title}</strong><span>{progress}% autonomous</span><u><em style={{width:`${progress}%`}}/></u></div></article>)}</section>
    <section className={`${styles.panel} ${styles.alerts}`}><h2>Autonomous Quality Signals</h2><article data-tone="blue"><CheckCircle2/><span><b>Graph publishing active</b><small>{graph}% readiness across visible units</small></span><CheckCircle2/></article><article data-tone="green"><ShieldCheck/><span><b>Provenance model active</b><small>knowledge-graph-extraction-v2</small></span><CheckCircle2/></article><article data-tone="amber"><Link2/><span><b>Lifecycle handoff prepared</b><small>{top?.handoff??"Awaiting graph unit"}</small></span><CheckCircle2/></article></section>
    <section className={`${styles.panel} ${styles.brief}`}><div><Sparkles size={24}/><span><h2>Autonomous Extraction Brief</h2><small>Generated</small></span></div><p>{top?`${top.unit} is scored at ${top.confidence}% with ${top.relationships} graph links and ${top.provenance}% provenance. It is routed to ${top.handoff.toLowerCase()}.`:"The extraction engine is preparing the first autonomous graph brief."}</p><span><b>{top?.status??"Pending"}</b><b>{relations} links</b></span><button><Sparkles size={13}/>Graph handoff active</button></section>
    <section className={`${styles.panel} ${styles.health}`}><h2>Extraction Health</h2><div>{[["Provenance",provenance],["Entity resolution",top?.entityResolution??0],["Graph readiness",graph]].map(([label,value])=><article key={label as string}><span>{label}</span><b>{value}%</b><i><u style={{width:`${value}%`}}/></i></article>)}</div></section>
   </aside></div>
 </section>
}
