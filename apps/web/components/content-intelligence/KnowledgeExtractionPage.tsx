"use client";

import {
  AlertTriangle, ArrowRight, Bell, BrainCircuit, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleDot, Copy, Database, Download, FileCheck2, Filter, GitBranch,
  Grid2X2, Lightbulb, Link2, List, MoreHorizontal, Network, Plus, RefreshCw, Search,
  ShieldCheck, Sparkles, Workflow
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import styles from "./KnowledgeExtractionPage.module.css";

type Tone="violet"|"blue"|"teal"|"green"|"amber";
const metrics:[string,string,string,Tone,ComponentType<{size?:number}>][]=[
 ["8,942","Knowledge Units","+12.4% ↗","violet",BrainCircuit],
 ["1,284","Entities Identified","86 resolved today","blue",Network],
 ["3,716","Relationships","+214 new links","teal",Link2],
 ["614","Key Insights","42 production-ready","green",Lightbulb],
 ["96%","Extraction Confidence","Target ≥ 90%","amber",ShieldCheck]
];
const rows=[
 {unit:"Industrial AI adoption is accelerating",type:"Key Insight",domain:"Digital Transformation",source:"4 verified sources",links:"18 links",confidence:96,status:"Graph ready",tone:"green",updated:"9 min ago",icon:Lightbulb},
 {unit:"Predictive maintenance",type:"Concept Entity",domain:"Operations",source:"WEF + McKinsey",links:"42 links",confidence:98,status:"Resolved",tone:"green",updated:"18 min ago",icon:Network},
 {unit:"40% reduction in unplanned downtime",type:"Quantitative Fact",domain:"Maintenance",source:"Deloitte Industry Survey 2025",links:"7 links",confidence:91,status:"Verify context",tone:"amber",updated:"31 min ago",icon:Database},
 {unit:"Workforce reskilling remains a barrier",type:"Research Finding",domain:"People & Skills",source:"6 verified sources",links:"24 links",confidence:94,status:"Graph ready",tone:"green",updated:"47 min ago",icon:Search},
 {unit:"Digital twin adoption → operational resilience",type:"Relationship",domain:"Industry 4.0",source:"3 corroborating sources",links:"2-way link",confidence:92,status:"New relationship",tone:"blue",updated:"1 hr ago",icon:GitBranch},
 {unit:"AI augments rather than replaces skilled work",type:"Verified Quote",domain:"Future of Work",source:"Expert interview · Dr. Ada Okafor",links:"11 links",confidence:97,status:"Citation linked",tone:"blue",updated:"2 hrs ago",icon:CircleDot}
] as const;
const pipeline=[
 {title:"Sources queued",value:"156",tone:"violet",progress:0,icon:FileCheck2},
 {title:"Sources processed",value:"148 / 156",tone:"blue",progress:92,icon:Database},
 {title:"Entity resolution",value:"94% · Live",tone:"green",progress:94,icon:Network},
 {title:"Relationship mapping",value:"87% · Running",tone:"amber",progress:87,icon:GitBranch},
 {title:"Graph publishing",value:"126 units pending",tone:"violet",progress:74,icon:Workflow}
] as const;

export function KnowledgeExtractionPage(){
 const [tab,setTab]=useState("Recent Extractions");const [query,setQuery]=useState("");const [refreshing,setRefreshing]=useState(false);const [view,setView]=useState<"list"|"graph">("list");
 const visible=useMemo(()=>rows.filter(row=>`${row.unit} ${row.type} ${row.domain} ${row.source}`.toLowerCase().includes(query.toLowerCase())),[query]);
 function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),600)}
 return <section className={styles.page}>
  <header className={styles.header}><div><div className={styles.crumb}>Content Intelligence <span>/</span> Knowledge Extraction</div><h1>Knowledge Extraction</h1><p>Transform verified sources into structured facts, entities, insights, quotes, and reusable knowledge.</p></div><div className={styles.selectors}><button>Workspace · CACSMS Studio<ChevronDown size={13}/></button><button>Brand · CACSMS<ChevronDown size={13}/></button><button aria-label="Notifications"><Bell size={15}/></button></div></header>
  <section className={styles.workspaceBar}><i><BrainCircuit size={24}/></i><div><b>Knowledge Extraction Workspace</b><small>Last intelligence update: {refreshing?"just now":"8 minutes ago"}</small></div><span><i/>3 extraction jobs running</span><button onClick={refresh}><RefreshCw className={refreshing?styles.spin:""} size={14}/>Refresh</button><button className={styles.primary}><Plus size={15}/>Extract Knowledge</button></section>
  <div className={styles.layout}><main><section className={styles.metrics}>{metrics.map(([value,label,note,tone,Icon])=><article data-tone={tone} key={label}><i><Icon size={27}/></i><div><strong>{value}</strong><span>{label}</span><small>{note}</small></div></article>)}</section>
   <section className={styles.panel}><div className={styles.panelHead}><div><h2>Structured Knowledge Registry</h2><p>Review extracted facts, entities, relationships, claims, quotes, provenance, and graph readiness.</p></div><b>8,942 units</b><button><Download size={14}/>Export</button><button aria-label="More options"><MoreHorizontal size={17}/></button></div>
    <nav className={styles.tabs}>{["Recent Extractions","Facts","Entities","Relationships","Insights","Quotes","Needs Review"].map(name=><button className={tab===name?styles.active:""} onClick={()=>setTab(name)} key={name}>{name}</button>)}</nav>
    <div className={styles.tools}><label><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search knowledge, entities, sources, or concepts..."/></label><button><Filter size={14}/>Filter<b>4</b></button><button>Sort: Confidence<ChevronDown size={13}/></button><span><button className={view==="list"?styles.selected:""} onClick={()=>setView("list")} aria-label="List view"><List size={16}/></button><button className={view==="graph"?styles.selected:""} onClick={()=>setView("graph")} aria-label="Graph view"><Network size={16}/></button></span></div>
    <section className={styles.coverage}><div><ShieldCheck size={20}/><span>Verified-source coverage</span><b>94%</b></div><div><Link2 size={20}/><span>Provenance attached</span><b>98%</b></div><div><Copy size={20}/><b>12</b><span>merge suggestions</span></div></section>
    <div className={styles.table}><div className={styles.tableHead}><span>KNOWLEDGE UNIT</span><span>TYPE · DOMAIN</span><span>SOURCE PROVENANCE</span><span>RELATIONSHIPS</span><span>CONFIDENCE</span><span>GRAPH STATUS</span><span>UPDATED</span></div>{visible.map(({unit,type,domain,source,links,confidence,status,tone,updated,icon:Icon})=><article key={unit}><span className={styles.unit}><i data-tone={tone}><Icon size={16}/></i><b>{unit}</b></span><span>{type}<small>{domain}</small></span><span>{source}<ShieldCheck size={13}/></span><span>{links}</span><span className={styles.score}><b>{confidence}%</b><i><u style={{width:`${confidence}%`}}/></i></span><span><em data-tone={tone}>{status}</em></span><span>{updated}</span></article>)}{visible.length===0?<div className={styles.empty}>No knowledge units match your search.</div>:null}</div>
    <footer className={styles.pagination}><span>Showing 1–{visible.length} of 8,942 knowledge units</span><div><button><ChevronLeft size={13}/><ChevronLeft size={13}/></button><button><ChevronLeft size={13}/></button><button className={styles.current}>1</button><button>2</button><button>3</button><button>…</button><button>1491</button><button><ChevronRight size={13}/></button><button><ChevronRight size={13}/><ChevronRight size={13}/></button></div></footer>
   </section></main><aside>
    <section className={`${styles.panel} ${styles.pipeline}`}><h2>Extraction Pipeline</h2>{pipeline.map(({title,value,tone,progress,icon:Icon},index)=><article key={title} data-tone={tone}><b>{index+1}</b><i><Icon size={14}/></i><div><strong>{title}</strong><span>{value}</span>{progress?<u><em style={{width:`${progress}%`}}/></u>:null}</div></article>)}<button>View active jobs<ArrowRight size={13}/></button></section>
    <section className={`${styles.panel} ${styles.alerts}`}><h2>Quality & Resolution Alerts</h2><article data-tone="red"><AlertTriangle/><span><b>7 contradictory facts</b><small>Human review required</small></span><ChevronRight/></article><article data-tone="amber"><AlertTriangle/><span><b>12 duplicate clusters</b><small>Merge suggestions ready</small></span><ChevronRight/></article><article data-tone="blue"><CircleDot/><span><b>126 units pending graph publish</b><small>Review publishing queue</small></span><ChevronRight/></article></section>
    <section className={`${styles.panel} ${styles.brief}`}><div><Sparkles size={24}/><span><h2>AI Extraction Brief</h2><small>Knowledge opportunity</small></span></div><p>Three independent sources connect workforce reskilling with successful automation adoption. Creating a consolidated insight would strengthen six planned productions.</p><span><b>6 productions</b><b>High confidence</b></span><button><Sparkles size={13}/>Create consolidated insight</button></section>
    <section className={`${styles.panel} ${styles.health}`}><h2>Extraction Health</h2><div>{[["Source provenance",98],["Entity resolution",94],["Graph integrity",96]].map(([label,value])=><article key={label}><span>{label}</span><b>{value}%</b><i><u style={{width:`${value}%`}}/></i></article>)}</div></section>
   </aside></div>
 </section>
}
