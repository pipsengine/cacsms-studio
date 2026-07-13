"use client";

import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, Download, FileText, Filter, Link2, List, Plus, Quote, Search } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./CitationManagerPage.module.css";

const citations=[
 {title:"World Economic Forum (2025) — The Future of Jobs Report",meta:["Report","2025","Global","Economics"],claims:18,score:92,status:"Valid",tone:"green"},
 {title:"McKinsey Global Institute (2025) — AI and the Future of Work",meta:["Research Report","2025","AI","Corporate"],claims:11,score:87,status:"Valid",tone:"green"},
 {title:"UNESCO (2025) — Education Technology in Africa",meta:["Policy Brief","2025","Education","Africa"],claims:7,score:78,status:"Metadata Missing",tone:"amber"},
 {title:"OECD (2024) — Digital Transformation in Developing Economies",meta:["Working Paper","2024","Digital","Global"],claims:4,score:65,status:"Broken Link",tone:"red"}
];

export function CitationManagerPage(){const [tab,setTab]=useState("All Citations");const [query,setQuery]=useState("");const visible=useMemo(()=>citations.filter(item=>item.title.toLowerCase().includes(query.toLowerCase())&&(tab==="All Citations"||(tab==="Needs Attention"&&item.tone!=="green")||(tab==="Recently Used"&&item.claims>7))),[query,tab]);return <section className={styles.page}>
 <div className={styles.crumb}>Content Intelligence <span>/</span> Citation Manager</div>
 <header><div><h1>Citation Manager</h1><p>Organise, format, validate, and trace every citation used across generated content.</p><small>Last intelligence update: <b>8 minutes ago</b></small></div><div className={styles.actions}><button><Filter size={15}/>Filters</button><button><Download size={15}/>Export</button><button className={styles.primary}><Plus size={16}/>Add Citation</button></div></header>
 <section className={styles.metrics}><article data-tone="teal"><span>TOTAL CITATIONS</span><strong>1,842 <small>↑ 8.2%</small></strong><p>+142 from last month</p><Quote/></article><article data-tone="green"><span>VALID LINKS</span><strong>98%</strong><p>1,805 verified links</p><Link2/></article><article data-tone="amber"><span>MISSING METADATA</span><strong>31</strong><p>Needs attention</p><AlertCircle/></article></section>
 <section className={styles.registry}><div className={styles.panelTitle}><h2><List size={16}/>Citation Registry</h2><button>View all →</button></div><div className={styles.tabs}>{[["All Citations","1,842"],["Recently Used","156"],["Needs Attention","31"],["Archived","89"]].map(([label,count])=><button className={tab===label?styles.active:""} onClick={()=>setTab(label)} key={label}>{label}<b>{count}</b></button>)}</div><div className={styles.tools}><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search citation manager..."/></label><button>All Types <ChevronDown size={14}/></button><button>Sort: Relevance <ChevronDown size={14}/></button></div><div className={styles.citations}>{visible.map(item=><article key={item.title}><div className={styles.info}><b>{item.title}</b><div>{item.meta.map((tag,index)=><span key={tag}><FileText size={10}/>{tag}</span>)}</div></div><strong>{item.claims}<small>LINKED CLAIMS</small></strong><strong>{item.score}%<small>INTELLIGENCE</small></strong><em data-tone={item.tone}>{item.tone==="green"?<CheckCircle2 size={11}/>:<AlertCircle size={11}/>} {item.status}</em></article>)}</div><footer><span>Showing 1 to {visible.length} of <b>1,842</b> entries</span><div><Link2 size={13}/>98% link validity · <AlertCircle size={13}/>31 needing attention</div></footer></section>
 <div className={styles.bottom}>Updated 13/07/2026, 3:00 PM</div>
 </section>}
