"use client";

import {
  BadgeCheck, BookOpen, Boxes, BrainCircuit, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Clapperboard, Download, Factory, FileCheck2, Filter, GraduationCap,
  Grid2X2, LayoutList, Lightbulb, MapPinned, MoreHorizontal, PenLine, RefreshCw,
  Rocket, Search, Sparkles, Target, UsersRound
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import styles from "./AllProductionsPage.module.css";
import documentaryStyles from "./DocumentariesPage.module.css";
import refinementStyles from "./DocumentariesRefinements.module.css";
import teachingStyles from "./TeachingContentPage.module.css";

type LearningItem={title:string;format:string;stage:string;owner:string;initials:string;alignment:number;progress:number;status:string;updated:string;tone:string;icon:ComponentType<{size?:number}>};
const metrics=[
  {value:"46",label:"Active Learning Assets",detail:"+8 this month",tone:"purple",icon:GraduationCap},
  {value:"14",label:"In Design",detail:"38 objectives mapped",tone:"blue",icon:PenLine},
  {value:"12",label:"In Production",detail:"6 video · 6 interactive",tone:"teal",icon:Clapperboard},
  {value:"7",label:"In Review",detail:"3 SME approvals due",tone:"orange",icon:UsersRound},
  {value:"29",label:"Published",detail:"91% completion rate",tone:"green",icon:Rocket},
  {value:"94%",label:"Curriculum Alignment",detail:"+5% this quarter",tone:"indigo",icon:Target}
] as const;
const tabs=[{label:"All Learning Content",icon:Grid2X2},{label:"Curriculum",icon:BookOpen},{label:"Lesson Design",icon:PenLine},{label:"Content Creation",icon:Clapperboard},{label:"Assessment",icon:FileCheck2},{label:"Quality Review",icon:Search},{label:"Published",icon:Rocket}];
const items:LearningItem[]=[
  {title:"AI Fundamentals for Business Leaders",format:"Video Lesson · 18 min",stage:"Content Creation",owner:"Teaching Agent",initials:"TA",alignment:96,progress:74,status:"On track",updated:"16 min ago",tone:"teal",icon:BrainCircuit},
  {title:"Understanding Smart Factories",format:"Interactive Lesson",stage:"Quality Review",owner:"Sarah A.",initials:"SA",alignment:92,progress:88,status:"SME review",updated:"41 min ago",tone:"violet",icon:Factory},
  {title:"Industrial Automation Essentials",format:"Microlearning · 6 units",stage:"Lesson Design",owner:"Curriculum Agent",initials:"CA",alignment:89,progress:46,status:"Objectives mapped",updated:"1 hr ago",tone:"blue",icon:Boxes},
  {title:"Digital Twins in Practice",format:"Workshop · 45 min",stage:"Assessment",owner:"Assessment Agent",initials:"AA",alignment:94,progress:82,status:"Assessment check",updated:"2 hrs ago",tone:"orange",icon:GraduationCap},
  {title:"Responsible AI Operations",format:"Explainer Lesson · 12 min",stage:"Curriculum",owner:"Teaching Agent",initials:"TA",alignment:81,progress:32,status:"Needs references",updated:"4 hrs ago",tone:"blue",icon:BadgeCheck},
  {title:"Future Skills for African Industry",format:"Learning Series · 5 parts",stage:"Published",owner:"Publishing Agent",initials:"PA",alignment:98,progress:100,status:"Published",updated:"Yesterday",tone:"green",icon:MapPinned}
];

export function TeachingContentPage(){
  const [activeTab,setActiveTab]=useState("All Learning Content");const [query,setQuery]=useState("");const [refreshing,setRefreshing]=useState(false);
  const visible=useMemo(()=>items.filter(item=>`${item.title} ${item.owner} ${item.format}`.toLowerCase().includes(query.toLowerCase())&&(activeTab==="All Learning Content"||item.stage===activeTab)),[activeTab,query]);
  function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),500)}
  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Production Studio <span>/</span> Teaching Content</div><h1>Teaching Content</h1><p>Create structured learning experiences, lessons, and educational media.</p></div><div className={styles.headerActions}><button className={styles.workspace}>Workspace · CACSMS Studio</button><button className={styles.refresh} onClick={refresh}><RefreshCw size={15} className={refreshing?styles.spin:""}/>{refreshing?"Refreshing":"Refresh"}</button><Link className={styles.create} href="/production-studio/create-production">Create Teaching Content</Link></div></header>
    <div className={styles.navRow}><div className={`${styles.tabs} ${teachingStyles.teachingTabs}`}>{tabs.map(({label,icon:Icon})=><button className={activeTab===label?styles.activeTab:""} onClick={()=>setActiveTab(label)} key={label}><Icon size={16}/>{label}</button>)}</div><button className={styles.period}>Last 90 days<ChevronDown size={14}/></button></div>
    <section className={styles.metrics}>{metrics.map(({value,label,detail,tone,icon:Icon})=><article key={label}><span className={`${styles.metricIcon} ${refinementStyles.docMetricIcon}`} data-tone={tone}><Icon size={25}/></span><span><strong>{value}</strong><b>{label}</b><small>{detail}</small></span></article>)}</section>
    <div className={styles.contentGrid}><section className={styles.portfolio}><div className={styles.panelHead}><div><h2>Learning Content Portfolio</h2><p>Track learning objectives, instructional stages, owners, assessments, and publication readiness.</p></div><span>46 learning assets</span><span className={teachingStyles.wcag}><BadgeCheck size={15}/><small>WCAG learning checks<br/><b>93% passed</b></small></span><button><Download size={15}/>Export</button><button aria-label="More options"><MoreHorizontal size={16}/></button></div>
      <div className={styles.tools}><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search lessons, subjects, objectives, or owners..."/></label><button><Filter size={15}/>Filter <b>3</b></button><button className={styles.sort}>Sort: Recently updated<ChevronDown size={14}/></button><div className={styles.grow}/><span className={styles.viewToggle}><button className={styles.selectedView}><LayoutList size={16}/></button><button><Grid2X2 size={16}/></button></span></div>
      <div className={styles.table}><div className={`${styles.row} ${styles.tableHead} ${documentaryStyles.docRow}`}><span>LEARNING CONTENT</span><span>FORMAT</span><span>DESIGN STAGE</span><span>OWNER</span><span>ALIGNMENT</span><span>PROGRESS</span><span>STATUS</span><span>UPDATED</span><span/></div>{visible.map(item=>{const Icon=item.icon;return <div className={`${styles.row} ${documentaryStyles.docRow}`} key={item.title}><span className={teachingStyles.learningItem}><i className={teachingStyles[item.tone]}><Icon size={19}/></i><b>{item.title}</b></span><span>{item.format}</span><span><em className={documentaryStyles.stageBadge} data-tone={item.tone}>{item.stage}</em></span><span className={documentaryStyles.docOwner}><i className={teachingStyles.ownerAvatar}>{item.initials}</i>{item.owner}</span><span className={teachingStyles.alignment}><Target size={15}/><b>{item.alignment}%</b></span><span className={styles.progress}><b>{item.progress}%</b><i><u style={{width:`${item.progress}%`}}/></i></span><span><em className={statusClass(item.status)}>{item.status}</em></span><span>{item.updated}</span><button aria-label={`Actions for ${item.title}`}><MoreHorizontal size={15}/></button></div>})}</div>
      <div className={styles.footer}><span>Showing 1–{visible.length} of 46 learning assets</span><div><button><ChevronLeft size={14}/></button><button className={styles.current}>1</button><button>2</button><button>3</button><button>4</button><button>5</button><button><ChevronRight size={14}/></button></div></div>
    </section><aside className={styles.rightRail}><section className={`${styles.sideCard} ${documentaryStyles.pipeline} ${refinementStyles.compactPipeline}`}><h2>Learning Production Stages</h2><div>{[["Curriculum",8,"blue",55],["Lesson Design",14,"violet",92],["Content Creation",12,"teal",75],["Assessment",5,"orange",38],["Quality Review",7,"indigo",55]].map(([label,count,tone,width])=><p key={String(label)}><span>{label}</span><i><u className={teachingStyles[String(tone)]} style={{width:`${width}%`}}/></i><b>{count}</b></p>)}</div></section>
      <section className={`${styles.sideCard} ${refinementStyles.compactAlerts}`}><h2>Instructional Alerts</h2><div className={styles.alerts}>{[["3 SME reviews overdue","Oldest: 19 hours","red"],["4 lessons need assessments","Missing knowledge checks","orange"],["6 assets due this week","View learning schedule","blue"]].map(([title,detail,tone])=><button key={title}><i className={styles[tone]}/><span><b>{title}</b><small>{detail}</small></span><ChevronRight size={15}/></button>)}</div></section>
      <section className={`${styles.sideCard} ${styles.brief}`}><h2><Sparkles size={16}/> AI Teaching Brief</h2><strong>Learning opportunity</strong><p>Learners are completing interactive lessons 23% more often than standard videos. Converting two active topics into guided practice could improve mastery.</p><button>Review recommendation <ChevronRight size={14}/></button></section>
    </aside></div>
  </section>
}
function statusClass(status:string){if(status==="On track"||status==="Published")return styles.good;if(status==="Objectives mapped")return styles.review;if(status==="Needs references")return styles.risk;if(status==="SME review"||status==="Assessment check")return teachingStyles.assessment;return styles.scheduled}
