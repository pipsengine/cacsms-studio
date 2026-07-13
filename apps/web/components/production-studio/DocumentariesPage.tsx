"use client";

import {
  BadgeCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Download,
  FileText, Filter, Grid2X2, LayoutList, MoreHorizontal, RefreshCw, Search, Scissors,
  ShieldCheck, Sparkles
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./AllProductionsPage.module.css";
import documentaryStyles from "./DocumentariesPage.module.css";
import refinementStyles from "./DocumentariesRefinements.module.css";

const metrics=[
  {value:"24",label:"Active Documentaries",detail:"+4 this month",tone:"purple",icon:FileText},
  {value:"9",label:"In Research",detail:"126 verified sources",tone:"blue",icon:Search},
  {value:"6",label:"In Production",detail:"3 filming · 3 AI generated",tone:"teal",icon:Clapperboard},
  {value:"4",label:"In Review",detail:"2 awaiting fact-check",tone:"orange",icon:ShieldCheck},
  {value:"18",label:"Published",detail:"92% editorial score",tone:"green",icon:CheckCircle2},
  {value:"87%",label:"Evidence Readiness",detail:"+6% this quarter",tone:"indigo",icon:BadgeCheck}
] as const;
const tabs=[{label:"All Documentaries",icon:FileText},{label:"Research",icon:Search},{label:"Treatment",icon:FileText},{label:"Production",icon:Clapperboard},{label:"Post-Production",icon:Scissors},{label:"Review",icon:ShieldCheck},{label:"Published",icon:CheckCircle2}];
const documentaries=[
  {title:"AI Is Reshaping African Manufacturing",format:"Feature · 42 min",stage:"Production",owner:"Sarah A.",initials:"SA",evidence:94,progress:72,status:"On track",updated:"12 min ago",tone:"teal",image:"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=160&q=85"},
  {title:"The Hidden Cost of Manual Operations",format:"Short · 18 min",stage:"Editorial Review",owner:"Review Agent",initials:"RA",evidence:88,progress:86,status:"Fact-check",updated:"42 min ago",tone:"orange",image:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=85"},
  {title:"Inside Nigeria's Smart Factories",format:"Series · Ep. 1",stage:"Research",owner:"Research Agent",initials:"RE",evidence:79,progress:38,status:"Sources needed",updated:"1 hr ago",tone:"blue",image:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=160&q=85"},
  {title:"Digital Twins: Industry's Virtual Future",format:"Feature · 35 min",stage:"Post-Production",owner:"Video Agent",initials:"VA",evidence:96,progress:91,status:"On track",updated:"2 hrs ago",tone:"violet",image:"https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=160&q=85"},
  {title:"Automation Without the Hype",format:"Short · 15 min",stage:"Treatment",owner:"Content Agent",initials:"CA",evidence:82,progress:26,status:"In development",updated:"5 hrs ago",tone:"orange",image:"https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=160&q=85"},
  {title:"Building Africa's AI Workforce",format:"Series · Ep. 2",stage:"Published",owner:"Publishing Agent",initials:"PA",evidence:98,progress:100,status:"Published",updated:"Yesterday",tone:"green",image:"https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=160&q=85"}
] as const;

export function DocumentariesPage(){
  const [activeTab,setActiveTab]=useState("All Documentaries");const [query,setQuery]=useState("");const [refreshing,setRefreshing]=useState(false);
  const visible=useMemo(()=>documentaries.filter(item=>`${item.title} ${item.owner} ${item.format}`.toLowerCase().includes(query.toLowerCase())&&(activeTab==="All Documentaries"||item.stage===activeTab)),[activeTab,query]);
  function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),500)}
  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Production Studio <span>/</span> Documentaries</div><h1>Documentaries</h1><p>Develop factual, research-led productions from early treatment through delivery.</p></div><div className={styles.headerActions}><button className={styles.workspace}>Workspace · CACSMS Studio</button><button className={styles.refresh} onClick={refresh}><RefreshCw size={15} className={refreshing?styles.spin:""}/>{refreshing?"Refreshing":"Refresh"}</button><Link className={styles.create} href="/production-studio/create-production">Create Documentary</Link></div></header>
    <div className={styles.navRow}><div className={`${styles.tabs} ${documentaryStyles.documentaryTabs}`}>{tabs.map(({label,icon:Icon})=><button className={activeTab===label?styles.activeTab:""} onClick={()=>setActiveTab(label)} key={label}><Icon size={16}/>{label}</button>)}</div><button className={styles.period}>Last 90 days<ChevronDown size={14}/></button></div>
    <section className={styles.metrics}>{metrics.map(({value,label,detail,tone,icon:Icon})=><article key={label}><span className={`${styles.metricIcon} ${refinementStyles.docMetricIcon}`} data-tone={tone}><Icon size={25}/></span><span><strong>{value}</strong><b>{label}</b><small>{detail}</small></span></article>)}</section>
    <div className={styles.contentGrid}><section className={styles.portfolio}><div className={styles.panelHead}><div><h2>Documentary Portfolio</h2><p>Track research integrity, production stages, owners, and editorial readiness.</p></div><span>24 documentaries</span><button><Download size={15}/>Export</button><button aria-label="More options"><MoreHorizontal size={16}/></button></div>
      <div className={styles.tools}><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search documentaries, topics, or owners..."/></label><button><Filter size={15}/>Filter <b>2</b></button><div className={styles.grow}/><button className={styles.sort}>Sort: Recently updated<ChevronDown size={14}/></button><span className={styles.viewToggle}><button className={styles.selectedView}><LayoutList size={16}/></button><button><Grid2X2 size={16}/></button></span></div>
      <div className={styles.table}><div className={`${styles.row} ${styles.tableHead} ${documentaryStyles.docRow}`}><span>DOCUMENTARY</span><span>FORMAT</span><span>STAGE</span><span>OWNER</span><span>EVIDENCE</span><span>PROGRESS</span><span>STATUS</span><span>UPDATED</span><span/></div>{visible.map(item=><div className={`${styles.row} ${documentaryStyles.docRow}`} key={item.title}><span className={documentaryStyles.documentary}><img src={item.image} alt=""/><b>{item.title}</b></span><span>{item.format}</span><span><em className={documentaryStyles.stageBadge} data-tone={item.tone}>{item.stage}</em></span><span className={documentaryStyles.docOwner}><i>{item.initials}</i>{item.owner}</span><span className={documentaryStyles.evidence}><ShieldCheck size={15}/><b>{item.evidence}%</b></span><span className={styles.progress}><b>{item.progress}%</b><i><u style={{width:`${item.progress}%`}}/></i></span><span><em className={statusClass(item.status)}>{item.status}</em></span><span>{item.updated}</span><button aria-label={`Actions for ${item.title}`}><MoreHorizontal size={15}/></button></div>)}</div>
      <div className={styles.footer}><span>Showing 1–{visible.length} of 24 documentaries</span><div><button><ChevronLeft size={14}/></button><button className={styles.current}>1</button><button>2</button><button>3</button><button>4</button><button><ChevronRight size={14}/></button></div></div>
    </section><aside className={styles.rightRail}><section className={`${styles.sideCard} ${documentaryStyles.pipeline} ${refinementStyles.compactPipeline}`}><h2>Documentary Pipeline</h2><div>{[["Research",9,"blue",100],["Treatment",3,"yellow",45],["Production",6,"teal",76],["Post-Production",2,"violet",28],["Review",4,"orange",56]].map(([label,count,tone,width])=><p key={String(label)}><span>{label}</span><i><u className={documentaryStyles[String(tone)]} style={{width:`${width}%`}}/></i><b>{count}</b></p>)}</div></section>
      <section className={`${styles.sideCard} ${refinementStyles.compactAlerts}`}><h2>Editorial Alerts</h2><div className={styles.alerts}>{[["2 fact checks overdue","Oldest: 14 hours","red"],["3 productions need sources","Evidence below 80%","orange"],["4 reviews due this week","Open review queue","blue"]].map(([title,detail,tone])=><button key={title}><i className={styles[tone]}/><span><b>{title}</b><small>{detail}</small></span><ChevronRight size={15}/></button>)}</div></section>
      <section className={`${styles.sideCard} ${styles.brief}`}><h2><Sparkles size={16}/> AI Documentary Brief</h2><strong>Evidence opportunity</strong><p>Two active documentaries reference the same verified industrial AI dataset. Linking the shared evidence could improve readiness and reduce research time by 18%.</p><button>Review recommendation <ChevronRight size={14}/></button></section>
    </aside></div>
  </section>
}
function statusClass(status:string){if(status==="On track"||status==="Published")return styles.good;if(status==="Sources needed")return styles.review;if(status==="Fact-check")return documentaryStyles.factCheck;return styles.scheduled}
