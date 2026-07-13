"use client";

import {
  ArrowRight, BarChart3, Bell, BookOpen, CheckCircle2, ChevronDown, Database, Download,
  FileSpreadsheet, FileText, Filter, FolderOpen, Globe2, GraduationCap, HardDrive,
  Layers3, Lightbulb, MonitorPlay, Palette, Plus, RefreshCw, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, UsersRound
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import styles from "./LibraryAudiencePages.module.css";

type Tone = "orange" | "blue" | "green" | "amber" | "violet" | "teal";
type Metric = { label: string; value: string; note: string; tone: Tone; icon: ComponentType<{size?:number}> };

const studioCards = [
  ["Opportunity Intelligence", "20", Target, "blue"], ["Knowledge Base", "1.8M", Database, "teal"],
  ["Writing Studio", "19", Sparkles, "violet"], ["Story & Learning", "17", GraduationCap, "violet"],
  ["Storyboard Studio", "15", Palette, "amber"], ["Visual Studio", "20", MonitorPlay, "teal"]
] as const;

const sourceMetrics: Metric[] = [
  {label:"Library Sources",value:"4,862",note:"+534 from last quarter",tone:"orange",icon:Database},
  {label:"Research Papers",value:"1,284",note:"+86 this month",tone:"blue",icon:FileText},
  {label:"Industry Reports",value:"946",note:"+42 this month",tone:"green",icon:BookOpen},
  {label:"Need Review",value:"138",note:"+12 since last scan",tone:"amber",icon:ShieldCheck}
];
const sources = [
  {title:"The Future of Jobs Report 2025",type:"PDF",year:"2025",tags:["Institutional report","Economics"],status:"Approved",tone:"green",icon:FileText},
  {title:"Nigeria ICT Sector Statistics",type:"Dataset",year:"2024",tags:["Government","Data"],status:"Approved",tone:"green",icon:FileSpreadsheet},
  {title:"Smart Manufacturing Review",type:"Web article",year:"2025",tags:["Publication","Manufacturing"],status:"In Review",tone:"amber",icon:Globe2},
  {title:"Industry Week",type:"Web article",year:"2024",tags:["Publication","Industrial"],status:"Archived",tone:"blue",icon:Globe2}
];

const audienceMetrics: Metric[] = [
  {label:"Audience Segments",value:"12",note:"+3 from last quarter",tone:"violet",icon:Layers3},
  {label:"Estimated Reach",value:"2.8M",note:"Across 6 platforms",tone:"green",icon:Target},
  {label:"Intent Match",value:"74%",note:"+6% improvement",tone:"amber",icon:BarChart3},
  {label:"Questions Detected",value:"156",note:"+28 from last month",tone:"blue",icon:Lightbulb}
];
const segments = [
  {title:"Operations & Plant Managers",description:"Industrial decision-makers",intent:"87%",reach:"412K",status:"High purchase intent",tone:"green"},
  {title:"African Technology Professionals",description:"Career growth audience",intent:"92%",reach:"1.2M",status:"High learning intent",tone:"green"},
  {title:"Business Transformation Leaders",description:"Executive audience",intent:"78%",reach:"286K",status:"Strategic intent",tone:"amber"},
  {title:"Engineering Students",description:"Emerging professionals",intent:"84%",reach:"902K",status:"Education intent",tone:"green"}
];

function PageHeader({title,subtitle,action,onRefresh}:{title:string;subtitle:string;action:string;onRefresh:()=>void}) {
  const [refreshing,setRefreshing]=useState(false);
  function refresh(){setRefreshing(true);onRefresh();window.setTimeout(()=>setRefreshing(false),550)}
  return <><div className={styles.crumb}>Content Intelligence <span>/</span> {title}</div><header className={styles.header}><div><h1>{title}</h1><p>{subtitle}</p><small><RefreshCw size={11}/> Last intelligence update: <b>{refreshing?"just now":"8 minutes ago"}</b></small></div><div className={styles.actions}><button><Filter size={15}/>Filters</button><button><Download size={15}/>Export</button><button onClick={refresh}><RefreshCw className={refreshing?styles.spin:""} size={15}/>Refresh</button><button className={styles.primary}><Plus size={16}/>{action}</button></div></header></>;
}

function Metrics({items}:{items:Metric[]}) {return <section className={styles.metrics}>{items.map(({label,value,note,tone,icon:Icon},index)=><article data-tone={tone} key={label}><i><Icon size={25}/></i><span>{label}</span><strong>{value}{index===0?<em>↑ 12.4%</em>:null}</strong><small>{note}</small></article>)}</section>}
function StudioCards(){return <section className={styles.studioCards}>{studioCards.map(([label,value,Icon,tone])=><article data-tone={tone} key={label}><Icon size={17}/><strong>{value}</strong><span>{label}</span></article>)}</section>}
function PanelTitle({icon:Icon,title,action}:{icon:ComponentType<{size?:number}>;title:string;action:string}){return <div className={styles.panelTitle}><h2><Icon size={17}/>{title}</h2><button>{action}<ArrowRight size={13}/></button></div>}
function Brief({mode}:{mode:"library"|"audience"}){return <section className={`${styles.panel} ${styles.brief}`}><PanelTitle icon={Sparkles} title="AI Intelligence Brief" action="Generated from current signals"/><article><b>OPPORTUNITY DETECTED</b><p><strong>Industrial AI and agentic automation topics</strong> are showing strong demand growth with low content saturation. <strong>High opportunity window.</strong></p><small>Generated 8 minutes ago</small></article><footer><span>Review recommendation<b>{mode==="library"?"Trusted":"Proceed with content"}</b></span><button>Refresh</button></footer></section>}

export function SourceLibraryPage(){
  const [tab,setTab]=useState("All Sources"); const [query,setQuery]=useState(""); const [version,setVersion]=useState(0);
  const visible=useMemo(()=>sources.filter(item=>item.title.toLowerCase().includes(query.toLowerCase())&&(tab==="All Sources"||(tab==="Research Papers"&&item.type==="PDF")||(tab==="Reports"&&item.tags.includes("Institutional report"))||(tab==="Web Sources"&&item.type==="Web article"))),[query,tab,version]);
  return <section className={styles.page}><PageHeader title="Source Library" subtitle="Store, classify, search, and govern all research materials available to intelligence agents." action="Add Source" onRefresh={()=>setVersion(v=>v+1)}/><Metrics items={sourceMetrics}/><StudioCards/><div className={styles.workspace}><section className={styles.panel}><PanelTitle icon={FolderOpen} title="Source Collection" action="View all 4,862"/><div className={styles.tabs}>{[["All Sources","4,862"],["Research Papers","1,284"],["Reports","946"],["Web Sources","2,632"]].map(([label,count])=><button onClick={()=>setTab(label)} className={tab===label?styles.active:""} key={label}>{label}<b>{count}</b></button>)}</div><div className={styles.tools}><label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search source library..."/></label><button>All Types<ChevronDown size={13}/></button><button>Sort: Relevance<ChevronDown size={13}/></button></div><div className={styles.sourceList}>{visible.map(({title,type,year,tags,status,tone,icon:Icon})=><article key={title}><i><Icon size={18}/></i><div><h3>{title}</h3><p><span>{type}</span><span>{year}</span>{tags.map(tag=><em key={tag}>{tag}</em>)}</p></div><b data-tone={tone}><CheckCircle2 size={13}/>{status}</b></article>)}{visible.length===0?<div className={styles.empty}>No sources match the selected filters.</div>:null}</div><footer>Showing <b>{visible.length?1:0}</b> to <b>{visible.length}</b> of <b>4,862</b> entries</footer></section><aside><section className={styles.panel}><PanelTitle icon={HardDrive} title="Library Health" action="View configuration"/><div className={styles.health}><article><span>Storage used</span><b>18.4 GB / 50 GB</b><i><u/></i><small>37%</small></article><article><span>Duplicates detected</span><b>42 groups</b></article><article><span>Last integrity scan</span><b>2 hours ago</b></article><article><span>Status</span><b className={styles.good}><CheckCircle2 size={13}/>Trusted</b></article></div></section><Brief mode="library"/></aside></div><div className={styles.bottom}>Updated 13/07/2026, 3:24 PM</div></section>;
}

export function AudienceResearchPage(){
 const [tab,setTab]=useState("Segments");const [version,setVersion]=useState(0);
 return <section className={styles.page}><PageHeader title="Audience Research" subtitle="Build evidence-based audience segments from needs, behaviours, questions, and platform activity." action="New Audience Study" onRefresh={()=>setVersion(v=>v+1)}/><Metrics items={audienceMetrics}/><StudioCards/><div className={styles.workspace}><section className={styles.panel}><PanelTitle icon={UsersRound} title="Audience Segments" action="View all"/><div className={styles.tabs}>{[["Segments","12"],["Needs & Pain Points","24"],["Questions","156"],["Platform Behaviour","8"]].map(([label,count])=><button onClick={()=>setTab(label)} className={tab===label?styles.active:""} key={label}>{label}<b>{count}</b></button>)}</div><div className={styles.segmentList}>{segments.map(item=><article key={`${version}-${item.title}`}><i><UsersRound size={18}/></i><div><h3>{item.title}</h3><p>{item.description} · {item.reach} reach</p></div><dl><div><dt>{item.intent}</dt><dd>Intent</dd></div><div><dt>{item.reach}</dt><dd>Reach</dd></div></dl><b data-tone={item.tone}>{item.status}</b></article>)}</div><footer>Showing <b>1</b> to <b>4</b> of <b>12</b> audience segments · Active view: <b>{tab}</b></footer></section><aside><section className={styles.panel}><PanelTitle icon={SlidersHorizontal} title="Research Scope" action="View configuration"/><div className={styles.scope}><article><span>Core geography</span><b><Globe2 size={13}/>Nigeria + Africa</b></article><article><span>Age range</span><b><UsersRound size={13}/>24–54</b></article><article><span>Primary platforms</span><b><Layers3 size={13}/>YouTube, LinkedIn</b></article><article><span>Configuration</span><b>Standard<ChevronDown size={13}/></b></article></div></section><Brief mode="audience"/></aside></div><div className={styles.bottom}><Bell size={13}/> Intelligence monitoring active</div></section>;
}
