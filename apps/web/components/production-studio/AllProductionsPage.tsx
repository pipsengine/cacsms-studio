"use client";

import {
  AlertTriangle, Archive, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleUserRound, Clapperboard, Clock3, Download, Eye, Filter, Grid2X2,
  Hourglass, LayoutList, Megaphone, MoreHorizontal, Plus, RefreshCw, Search, Sparkles,
  Square, Target, TimerReset, Video
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./AllProductionsPage.module.css";

const metrics=[
  {value:"128",label:"Total Productions",detail:"+12 this month",tone:"purple",icon:Clapperboard},
  {value:"34",label:"In Progress",detail:"8 due this week",tone:"blue",icon:TimerReset},
  {value:"12",label:"In Review",detail:"3 awaiting approval",tone:"violet",icon:Eye},
  {value:"67",label:"Completed",detail:"92% on schedule",tone:"green",icon:CheckCircle2},
  {value:"5",label:"At Risk",detail:"Requires attention",tone:"red",icon:AlertTriangle},
  {value:"6.8 days",label:"Avg. Cycle Time",detail:"−1.2 days improved",tone:"indigo",icon:Hourglass}
] as const;
const rows=[
  {title:"AI Is Reshaping African Manufacturing",type:"Documentary",stage:"Generation",owner:"Research Agent",progress:72,status:"On track",updated:"12 min ago",tone:"purple",icon:Clapperboard},
  {title:"The Smart Factory Skills Gap",type:"Teaching Content",stage:"Review & Approval",owner:"Sarah A.",progress:88,status:"Awaiting review",updated:"38 min ago",tone:"blue",icon:Clapperboard},
  {title:"Digital Twins Explained",type:"Explainer",stage:"Research & Planning",owner:"Content Agent",progress:46,status:"On track",updated:"1 hr ago",tone:"teal",icon:Video},
  {title:"Automation Without the Hype",type:"Podcast",stage:"Generation",owner:"Voice Agent",progress:64,status:"At risk",updated:"2 hrs ago",tone:"pink",icon:Target},
  {title:"Industrial AI Investment Guide",type:"Corporate Content",stage:"Publish & Distribute",owner:"Publishing Agent",progress:96,status:"Scheduled",updated:"4 hrs ago",tone:"red",icon:Clapperboard},
  {title:"Future-Proof Your Operations",type:"Social Content",stage:"Content Setup",owner:"Sarah A.",progress:24,status:"Draft",updated:"Yesterday",tone:"orange",icon:Megaphone}
] as const;
const tabs=[{label:"All Productions",icon:Grid2X2},{label:"In Progress",icon:TimerReset},{label:"In Review",icon:Eye},{label:"Completed",icon:CheckCircle2},{label:"At Risk",icon:AlertTriangle},{label:"Archived",icon:Archive}];

export function AllProductionsPage(){
  const [query,setQuery]=useState("");const [activeTab,setActiveTab]=useState("All Productions");const [refreshing,setRefreshing]=useState(false);
  const visible=useMemo(()=>rows.filter(row=>`${row.title} ${row.type} ${row.owner}`.toLowerCase().includes(query.toLowerCase())&&(activeTab==="All Productions"||row.status===activeTab||activeTab==="In Progress"&&!["Awaiting review","On track"].includes(row.status)===false)),[query,activeTab]);
  function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),500)}
  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Production Studio <span>/</span> <b>All Productions</b></div><h1>All Productions</h1><p>View and manage every production across formats, owners, stages, and publishing destinations.</p></div><div className={styles.headerActions}><button className={styles.workspace}>Workspace · CACSMS Studio</button><button className={styles.refresh} onClick={refresh}><RefreshCw size={15} className={refreshing?styles.spin:""}/>{refreshing?"Refreshing":"Refresh"}</button><Link className={styles.create} href="/production-studio/create-production">Create Production</Link></div></header>
    <div className={styles.navRow}><div className={styles.tabs}>{tabs.map(({label,icon:Icon})=><button className={activeTab===label?styles.activeTab:""} onClick={()=>setActiveTab(label)} key={label}><Icon size={16}/>{label}</button>)}</div><button className={styles.period}><CalendarDays size={15}/>Last 30 days<ChevronDown size={14}/></button></div>
    <section className={styles.metrics}>{metrics.map(({value,label,detail,tone,icon:Icon})=><article key={label}><span className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={25}/></span><span><strong>{value}</strong><b>{label}</b><small>{detail}</small></span></article>)}</section>
    <div className={styles.contentGrid}><section className={styles.portfolio}><div className={styles.panelHead}><div><h2>Production Portfolio</h2><p>Track active work across every content format and production stage.</p></div><span>128 productions</span><button><Download size={15}/>Export</button><button aria-label="More options"><MoreHorizontal size={16}/></button></div>
      <div className={styles.tools}><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search productions, owners, or topics..."/></label><button><Filter size={15}/>Filter <b>3</b></button><div className={styles.grow}/><button className={styles.sort}>Sort: Recently updated<ChevronDown size={14}/></button><span className={styles.viewToggle}><button className={styles.selectedView}><LayoutList size={16}/></button><button><Grid2X2 size={16}/></button></span></div>
      <div className={styles.table}><div className={`${styles.row} ${styles.tableHead}`}><Square size={15}/><span>PRODUCTION</span><span>TYPE</span><span>STAGE</span><span>OWNER</span><span>PROGRESS</span><span>STATUS</span><span>UPDATED</span><span>ACTION</span></div>{visible.map(({title,type,stage,owner,progress,status,updated,tone,icon:Icon})=><div className={styles.row} key={title}><Square size={15}/><span className={styles.production}><i className={styles[tone]}><Icon size={16}/></i><b>{title}</b></span><span>{type}</span><span className={styles.stage}><i style={{background:stageColor(tone)}}/> {stage}</span><span className={styles.owner}><CircleUserRound size={13}/>{owner}</span><span className={styles.progress}><b>{progress}%</b><i><u style={{width:`${progress}%`}}/></i></span><span><em className={statusClass(status)}>{status}</em></span><span>{updated}</span><button aria-label={`Actions for ${title}`}><MoreHorizontal size={15}/></button></div>)}</div>
      <div className={styles.footer}><span>Showing 1–{visible.length} of 128 productions</span><div><button><ChevronLeft size={14}/></button><button className={styles.current}>1</button><button>2</button><button>3</button><span>…</span><button>22</button><button><ChevronRight size={14}/></button></div></div>
    </section><aside className={styles.rightRail}><section className={styles.sideCard}><h2>Production Mix</h2><div className={styles.mix}><div className={styles.donut}><span><strong>128</strong><small>Total</small></span></div><div className={styles.legend}>{[["Documentary","28%","purple"],["Teaching","22%","blue"],["Explainer","18%","teal"],["Social","16%","orange"],["Podcast","10%","pink"],["Other","6%","gray"]].map(([label,value,tone])=><div key={label}><i className={styles[tone]}/><span>{label}</span><b>{value}</b></div>)}</div></div></section>
      <section className={styles.sideCard}><h2>Operational Alerts</h2><div className={styles.alerts}>{[["5 productions at risk","Review blocked stages","red"],["3 approvals overdue","Oldest: 18 hours","orange"],["8 productions due this week","View schedule","blue"]].map(([title,detail,tone])=><button key={title}><i className={styles[tone]}/><span><b>{title}</b><small>{detail}</small></span><ChevronRight size={15}/></button>)}</div></section>
      <section className={`${styles.sideCard} ${styles.brief}`}><h2><Sparkles size={16}/> AI Production Brief</h2><strong>Workflow opportunity</strong><p>Review-stage congestion is increasing cycle time. Reassigning three approval tasks could recover 1.4 production days.</p><button>Review recommendation <ArrowRight size={14}/></button></section>
    </aside></div>
  </section>
}
function statusClass(status:string){if(status==="On track")return styles.good;if(status==="Awaiting review")return styles.review;if(status==="At risk")return styles.risk;if(status==="Scheduled")return styles.scheduled;return styles.draft}
function stageColor(tone:string){return ({purple:"#6733ed",blue:"#2874ef",teal:"#19a89f",pink:"#6733ed",red:"#ef4242",orange:"#f59b0a"} as Record<string,string>)[tone]??"#6733ed"}
