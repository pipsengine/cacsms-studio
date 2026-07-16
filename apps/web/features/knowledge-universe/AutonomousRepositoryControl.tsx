"use client";

import {useCallback,useEffect,useState} from "react";
import {Activity,BrainCircuit,CheckCircle2,Clock3,DatabaseZap,Link2,ShieldCheck,Sparkles,TriangleAlert} from "lucide-react";
import styles from "./AutonomousRepositoryControl.module.css";

type Status={enabled:boolean;state:"running"|"healthy"|"paused"|"waiting"|"failed";algorithmVersion:string;intervalSeconds:number;lastRunAt:string|null;nextRunAt:string|null;thresholds:{verify:number;link:number;enrichment:number};lastRun:null|{status:string;scanned:number;created:number;updated:number;verified:number;flagged:number;links:number;averageConfidence:number;completedAt:string|null;error:string|null};recentDecisions:Array<{id:number;type:string;action:string;score:number;title:string|null;createdAt:string}>;};

export function AutonomousRepositoryControl(){
  const [status,setStatus]=useState<Status|null>(null);const [error,setError]=useState("");
  const load=useCallback(async()=>{try{const response=await fetch("/api/knowledge-universe/autonomy",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||"Autonomy telemetry is unavailable.");setStatus(body);setError("");}catch(reason){setError(reason instanceof Error?reason.message:"Autonomy telemetry is unavailable.");}},[]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),10_000);return()=>clearInterval(timer);},[load]);
  const last=status?.lastRun;
  return <section className={styles.panel} data-state={status?.state??"waiting"}>
    <header><div className={styles.identity}><i><BrainCircuit size={24}/></i><span><small>KNOWLEDGE AUTONOMY ENGINE</small><h2>Zero-Input Autonomous Evidence Operations</h2><p>Continuous ingestion, evidence fusion, semantic deduplication, verification, graph linking, and machine-owned lifecycle resolution.</p></span></div><div className={styles.actions}><b><span/>{status?.state??"connecting"}</b><b><BrainCircuit size={14}/>No operator input</b></div></header>
    {error?<div className={styles.error}><TriangleAlert size={15}/>{error}</div>:null}
    <div className={styles.grid}>
      <article><DatabaseZap size={18}/><span><small>Candidates scanned</small><strong>{last?.scanned??0}</strong><em>{(last?.created??0)+(last?.updated??0)} persisted</em></span></article>
      <article><ShieldCheck size={18}/><span><small>Auto-verified</small><strong>{last?.verified??0}</strong><em>Threshold {status?.thresholds.verify??"--"}%</em></span></article>
      <article><Link2 size={18}/><span><small>Semantic links</small><strong>{last?.links??0}</strong><em>Threshold {status?.thresholds.link??"--"}%</em></span></article>
      <article><Activity size={18}/><span><small>Mean confidence</small><strong>{last?.averageConfidence??0}%</strong><em>{last?.flagged??0} enriching autonomously</em></span></article>
      <article><Clock3 size={18}/><span><small>Next cycle</small><strong>{relative(status?.nextRunAt)}</strong><em>Continuous · every {status?.intervalSeconds??60}s</em></span></article>
    </div>
    <footer><span><Sparkles size={14}/><b>{status?.algorithmVersion??"Connecting to algorithm registry"}</b></span><div>{status?.recentDecisions.slice(0,3).map(decision=><span key={decision.id}><CheckCircle2 size={12}/>{decision.action} <b>{decision.score}%</b></span>)}</div></footer>
  </section>;
}

function relative(value:string|null|undefined){if(!value)return "Pending";const seconds=Math.round((new Date(value).getTime()-Date.now())/1000);if(seconds<=0)return "Due now";return `${seconds}s`;}
