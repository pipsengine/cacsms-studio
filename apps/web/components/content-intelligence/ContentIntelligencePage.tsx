"use client";

import {
  ArrowUpRight, BadgeCheck, Bell, BrainCircuit, CalendarDays, ChevronDown, Clock3, Database, Download, FileChartColumn,
  FileText, FlaskConical, FolderOpen, Globe2, GraduationCap, LibraryBig, LineChart, MoreHorizontal, Plus, Quote, RefreshCw, ScanLine,
  ScanSearch, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Target, Telescope, TrendingUp, UsersRound
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import type { IntelligencePageConfig } from "@/lib/content-intelligence-pages";
import styles from "./ContentIntelligencePage.module.css";

const iconMap: Record<string, ComponentType<{size?: number}>> = { Sparkles, FlaskConical, ScanSearch, BadgeCheck, BrainCircuit, Quote, TrendingUp, UsersRound, Telescope, ScanLine, GraduationCap, LibraryBig, Database, FileChartColumn };
const tones = { violet: "#6735ed", green: "#16a66a", blue: "#2583df", amber: "#e59b18", red: "#dc4d61" } as const;

export function ContentIntelligencePage({page}:{page:IntelligencePageConfig}) {
  const Icon = iconMap[page.icon] ?? Sparkles;
  const metricIcons = page.title === "Topic Discovery" ? [Search,TrendingUp,LineChart,Star] : page.title === "Research Workspace" ? [FolderOpen,FileText,Clock3,ShieldCheck] : [Icon,Icon,Icon,Icon];
  const isTopic = page.title === "Topic Discovery";
  const isResearch = page.title === "Research Workspace";
  const [activeTab,setActiveTab] = useState(page.tabs[0]);
  const [query,setQuery] = useState("");
  const [refreshing,setRefreshing] = useState(false);
  const rows=useMemo(()=>page.rows.filter(row=>row.join(" ").toLowerCase().includes(query.toLowerCase())),[page.rows,query]);
  function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),500)}
  return <section className={styles.page}>
    <header className={styles.top}><div><div className={styles.crumb}>Content Intelligence <span>/</span> {page.title}</div><h1>{page.title}</h1><p>{page.subtitle}</p></div><div className={styles.headerActions}><button className={styles.selector}>Workspace · CACSMS Studio <ChevronDown size={13}/></button><button className={styles.selector}>Brand · CACSMS <ChevronDown size={13}/></button><button className={styles.iconButton} aria-label="Notifications"><Bell size={15}/></button></div></header>
    <section className={styles.actionbar}><div className={styles.pageIcon}><Icon size={19}/></div><div><strong>{page.title} Workspace</strong><span>Last intelligence update: {refreshing?"updating now":"8 minutes ago"}</span></div><div className={styles.grow}/><button className={styles.secondary} onClick={refresh} disabled={refreshing}><RefreshCw size={14} className={refreshing?styles.spin:""}/> {refreshing?"Refreshing":"Refresh"}</button><button className={styles.primary}><Plus size={15}/>{page.action}</button></section>
    <section className={styles.stats}>{page.stats.map(([value,label,tone],index)=>{const MetricIcon=metricIcons[index];return <article key={label}><div className={styles.statIcon} style={{background:`${tones[tone]}16`,color:tones[tone]}}><MetricIcon size={29}/></div><div><strong>{value}</strong><span>{label}</span>{index===0?<small className={styles.metricTrend}>+12.4%</small>:null}</div></article>})}</section>
    <div className={styles.contentGrid}>
      <section className={styles.panel}><div className={styles.panelHead}><div><h2>{page.panelTitle}</h2><p>{page.panelHint}</p></div><button className={styles.secondary}><Download size={14}/> Export</button><button className={styles.dots} aria-label="More options"><MoreHorizontal size={17}/></button></div>
        <div className={styles.tabs}>{page.tabs.map((tab,index)=><button className={activeTab===tab?styles.tabOn:""} onClick={()=>setActiveTab(tab)} key={tab}>{tab}{index===0?<b>{page.rows.length}</b>:null}</button>)}</div>
        <div className={styles.tools}><label><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${page.title.toLowerCase()}...`}/></label><button className={styles.secondary}><SlidersHorizontal size={14}/> Filters</button><button className={styles.secondary}>Sort: Relevance <ChevronDown size={13}/></button></div>
        <div className={styles.table}><div className={`${styles.tableRow} ${styles.tableHead}`}><span>NAME / SUBJECT</span><span>TYPE / CATEGORY</span><span>INTELLIGENCE SCORE</span><span>STATUS</span><span/></div>{rows.map((row,index)=><div className={styles.tableRow} key={row[0]}><span><b>{row[0]}</b></span><span>{row[1]}</span><span><strong className={styles.score}>{row[2]}</strong><i><u style={{width:`${92-index*5}%`}}/></i></span><span><em className={statusClass(row[3],index)}>{row[3]}</em></span><button className={styles.rowAction} aria-label={`Actions for ${row[0]}`}><MoreHorizontal size={16}/></button></div>)}{rows.length===0?<div className={styles.empty}>No matching intelligence records.</div>:null}</div>
        {!isTopic?<div className={styles.panelFoot}><span>Showing {rows.length?1:0} to {rows.length} of {isResearch?rows.length:recordCount(page.stats[0][0])} entries</span><div><button>«</button><button>‹</button><button className={styles.current}>1</button><button>›</button><button>»</button></div></div>:null}
      </section>
      <aside className={styles.right}><section className={styles.panel}><div className={styles.panelHead}><div><h2>{page.sideTitle}</h2>{isResearch?<p>Current configuration and live signals</p>:null}</div>{!isTopic&&!isResearch?<button className={styles.dots} aria-label="Configuration options"><MoreHorizontal size={17}/></button>:null}</div><div className={`${styles.sideList} ${isTopic?styles.controlList:""} ${isResearch?styles.agentList:""}`}>{page.sideItems.map(([title,value,state],index)=>{const ControlIcon=[CalendarDays,Globe2,Target][index]??Icon;if(isTopic)return <div className={styles.controlRow} key={title}><b>{title}</b><span><ControlIcon size={14}/><small>{value}</small><ChevronDown size={13}/></span></div>;if(isResearch)return <div className={styles.agentRow} key={title}><span className={styles.mini}><Icon size={14}/></span><b>{title}</b><small>{value}</small><strong className={state==="active"?styles.online:styles.agentWarning}>{state==="active"?"● Live":"⚠ ›"}</strong></div>;return <div key={title}><span className={styles.mini}><Icon size={14}/></span><p><b>{title}</b><small>{value}</small></p><strong className={state==="active"?styles.online:""}>{state==="active"?"● Live":"›"}</strong></div>})}</div><button className={styles.wide}>View configuration <ArrowUpRight size={13}/></button></section>
        <section className={`${styles.panel} ${styles.insight}`}><div className={styles.insightTitle}><span className={styles.ai}><Sparkles size={15}/></span><div><h2>AI Intelligence Brief</h2><p>Generated from current signals</p></div></div><strong>{isResearch?"Research momentum":"Opportunity detected"}</strong><p>{isResearch?"The Future of AI in Nigerian Industry has the strongest evidence growth. Source diversity is improving and synthesis is ready to begin.":"Industrial AI and agentic automation topics are showing strong demand growth with low content saturation. High opportunity window."}</p><button>Review recommendation <ArrowUpRight size={13}/></button></section>
        <section className={`${styles.panel} ${styles.health}`}><h2>Intelligence Health</h2><div><span>Source coverage</span><b>92%</b></div><i><u style={{width:"92%"}}/></i></section>
      </aside>
    </div>
  </section>
}

function recordCount(value:string){return Number(value.replace(/[^0-9]/g,""))||48}
function statusClass(status:string,index:number){const value=status.toLowerCase();if(["trusted","verified","ready","healthy","valid","shared"].some(label=>value.includes(label)))return styles.success;if(index>1||["risk","unsupported","disputed","issue","broken","declining"].some(label=>value.includes(label)))return styles.warning;return styles.progress}
