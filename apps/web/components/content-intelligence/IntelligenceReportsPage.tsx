"use client";

import { Bell, BookOpen, ChevronDown, Download, Eye, FileChartColumn, FileText, Filter, GraduationCap, LayoutGrid, Palette, Plus, Search, Share2, Sparkles, Target, Timer, TrendingUp, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./IntelligenceReportsPage.module.css";

const reports=[
 {title:"Weekly Content Opportunity Brief",type:"Trend + gap intelligence",date:"13 Jul 2026",score:92,status:"Ready",tone:"green",icon:FileChartColumn},
 {title:"African Industrial AI Landscape",type:"Market intelligence",date:"11 Jul 2026",score:78,status:"Shared",tone:"blue",icon:TrendingUp},
 {title:"Audience Research Synthesis",type:"Audience research",date:"9 Jul 2026",score:65,status:"Ready",tone:"green",icon:UsersRound},
 {title:"Competitor Strategy Review",type:"Competitor intelligence",date:"7 Jul 2026",score:54,status:"Needs review",tone:"amber",icon:Target}
];
const modules=[
 {label:"Opportunity Intelligence",value:"20",icon:Target,tone:"blue"},{label:"Knowledge Base",value:"1.8M",icon:BookOpen,tone:"teal"},{label:"Writing Studio",value:"19",icon:Sparkles,tone:"violet"},{label:"Story & Learning",value:"17",icon:GraduationCap,tone:"pink"},{label:"Storyboard Studio",value:"15",icon:Palette,tone:"amber"},{label:"Visual Studio",value:"20",icon:LayoutGrid,tone:"teal"}
];

export function IntelligenceReportsPage(){
 const [tab,setTab]=useState("All Reports");const [query,setQuery]=useState("");
 const visible=useMemo(()=>reports.filter(report=>report.title.toLowerCase().includes(query.toLowerCase())&&(tab==="All Reports"||(tab==="Shared"&&report.status==="Shared")||(tab==="Drafts"&&report.status==="Needs review")||(tab==="Scheduled"&&report.score>70))),[query,tab]);
 return <section className={styles.page}>
  <div className={styles.crumb}>Content Intelligence <span>/</span> Intelligence Reports</div>
  <header><div><h1>Intelligence Reports</h1><p>Generate decision-ready reports from research, trends, audiences, competitors, and knowledge.</p><small>Last intelligence update: <b>8 minutes ago</b></small></div><div className={styles.actions}><button><Filter size={15}/>Filters</button><button><Download size={15}/>Export</button><button className={styles.primary}><Plus size={16}/>New Report</button></div></header>
  <section className={styles.metrics}><article data-tone="violet"><span>REPORTS GENERATED</span><strong>48 <small>↑ 12.4%</small></strong><p>+8 from last month</p><FileText/></article><article data-tone="blue"><span>SCHEDULED REPORTS</span><strong>12</strong><p>+3 next week</p><Timer/></article><article data-tone="amber"><span>AWAITING REVIEW</span><strong>9</strong><p>4 urgent priority</p><Eye/></article><article data-tone="green"><span>SHARED WITH TEAMS</span><strong>27</strong><p>+6 this week</p><Share2/></article></section>
  <section className={styles.modules}>{modules.map(({label,value,icon:Icon,tone})=><article data-tone={tone} key={label}><Icon size={17}/><strong>{value}</strong><span>{label}</span></article>)}</section>
  <div className={styles.tabs}>{[["All Reports","48"],["Scheduled","12"],["Drafts","8"],["Shared","27"]].map(([label,count])=><button className={tab===label?styles.active:""} onClick={()=>setTab(label)} key={label}>{label}<b>{count}</b></button>)}</div>
  <div className={styles.tools}><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search intelligence reports..."/></label><button>All Types <ChevronDown size={14}/></button><button>Sort: Recent <ChevronDown size={14}/></button><div className={styles.chips}><span><Timer size={11}/>Trend Pulse</span><span><Bell size={11}/>Daily at 07:00</span><span><FileText size={11}/>Executive Summary</span><span><Bell size={11}/>Monthly at 07:00</span></div></div>
  <section className={styles.table}><div className={styles.tableHead}><span>NAME / SUBJECT</span><span>TYPE / CATEGORY</span><span>INTELLIGENCE SCORE</span><span>STATUS</span></div>{visible.map(({title,type,date,score,status,tone,icon:Icon})=><article key={title}><span className={styles.report}><Icon size={17}/><b>{title}</b></span><span>{type}<small>{date}</small></span><span className={styles.score}><i><u data-tone={tone} style={{width:`${score}%`}}/></i><b>{score}%</b></span><span><em data-tone={tone}>{status}</em></span></article>)}{visible.length===0?<div className={styles.empty}>No reports match the selected filters.</div>:null}</section>
  <footer><span>Showing <b>1</b> to <b>{visible.length}</b> of <b>48</b> entries</span><span>Intelligence Health: <b>92%</b></span><div>Updated 13/07/2026, 2:37 PM</div></footer>
 </section>
}
