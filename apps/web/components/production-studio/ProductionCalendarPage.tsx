"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./ProductionCalendarPage.module.css";

type CalendarEvent={date:string;title:string;type:"shoot"|"review"|"milestone"|"recording"|"deadline"|"publish";time:string};
const events:CalendarEvent[]=[
  {date:"2026-07-06",title:"AI Documentary – Shoot Day 1",type:"shoot",time:"9:00 AM"},
  {date:"2026-07-07",title:"Marketing Campaign – Review",type:"review",time:"2:00 PM"},
  {date:"2026-07-08",title:"Podcast Recording – Ep. 5",type:"recording",time:"11:00 AM"},
  {date:"2026-07-10",title:"Tutorial – Final Draft Due",type:"deadline",time:"5:00 PM"},
  {date:"2026-07-13",title:"Documentary – Research Complete",type:"milestone",time:"12:00 PM"},
  {date:"2026-07-15",title:"Social Content – Monthly Calendar Review",type:"review",time:"10:00 AM"},
  {date:"2026-07-16",title:"Custom Production – Client Presentation",type:"milestone",time:"3:00 PM"},
  {date:"2026-07-17",title:"Marketing Campaign – Launch",type:"deadline",time:"9:00 AM"},
  {date:"2026-07-20",title:"Documentary – Interview Shoot",type:"shoot",time:"8:30 AM"},
  {date:"2026-07-22",title:"Podcast – Audio Mix Review",type:"review",time:"1:00 PM"},
  {date:"2026-07-24",title:"Tutorial – Video Editing Complete",type:"deadline",time:"4:00 PM"},
  {date:"2026-07-27",title:"AI Documentary – Post-Production Start",type:"milestone",time:"10:00 AM"},
  {date:"2026-07-29",title:"Content Batch – Publishing",type:"publish",time:"8:00 AM"},
  {date:"2026-07-31",title:"Q3 Review – All Productions",type:"deadline",time:"6:00 PM"}
];
const typeLabels={shoot:"Shoot",review:"Review",milestone:"Milestone",recording:"Recording",deadline:"Deadline",publish:"Publish"};

export function ProductionCalendarPage(){
  const [month,setMonth]=useState(()=>new Date(2026,6,1));
  const [type,setType]=useState<"all"|CalendarEvent["type"]>("all");
  const [refreshing,setRefreshing]=useState(false);
  const cells=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();return [...Array(first.getDay()).fill(null),...Array.from({length:count},(_,i)=>i+1)]},[month]);
  const visibleEvents=events.filter(event=>type==="all"||event.type===type);
  const monthKey=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,"0")}`;
  const monthEvents=visibleEvents.filter(event=>event.date.startsWith(monthKey));
  function move(delta:number){setMonth(new Date(month.getFullYear(),month.getMonth()+delta,1))}
  function refresh(){setRefreshing(true);window.setTimeout(()=>setRefreshing(false),450)}
  return <section className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Production Studio <span>/</span> Production Calendar</div><h1>Production Calendar</h1><p>Coordinate shoots, recordings, reviews, milestones, deadlines, and publishing schedules.</p></div><div className={styles.actions}><span className={styles.autonomousBadge}>● Autonomous · every 30s</span></div></header>
    <section className={styles.toolbar}><div className={styles.monthNav}><strong>{month.toLocaleString("en-US",{month:"long",year:"numeric"})}</strong></div><span className={styles.autoNote}>Events are routed automatically from production readiness and publishing cadence.</span></section>
    <div className={styles.layout}><section className={styles.calendarCard}><div className={styles.week}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><strong key={day}>{day}</strong>)}</div><div className={styles.grid}>{cells.map((day,index)=>{const date=day?`${monthKey}-${String(day).padStart(2,"0")}`:"";const dayEvents=monthEvents.filter(event=>event.date===date);return <article className={!day?styles.blank:day===13&&monthKey==="2026-07"?styles.today:""} key={`${monthKey}-${index}`}><b>{day}</b>{dayEvents.slice(0,3).map(event=><button data-tone={event.type} key={event.title} title={`${event.title} at ${event.time}`}><span>{event.time}</span>{event.title}</button>)}</article>})}</div></section>
      <aside><section className={styles.sideCard}><h2><CalendarDays size={18}/>Upcoming Events <span>{monthEvents.length}</span></h2><div className={styles.upcoming}>{monthEvents.slice(0,6).map(event=><button key={event.title}><i data-tone={event.type}>{Number(event.date.slice(-2))}</i><span><b>{event.title}</b><small><Clock3 size={12}/>{event.time} · {typeLabels[event.type]}</small></span><ChevronRight size={15}/></button>)}</div></section><section className={styles.legend}><h2>Calendar Legend</h2>{Object.entries(typeLabels).map(([value,label])=><span key={value}><i data-tone={value}/>{label}</span>)}</section></aside>
    </div>
  </section>
}
