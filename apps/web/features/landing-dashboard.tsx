"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  BrainCircuit,
  Cable,
  Clapperboard,
  Cpu,
  Database,
  DollarSign,
  Pause,
  Play,
  RotateCcw,
  Send,
  Server,
  Sparkles,
  Square,
  Target,
  Zap
} from "lucide-react";

const opportunities = [
  ["98", "Quantum Computing in Africa", "Documentary / 16 min", "High", "Research"],
  ["94", "AI and the Future of Jobs", "Explainer / 8 min", "High", "Pre-Plan"],
  ["91", "Robotics in African Agriculture", "Documentary / 14 min", "High", "Research"],
  ["89", "The Truth About Artificial General Intelligence", "Explainer / 12 min", "Medium", "Pre-Plan"],
  ["87", "How AI is Changing African Startups", "Story / 10 min", "High", "Research"]
];

const outputs = [
  ["AI in Healthcare: Saving Lives", "18:24"],
  ["The Rise of Humanoid Robots", "12:45"],
  ["Understanding Machine Learning", "09:16"],
  ["Cybersecurity in 2025", "15:31"],
  ["Smart Factories of the Future", "14:02"]
];

type HealthPayload = {
  status: string;
  service: string;
  productionTypes: number;
  modules: number;
  pipelineStages: number;
};

const scheduleItems = [
  ["09:00 AM", "AI in Education: The Next Frontier", "Publishing"],
  ["02:00 PM", "The Future of Work with AI", "In Review"],
  ["05:00 PM", "Robotics in Manufacturing", "Scheduled"],
  ["07:30 PM", "AI Tools Every Student Should Know", "Scheduled"]
];

const insightItems = [
  ["High opportunity detected", "Quantum Computing in Africa", "98%"],
  ["Best time to publish today", "7:00 PM - 9:00 PM", "85%"],
  ["Audience interest rising", "AI in Healthcare", "+24%"],
  ["Content gap identified", "AI governance in Africa", "High Impact"]
];

const notifications = [
  ["New opportunity detected: AI in Agriculture", "5 min ago"],
  ["Render queue optimization completed", "12 min ago"],
  ["System update available", "1 hr ago"],
  ["Weekly performance report ready", "2 hrs ago"],
  ["Storage usage at 75%", "3 hrs ago"]
];

