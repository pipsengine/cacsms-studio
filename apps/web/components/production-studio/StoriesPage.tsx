"use client";

import {
  BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Download,
  FileText, Filter, Grid2X2, HeartPulse, LayoutList, Lightbulb, MoreHorizontal, PenLine,
  RefreshCw, Search, Send, Sparkles, TableProperties
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./AllProductionsPage.module.css";
import documentaryStyles from "./DocumentariesPage.module.css";
import refinementStyles from "./DocumentariesRefinements.module.css";
import storyStyles from "./StoriesPage.module.css";

const metrics=[
  {value:"32",label:"Active Stories",detail:"+6 this month",tone:"purple",icon:BookOpen},
  {value:"11",label:"In Development",detail:"7 outlines · 4 scripts",tone:"blue",icon:FileText},
  {value:"8",label:"In Production",detail:"3 episodic series",tone:"teal",icon:Clapperboard},
  {value:"5",label:"In Review",detail:"2 continuity checks",tone:"orange",icon:Search},
  {value:"21",label:"Published",detail:"89% audience score",tone:"green",icon:Send},
  {value:"91%",label:"Narrative Health",detail:"+4% this quarter",tone:"indigo",icon:HeartPulse}
] as const;
const tabs=[{label:"All Stories",icon:BookOpen},{label:"Ideas",icon:Lightbulb},{label:"Outlining",icon:FileText},{label:"Scriptwriting",icon:PenLine},{label:"Storyboarding",icon:TableProperties},{label:"Production",icon:Clapperboard},{label:"Review",icon:Search},{label:"Published",icon:Send}];
const stories=[
  {title:"The Last Shift",format:"Episodic · Ep. 1",stage:"Scriptwriting",owner:"Writing Agent",initials:"WA",health:94,progress:68,status:"On track",updated:"14 min ago",tone:"violet",image:"https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=180&q=85"},
  {title:"Machines That Remember",format:"Short Story · 12 min",stage:"Storyboarding",owner:"Sarah A.",initials:"SA",health:89,progress:81,status:"Ready for production",updated:"37 min ago",tone:"blue",image:"https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=180&q=85"},
  {title:"Tomorrow's Factory",format:"Series · Ep. 3",stage:"Production",owner:"Story Agent",initials:"SA",health:92,progress:74,status:"In production",updated:"1 hr ago",tone:"teal",image:"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=180&q=85"},
  {title:"The Human Algorithm",format:"Narrative Podcast",stage:"Editorial Review",owner:"Review Agent",initials:"RA",health:84,progress:88,status:"Continuity check",updated:"2 hrs ago",tone:"orange",image:"https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=180&q=85"},
  {title:"Beyond the Assembly Line",format:"Brand Story · 8 min",stage:"Outlining",owner:"Content Agent",initials:"CA",health:77,progress:32,status:"Needs development",updated:"5 hrs ago",tone:"blue",image:"https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=180&q=85"},
  {title:"Code of Tomorrow",format:"Social Series · Ep. 6",stage:"Published",owner:"Publishing Agent",initials:"PA",health:96,progress:100,status:"Published",updated:"Yesterday",tone:"green",image:"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=180&q=85"}
] as const;

export function StoriesPage(){
  const [activeTab,setActiveTab]=useState("All Stories");const [query,setQuery]=useState("");const [refreshing,setRefreshing]=useState(false);
  const visible=useMemo(()=>stories.filter(item=>`${item.title} ${item.owner} ${item.format}`.toLowerCase().includes(query.toLowerCase())&&(activeTab==="All Stories"||item.stage===activeTab)),[activeTab,query]);
  function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),500)}
  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Production Studio <span>/</span> Stories</div><h1>Stories</h1><p>Manage narrative productions, episodic stories, scripts, and story-led campaigns.</p></div><div className={styles.headerActions}><button className={styles.workspace}>Workspace · CACSMS Studio</button><button className={styles.refresh} onClick={refresh}><RefreshCw size={15} className={refreshing?styles.spin:""}/>{refreshing?"Refreshing":"Refresh"}</button><Link className={styles.create} href="/production-studio/create-production">Create Story</Link></div></header>
    <div className={styles.navRow}><div className={`${styles.tabs} ${storyStyles.storyTabs}`}>{tabs.map(({label,icon:Icon})=><button className={activeTab===label?styles.activeTab:""} onClick={()=>setActiveTab(label)} key={label}><Icon size={16}/>{label}</button>)}</div><button className={styles.period}>Last 90 days<ChevronDown size={14}/></button></div>
    <section className={styles.metrics}>{metrics.map(({value,label,detail,tone,icon:Icon})=><article key={label}><span className={`${styles.metricIcon} ${refinementStyles.docMetricIcon}`} data-tone={tone}><Icon size={25}/></span><span><strong>{value}</strong><b>{label}</b><small>{detail}</small></span></article>)}</section>
    <div className={styles.contentGrid}><section className={styles.portfolio}><div className={styles.panelHead}><div><h2>Story Portfolio</h2><p>Track narrative development, story structure, owners, continuity, and production readiness.</p></div><span>32 stories</span><button><Download size={15}/>Export</button><button aria-label="More options"><MoreHorizontal size={16}/></button></div>
      <div className={styles.tools}><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search stories, series, characters, or owners..."/></label><button><Filter size={15}/>Filter <b>3</b></button><div className={styles.grow}/><button className={styles.sort}>Sort: Recently updated<ChevronDown size={14}/></button><span className={styles.viewToggle}><button className={styles.selectedView}><LayoutList size={16}/></button><button><Grid2X2 size={16}/></button></span></div>
      <div className={styles.table}><div className={`${styles.row} ${styles.tableHead} ${documentaryStyles.docRow}`}><span>STORY</span><span>FORMAT</span><span>DEVELOPMENT STAGE</span><span>OWNER</span><span>NARRATIVE HEALTH</span><span>PROGRESS</span><span>STATUS</span><span>UPDATED</span><span/></div>{visible.map(item=><div className={`${styles.row} ${documentaryStyles.docRow}`} key={item.title}><span className={documentaryStyles.documentary}><img src={item.image} alt=""/><b>{item.title}</b></span><span>{item.format}</span><span><em className={documentaryStyles.stageBadge} data-tone={item.tone}>{item.stage}</em></span><span className={documentaryStyles.docOwner}><i className={storyStyles.ownerAvatar}>{item.initials}</i>{item.owner}</span><span className={storyStyles.health}><HeartPulse size={15}/><b>{item.health}%</b></span><span className={styles.progress}><b>{item.progress}%</b><i><u style={{width:`${item.progress}%`}}/></i></span><span><em className={statusClass(item.status)}>{item.status}</em></span><span>{item.updated}</span><button aria-label={`Actions for ${item.title}`}><MoreHorizontal size={15}/></button></div>)}</div>
      <div className={styles.footer}><span>Showing 1–{visible.length} of 32 stories</span><div><button><ChevronLeft size={14}/></button><button className={styles.current}>1</button><button>2</button><button>3</button><span>…</span><button>6</button><button><ChevronRight size={14}/></button></div></div>
    </section><aside className={styles.rightRail}><section className={`${styles.sideCard} ${documentaryStyles.pipeline} ${refinementStyles.compactPipeline}`}><h2>Story Development</h2><div>{[["Ideas",8,"violet",100],["Outlining",6,"blue",72],["Scriptwriting",7,"teal",83],["Storyboarding",3,"orange",38],["Production",8,"deepblue",100],["Review",5,"purple",62]].map(([label,count,tone,width])=><p key={String(label)}><span>{label}</span><i><u className={storyStyles[String(tone)]} style={{width:`${width}%`}}/></i><b>{count}</b></p>)}</div></section>
      <section className={`${styles.sideCard} ${refinementStyles.compactAlerts}`}><h2>Narrative Alerts</h2><div className={styles.alerts}>{[["2 continuity conflicts","Characters and timeline","red"],["4 scripts need review","Oldest: 16 hours","orange"],["3 episodes due this week","View production plan","blue"]].map(([title,detail,tone])=><button key={title}><i className={styles[tone]}/><span><b>{title}</b><small>{detail}</small></span><ChevronRight size={15}/></button>)}</div></section>
      <section className={`${styles.sideCard} ${styles.brief}`}><h2><Sparkles size={16}/> AI Story Brief</h2><strong>Narrative opportunity</strong><p>Audience signals favour human-centred industrial stories. Strengthening the protagonist arc in two active scripts could improve predicted completion by 14%.</p><button>Review recommendation <ChevronRight size={14}/></button></section>
    </aside></div>
  </section>
}
function statusClass(status:string){if(status==="On track"||status==="Published")return styles.good;if(status==="Ready for production")return styles.review;if(status==="Continuity check")return storyStyles.continuity;if(status==="Needs development")return styles.risk;return storyStyles.inProduction}
