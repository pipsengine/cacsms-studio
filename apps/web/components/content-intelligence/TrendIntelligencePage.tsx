"use client";

import {
  AlertTriangle, ArrowRight, BarChart3, Bell, ChevronDown, ChevronLeft, ChevronRight,
  CircleDot, Download, Filter, Globe2, Grid2X2, Info, LineChart, List, MoreHorizontal,
  Plus, RefreshCw, Search, Sparkles, Star, TrendingDown, TrendingUp, Youtube
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import styles from "./TrendIntelligencePage.module.css";

type Tone="violet"|"blue"|"teal"|"green"|"amber"|"red";
const metrics:[string,string,string,Tone,ComponentType<{size?:number}>][]=[
 ["126","Active Trends","+12.4%","violet",TrendingUp],
 ["18","Breakout Signals","6 detected today","red",LineChart],
 ["42","Accelerating","Average +68% velocity","teal",TrendingUp],
 ["57M","Signal Reach","Across 12 markets","teal",Globe2]
];
const trends=[
 {name:"Agentic AI for Business Operations",category:"Technology",velocity:"+184%",reach:"12.8M",sources:"8 sources",durability:92,status:"Breakout",tone:"violet",spark:"2,25 9,23 16,24 23,19 30,21 37,17 44,19 51,13 58,15 65,9 72,12 79,5 86,8 93,2 100,5 107,0"},
 {name:"Digital Twins in Construction",category:"Industry 4.0",velocity:"+92%",reach:"6.4M",sources:"6 sources",durability:86,status:"Accelerating",tone:"blue",spark:"2,25 10,21 18,24 26,18 34,20 42,16 50,18 58,12 66,15 74,9 82,12 90,4 98,9 107,0"},
 {name:"AI Sovereignty in Africa",category:"Policy & Society",velocity:"+71%",reach:"4.8M",sources:"7 sources",durability:89,status:"Emerging",tone:"teal",spark:"2,25 10,22 18,24 26,19 34,22 42,17 50,18 58,13 66,15 74,8 82,11 90,4 98,7 107,0"},
 {name:"Human-Centred Automation",category:"Future of Work",velocity:"+56%",reach:"3.1M",sources:"5 sources",durability:84,status:"Growing",tone:"green",spark:"2,25 10,22 18,24 26,19 34,21 42,17 50,19 58,14 66,16 74,9 82,12 90,5 98,9 107,0"},
 {name:"Industrial Cybersecurity Skills",category:"Security",velocity:"+44%",reach:"2.6M",sources:"5 sources",durability:78,status:"Growing",tone:"green",spark:"2,24 10,19 18,23 26,17 34,21 42,15 50,19 58,14 66,17 74,10 82,14 90,6 98,12 107,2"},
 {name:"Generic Chatbot Tutorials",category:"Technology",velocity:"−28%",reach:"1.9M",sources:"4 sources",durability:41,status:"Declining",tone:"red",spark:"2,2 10,6 18,4 26,10 34,7 42,12 50,10 58,15 66,13 74,18 82,16 90,23 98,20 107,27"}
] as const;
const sources=[
 {name:"Search Trends",share:"28%",tone:"google",icon:Globe2},
 {name:"YouTube",share:"22%",tone:"youtube",icon:Youtube},
 {name:"LinkedIn",share:"19%",tone:"linkedin",icon:BarChart3},
 {name:"Social Listening",share:"17%",tone:"violet",icon:CircleDot},
 {name:"News & Research",share:"14%",tone:"gray",icon:Search}
] as const;

function Sparkline({points,tone}:{points:string;tone:Tone}){return <svg className={styles.spark} data-tone={tone} viewBox="0 0 110 30" preserveAspectRatio="none" aria-hidden="true"><polygon points={`2,30 ${points} 107,30`} /><polyline points={points}/></svg>}

export function TrendIntelligencePage(){
 const [tab,setTab]=useState("Live Trends");const [query,setQuery]=useState("");const [refreshing,setRefreshing]=useState(false);const [view,setView]=useState<"list"|"chart">("list");
 const visible=useMemo(()=>trends.filter(item=>`${item.name} ${item.category} ${item.status}`.toLowerCase().includes(query.toLowerCase())),[query]);
 function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),600)}
 return <section className={styles.page}>
  <header className={styles.header}><div><div className={styles.crumb}>Content Intelligence <span>/</span> Trend Intelligence</div><h1>Trend Intelligence</h1><p>Monitor emerging conversations and detect accelerating topics before they become mainstream.</p></div><div className={styles.selectors}><button>Workspace · CACSMS Studio<ChevronDown size={13}/></button><button>Brand · CACSMS<ChevronDown size={13}/></button><button aria-label="Notifications"><Bell size={15}/></button></div></header>
  <section className={styles.workspaceBar}><i><TrendingUp size={23}/></i><div><b>Trend Intelligence Workspace</b><small>Last intelligence update: {refreshing?"just now":"2 minutes ago"}</small></div><span><i/>8 signal sources live</span><button onClick={refresh}><RefreshCw className={refreshing?styles.spin:""} size={14}/>Refresh</button><button className={styles.primary}><Plus size={15}/>Create Monitor</button></section>
  <div className={styles.layout}><main><section className={styles.metrics}>{metrics.map(([value,label,note,tone,Icon])=><article data-tone={tone} key={label}><i><Icon size={25}/></i><div><strong>{value}</strong><span>{label}</span><small>{note}</small></div></article>)}</section>
   <section className={styles.panel}><div className={styles.panelHead}><div><h2>Live Trend Radar</h2><p>Cross-platform momentum scored by velocity, reach, durability, saturation, geography, and audience fit.</p></div><b>126 monitored trends</b><button><Download size={14}/>Export</button><button aria-label="More options"><MoreHorizontal size={17}/></button></div>
    <nav className={styles.tabs}>{["Live Trends","Breakout","Accelerating","Emerging","Stable","Declining","Saved Monitors"].map(name=><button className={tab===name?styles.active:""} onClick={()=>setTab(name)} key={name}>{name}</button>)}</nav>
    <div className={styles.tools}><label><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search trends, topics, markets, or signals..."/></label><button><Filter size={14}/>Filter<b>4</b><ChevronDown size={12}/></button><button>Sort: Velocity<ChevronDown size={13}/></button><span><button className={view==="list"?styles.selected:""} onClick={()=>setView("list")} aria-label="List view"><List size={16}/></button><button className={view==="chart"?styles.selected:""} onClick={()=>setView("chart")} aria-label="Chart view"><BarChart3 size={16}/></button></span></div>
    <div className={styles.table}><div className={styles.tableHead}><span>TREND / CATEGORY</span><span>7-DAY MOMENTUM <Info size={9}/></span><span>VELOCITY <Info size={9}/></span><span>REACH <Info size={9}/></span><span>SOURCE DIVERSITY</span><span>DURABILITY <Info size={9}/></span><span>LIFECYCLE <Info size={9}/></span><span/></div>{visible.map(item=><article key={item.name}><span><b>{item.name}</b><small>{item.category}</small></span><Sparkline points={item.spark} tone={item.tone}/><strong data-tone={item.tone}>{item.velocity}</strong><span>{item.reach}</span><span>{item.sources}</span><span className={styles.score}><b>{item.durability} / 100</b><i><u data-tone={item.durability<50?"amber":"green"} style={{width:`${item.durability}%`}}/></i></span><em data-tone={item.tone}>{item.status}</em><span className={styles.rowActions}><button aria-label={`Save ${item.name}`}><Star size={15}/></button><button aria-label={`More actions for ${item.name}`}><MoreHorizontal size={16}/></button></span></article>)}{visible.length===0?<div className={styles.empty}>No monitored trends match your search.</div>:null}</div>
    <footer className={styles.pagination}><span>Showing 1 to {visible.length} of 126 trends</span><div><button><ChevronLeft size={13}/><ChevronLeft size={13}/></button><button><ChevronLeft size={13}/></button><button className={styles.current}>1</button><button>2</button><button>3</button><button>…</button><button>21</button><button><ChevronRight size={13}/></button><button><ChevronRight size={13}/><ChevronRight size={13}/></button></div></footer>
   </section></main><aside>
    <section className={`${styles.panel} ${styles.forecast}`}><div className={styles.sideHead}><h2>Selected Trend Forecast <Info size={11}/></h2><button>30 days<ChevronDown size={12}/></button></div><b>Agentic AI for Business Operations</b><div className={styles.chart}><span>Interest (Indexed)</span><svg viewBox="0 0 390 120" preserveAspectRatio="none"><defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a5cf5" stopOpacity=".26"/><stop offset="1" stopColor="#8a5cf5" stopOpacity="0"/></linearGradient></defs><g className={styles.gridLines}><line x1="28" y1="20" x2="382" y2="20"/><line x1="28" y1="45" x2="382" y2="45"/><line x1="28" y1="70" x2="382" y2="70"/><line x1="28" y1="95" x2="382" y2="95"/></g><path className={styles.forecastArea} d="M28 88 C55 84 70 82 92 76 S135 68 160 58 S205 45 230 39 S278 28 310 26 S350 20 382 17 L382 105 L28 105Z"/><path className={styles.forecastLine} d="M28 88 C55 84 70 82 92 76 S135 68 160 58 S205 45 230 39 S278 28 310 26 S350 20 382 17"/><line className={styles.now} x1="160" y1="10" x2="160" y2="105"/><g className={styles.axis}><text x="2" y="23">250</text><text x="2" y="48">200</text><text x="2" y="73">150</text><text x="2" y="98">100</text><text x="28" y="117">−20d</text><text x="112" y="117">−10d</text><text x="151" y="117">Now</text><text x="225" y="117">+10d</text><text x="302" y="117">+20d</text><text x="360" y="117">+30d</text></g></svg><b className={styles.nowLabel}>Now</b><b className={styles.forecastLabel}>Forecast +36%</b></div><footer>{[["Current velocity","+184%"],["Peak window","7–12 days"],["Saturation","Low"],["Forecast confidence","91%"]].map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</footer></section>
    <section className={`${styles.panel} ${styles.sources}`}><div className={styles.sideHead}><h2>Signal Sources <Info size={11}/></h2><span>8 / 8 sources connected</span></div>{sources.map(({name,share,tone,icon:Icon})=><article key={name}><i data-tone={tone}><Icon size={13}/></i><b>{name}</b><span>{share}</span><u><em style={{width:share}}/></u><small>● Live</small></article>)}</section>
    <section className={`${styles.panel} ${styles.alerts}`}><h2>Trend Alerts</h2><article data-tone="red"><TrendingUp/><span><b>Breakout detected</b><small>Agentic AI for Business Operations</small></span><time>2m ago</time><ChevronRight/></article><article data-tone="amber"><CircleDot/><span><b>Peak window approaching</b><small>Digital Twins in Construction</small></span><time>15m ago</time><ChevronRight/></article><article data-tone="blue"><Globe2/><span><b>New regional signal</b><small>AI Sovereignty · West Africa</small></span><time>32m ago</time><ChevronRight/></article></section>
    <section className={`${styles.panel} ${styles.brief}`}><h2>AI Trend Brief <Info size={11}/></h2><div><i><Sparkles size={20}/></i><span><b>Timing opportunity</b><p>Agentic AI for business operations is likely to peak within 7–12 days. Documentary saturation remains low while professional interest is accelerating.</p></span></div><footer><span><b>Act now</b><b>Documentary</b><b>High confidence</b></span><button>Create content opportunity<ArrowRight size={12}/></button></footer></section>
   </aside></div>
 </section>
}