export function LandingDashboard() {
  const [running, setRunning] = useState(true);
  const [paused, setPaused] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: HealthPayload | null) => {
        if (!cancelled) setHealth(payload);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="landing-dashboard" aria-labelledby="dashboard-title">
      <header className="landing-topbar">
        <div>
          <h2 id="dashboard-title">Welcome back, Sarah!</h2>
          <p>Your autonomous studio is operating at peak performance.</p>
        </div>
        <div className="landing-actions">
          <Link className="landing-project" href="/productions/active-productions">
            Project: <b>The Future of AI</b>
          </Link>
          <Link className="landing-mode" href="/automation">
            <i /> Autonomous Mode <b>{running && !paused ? "ON" : paused ? "PAUSED" : "OFF"}</b>
          </Link>
          <Link className="landing-icon-btn" aria-label="Notifications" href="/dashboard/notifications">
            <Bell size={18} />
            <em>{notifications.length}</em>
          </Link>
          <Link className="landing-assistant" href="/agents">
            <Sparkles size={17} /> AI Assistant
          </Link>
        </div>
      </header>

      <section className="landing-ops landing-card">
        <strong>AUTONOMOUS OPERATIONS CONTROL</strong>
        <div className="landing-ops-grid">
          <label className="landing-select"><small>Autonomy Mode</small><select><option>Fully Autonomous</option><option>Supervised Autonomous</option><option>Assisted</option></select></label>
          <button className="landing-start" type="button" disabled={running && !paused} onClick={() => { setRunning(true); setPaused(false); }}><Play size={18} fill="currentColor" /> Start All</button>
          <button className="landing-stop" type="button" disabled={!running} onClick={() => { setRunning(false); setPaused(false); }}><Square size={17} fill="currentColor" /> Stop All</button>
          <button className="landing-minor" type="button" disabled={!running || paused} onClick={() => setPaused(true)}><Pause size={18} />Pause</button>
          <button className="landing-minor" type="button" disabled={running && !paused} onClick={() => { setRunning(true); setPaused(false); }}><RotateCcw size={18} />Resume</button>
          <div className="landing-switch"><small>Auto-Advance</small><span>ON</span></div>
          <div className="landing-switch"><small>Approvals</small><span>ON</span></div>
          <OpsStat label="Budget (Today)" value="$3,450.00" sub="75% of daily limit" width="75%" />
          <OpsStat label="Active Workers" value="12 / 12" sub="100% Utilization" width="100%" />
          <OpsStat label="Queue Status" value="32 Jobs" sub="8 Rendering" width="42%" purple />
        </div>
        <div className={`landing-runtime ${running ? "running" : "stopped"}`} role="status" aria-live="polite">
          {running ? (paused ? "Pipeline paused safely" : "Autonomous studio is running") : "Autonomous studio is stopped"}
        </div>
      </section>

      <section className="landing-metrics">
        <Metric icon={Activity} label="System Health" value="92%" sub="Excellent" />
        <Metric icon={Target} label="Opportunities Discovered" value="342" sub="+28 since yesterday" color="purple" />
        <Metric icon={Clapperboard} label="Active Productions" value="10" sub="3 Rendering" color="orange" />
        <Metric icon={Send} label="Publishing Today" value="4" sub="Across 3 Channels" color="blue" />
        <Metric icon={BrainCircuit} label="AI Confidence" value="98%" sub="Very High" />
        <Metric icon={DollarSign} label="Monthly ROI" value="320%" sub="+28% vs last month" color="pink" />
      </section>

      <section className="landing-grid">
        <article className="landing-card landing-span-3">
          <CardHead title="LIVE PRODUCTION OVERVIEW" action="View all" href="/productions/active-productions" />
          <div className="landing-production">
            <div className="landing-poster" />
            <div>
              <h3>The AI Revolution in Healthcare</h3>
              <p>Documentary / 18 min / 70% Complete</p>
              <Progress width="70%" />
            </div>
          </div>
          <div className="landing-mini-stats">
            <span><b>36 / 52</b>Scenes</span><span><b>252</b>Assets</span><span><b>Today, 3:45 PM</b>Est. Completion</span><span><b>$6.40 / $20.00</b>Budget Used</span>
          </div>
          <h4>Current Tasks</h4>
          <ul className="landing-tasks">
            <Task color="green" text="Generating voiceover (Section 4)" value="90%" />
            <Task color="purple" text="Rendering scene 18/32" value="60%" />
            <Task color="orange" text="Creating motion graphics" value="Completed" />
            <Task color="blue" text="AI QA pre-check" value="Pending" />
          </ul>
          <Link className="landing-link-btn" href="/productions/active-productions">Open Production Workspace <ArrowRight size={15} /></Link>
        </article>

        <article className="landing-card landing-span-3">
          <CardHead title="TODAY'S SCHEDULE" action="View Full Calendar" href="/dashboard/calendar" />
          <div className="landing-schedule">
            {scheduleItems.map((item) => <ScheduleRow key={item.join("-")} item={item} />)}
          </div>
        </article>

        <article className="landing-card landing-span-3">
          <CardHead title="AI INSIGHTS" action="View All Insights" href="/analytics" />
          <div className="landing-insights">
            {insightItems.map((item, index) => <Insight key={item[0]} item={item} index={index} />)}
          </div>
        </article>

        <article className="landing-card landing-span-3">
          <CardHead title="SYSTEM STATUS" action="View Details" href="/dashboard/system-health" />
          <div className="landing-systems">
            {[
              [Cpu, "AI Services", "Operational"],
              [Server, "Render Workers", "12 / 12 Active"],
              [Database, "Storage", "Healthy"],
              [Database, "Database", "Healthy"],
              [Cable, "Integrations", "Connected"],
              [Zap, "API Gateway", health?.status === "ok" ? "Operational" : "Checking"]
            ].map(([Icon, label, value]) => (
              <div key={String(label)}><Icon size={15} /><span>{String(label)}</span><b>{String(value)}</b></div>
            ))}
            <footer><span>System Uptime</span><strong>99.98%</strong></footer>
          </div>
        </article>

        <article className="landing-card landing-span-3">
          <CardHead title="TOP OPPORTUNITIES" action="View All" href="/opportunity-intelligence/opportunity-portfolio" />
          <div className="landing-opps">
            {opportunities.map((item) => (
              <div key={item[1]}>
                <strong>{item[0]}</strong><span><b>{item[1]}</b><small>{item[2]}</small></span><em>{item[3]}</em><i>{item[4]}</i>
              </div>
            ))}
          </div>
        </article>

        <article className="landing-card landing-span-6">
          <CardHead title="RECENT OUTPUTS" action="View All" href="/exports/export-history" />
          <div className="landing-outputs">
            {outputs.map((item, index) => (
              <div key={item[0]}>
                <div className={`landing-thumb t${index}`}><Play size={21} fill="white" /><span>{item[1]}</span></div>
                <b>{item[0]}</b><small>Published</small><p>{[2.1, 3.8, 5.2, 1.7, 2.9][index]}K views</p>
              </div>
            ))}
          </div>
        </article>

        <article className="landing-card landing-span-3">
          <CardHead title="NOTIFICATIONS" action="View All" href="/dashboard/notifications" />
          <div className="landing-notes">
            {notifications.map(([note, time], index) => (
              <div key={note}><i className={`d${index % 4}`} /><span>{note}</span><time>{time}</time></div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}

function OpsStat({ label, value, sub, width, purple }: { label: string; value: string; sub: string; width: string; purple?: boolean }) {
  return <div className="landing-ops-stat"><small>{label}</small><strong>{value}</strong><span>{sub}</span><b className={purple ? "purple" : ""} style={{ width }} /></div>;
}

function Metric({ icon: Icon, label, value, sub, color = "green" }: { icon: typeof Activity; label: string; value: string; sub: string; color?: string }) {
  return <article className="landing-metric landing-card"><div className={`landing-metric-icon ${color}`}><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div><div className={`landing-spark ${color}`} /></article>;
}

function CardHead({ title, action, href }: { title: string; action: string; href: string }) {
  return <div className="landing-card-head"><b>{title}</b><Link href={href}>{action} <ArrowRight size={12} /></Link></div>;
}

function Progress({ width }: { width: string }) {
  return <div className="landing-progress"><i style={{ width }} /></div>;
}

function Task({ color, text, value }: { color: string; text: string; value: string }) {
  return <li><i className={color} />{text}<b>{value}</b></li>;
}

function ScheduleRow({ item }: { item: string[] }) {
  return <div><time>{item[0]}</time><span><b>{item[1]}</b><small>{item[2] === "Publishing" ? "Publishing to YouTube" : "Scheduled"}</small></span><em className={item[2].replace(" ", "").toLowerCase()}>{item[2]}</em></div>;
}

function Insight({ item, index }: { item: string[]; index: number }) {
  return <div><span className={`dot d${index}`} /><p><b>{item[0]}</b><small>{item[1]}</small></p><em>{item[2]}</em></div>;
}
