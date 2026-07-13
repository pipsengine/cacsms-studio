"use client";

import {
  ArrowRight, Bell, Bookmark, Bot, BriefcaseBusiness, CalendarDays, Check, ChevronDown,
  CircleHelp, CloudUpload, GraduationCap, Headphones, Info, Languages, Megaphone,
  Mic2, MonitorPlay, Paperclip, Search, Send, Share2, Sparkles, Subtitles, Target,
  Users, Video, WandSparkles
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { createProduction } from "@/lib/api/production-studio";
import styles from "./CreateProductionPage.module.css";

const templates = [
  { id: "documentary", name: "Documentary", description: "In-depth factual storytelling", duration: "15–45 min", icon: Video, image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=640&q=85" },
  { id: "teaching", name: "Teaching Content", description: "Educational and instructional", duration: "5–20 min", icon: GraduationCap, image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=640&q=85" },
  { id: "explainer", name: "Explainer Video", description: "Clear and engaging explanations", duration: "3–10 min", icon: MonitorPlay, image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=640&q=85" },
  { id: "tutorial", name: "Tutorial", description: "Step-by-step instructional", duration: "5–30 min", icon: Paperclip, image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=640&q=85" },
  { id: "corporate", name: "Corporate Content", description: "Business and professional", duration: "2–15 min", icon: BriefcaseBusiness, image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=640&q=85" },
  { id: "marketing", name: "Marketing Content", description: "Promotional and branded", duration: "1–5 min", icon: Megaphone, image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=85" },
  { id: "podcast", name: "Podcast", description: "Audio discussion content", duration: "20–60 min", icon: Mic2, image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=640&q=85" },
  { id: "social", name: "Social Content", description: "Short-form social media", duration: "15–60 sec", icon: Share2, image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=640&q=85" }
] as const;

const settingItems = [
  { key: "multiPlatformPublishing", label: "Multi-Platform Publishing", description: "Publish to all connected social platforms", icon: BriefcaseBusiness, tone: "blue" },
  { key: "aiVoiceover", label: "Enable AI Voiceover", description: "Generate professional voice narration", icon: Bot, tone: "purple" },
  { key: "autoThumbnails", label: "Auto-generate Thumbnails", description: "Create engaging thumbnails with AI", icon: WandSparkles, tone: "pink" },
  { key: "subtitles", label: "Generate Subtitles", description: "Auto-generate multi-language subtitles", icon: Subtitles, tone: "blue" },
  { key: "seoOptimization", label: "SEO Optimization", description: "Optimize for better discoverability", icon: Search, tone: "green" }
] as const;

export function CreateProductionPage() {
  const [templateId, setTemplateId] = useState("documentary");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("General Audience");
  const [language, setLanguage] = useState("English");
  const [goals, setGoals] = useState("");
  const [settings, setSettings] = useState({ multiPlatformPublishing: true, aiVoiceover: true, autoThumbnails: true, subtitles: true, seoOptimization: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = useMemo(() => templates.find((template) => template.id === templateId) ?? templates[0], [templateId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const result = await createProduction({ title, topic, contentType: selected.name, templateId, audience, language, goals, references: [], settings });
      setMessage(`Production ${result.id} was created as a draft.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create production."); }
    finally { setSaving(false); }
  }

  return <section className={styles.page}>
    <header className={styles.pageHeader}>
      <div className={styles.headingCopy}>
        <div className={styles.breadcrumb}><span>Home</span><i>/</i><span>Production Studio</span><i>/</i><strong>Create Production</strong></div>
        <h1>Create Production</h1>
        <p>Start a new AI-powered content production. Choose your content type, provide requirements and let the autonomous system handle the rest.</p>
      </div>
      <div className={styles.headerControls}>
        <button className={styles.contextControl}><span><small>Workspace</small><strong>CACSMS Studio</strong></span><ChevronDown size={14}/></button>
        <button className={styles.contextControl}><span><small>Brand</small><strong>CACSMS</strong></span><ChevronDown size={14}/></button>
        <button className={styles.dateControl}><strong>May 12 – Jun 11, 2025</strong><CalendarDays size={15}/></button>
        <button className={styles.iconButton} aria-label="Help"><CircleHelp size={16}/></button>
        <button className={styles.iconButton} aria-label="Support"><Headphones size={16}/></button>
        <button className={styles.iconButton + " " + styles.notification} aria-label="Notifications"><Bell size={16}/><em>12</em></button>
        <span className={styles.userAvatar}>AD<i/></span>
      </div>
    </header>

    <section className={styles.stepper}>
      {[["1","Content Setup","Define your production"],["2","Research & Planning","AI research and outline"],["3","Generation","Create with AI agents"],["4","Review & Approval","Quality check"],["5","Publish & Distribute","Go live everywhere"]].map(([number,label,detail], index) => <div className={`${styles.step} ${index === 0 ? styles.activeStep : ""}`} key={label}>
        <span className={styles.stepNumber}>{number}</span><span className={styles.stepCopy}><strong>{label}</strong><small>{detail}</small></span>{index < 4 ? <i className={styles.connector}/> : null}
      </div>)}
    </section>

    {error ? <div className={styles.error} role="alert">{error}</div> : null}
    {message ? <div className={styles.success}><Check size={14}/>{message}</div> : null}

    <form className={styles.workspaceGrid} onSubmit={submit}>
      <article className={styles.formCard}>
        <h2>Content Information</h2>
        <label className={styles.field}><span>Content Type <b>*</b></span><button type="button" className={styles.contentTypeButton}><span className={styles.fieldIcon}><selected.icon size={17}/></span><span><strong>{selected.name}</strong><small>{selected.description}</small></span><ChevronDown size={15}/></button></label>
        <label className={styles.field}><span>Title <b>*</b></span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter a compelling title for your content"/></label>
        <label className={styles.field}><span>Topic / Subject <b>*</b></span><textarea required className={styles.topicField} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Describe what you want to create..."/></label>
        <div className={styles.twoFields}>
          <label className={styles.field}><span>Target Audience</span><div className={styles.selectWrap}><Users size={15}/><select value={audience} onChange={(event) => setAudience(event.target.value)}><option>General Audience</option><option>Students</option><option>Professionals</option><option>Executives</option></select></div></label>
          <label className={styles.field}><span>Content Language</span><div className={styles.selectWrap}><Languages size={15}/><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>French</option><option>Spanish</option><option>Portuguese</option></select></div></label>
        </div>
        <label className={styles.field}><span>Goals & Objectives</span><textarea className={styles.goalsField} maxLength={500} value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="What do you want to achieve with this content?"/><small className={styles.counter}>{goals.length}/500</small></label>
        <label className={styles.field}><span>Reference Materials (Optional)</span><button className={styles.uploadArea} type="button"><CloudUpload size={27}/><strong>Drag & drop files here, or click to upload</strong><small>Supports: PDF, DOC, TXT, URLs, Images (Max 100MB)</small></button></label>
        <div className={styles.formActions}><button type="button" className={styles.draftButton}><Bookmark size={15}/>Save as Draft</button><button className={styles.nextButton} disabled={saving}>{saving ? "Creating..." : <>Next: Research & Planning<ArrowRight size={15}/></>}</button></div>
      </article>

      <article className={styles.templatePanel}>
        <div className={styles.panelHeading}><h2>Choose a Template</h2><button type="button">View All <ArrowRight size={14}/></button></div>
        <div className={styles.templateGrid}>{templates.map((template) => { const Icon=template.icon; return <button type="button" key={template.id} className={`${styles.templateCard} ${template.id === templateId ? styles.selectedTemplate : ""}`} onClick={() => setTemplateId(template.id)}>
          <img src={template.image} alt=""/><span className={styles.templateDetails}><span className={styles.templateIcon}><Icon size={15}/></span><span className={styles.templateText}><strong>{template.name}</strong><small>{template.description}</small></span><em>{template.duration}</em></span>
        </button>})}</div>
      </article>

      <aside className={styles.rightRail}>
        <article className={styles.assistantCard}><div className={styles.assistantTitle}><Sparkles size={24}/><h2>AI Production Assistant</h2></div><p>Get suggestions, optimize your idea and make your content better.</p>
          <div className={styles.suggestionList}><button type="button"><Sparkles size={15}/><span>Suggest trending topics</span><ChevronDown size={14}/></button><button type="button"><Target size={15}/><span>Improve my idea</span><ChevronDown size={14}/></button><button type="button"><Paperclip size={15}/><span>Generate outline preview</span><ChevronDown size={14}/></button></div>
          <div className={styles.askBox}><input placeholder="Ask anything about your content..."/><button type="button" aria-label="Send"><Send size={17}/></button></div>
        </article>
        <article className={styles.settingsCard}><h2>Production Settings</h2><div className={styles.settingsList}>{settingItems.map(({key,label,description,icon:Icon,tone}) => <div className={styles.settingRow} key={key}><span className={`${styles.settingIcon} ${styles[tone]}`}><Icon size={16}/></span><span className={styles.settingCopy}><strong>{label}</strong><small>{description}</small></span><button type="button" aria-label={label} className={`${styles.toggle} ${settings[key] ? styles.toggleOn : ""}`} onClick={() => setSettings((current) => ({...current,[key]:!current[key]}))}/></div>)}</div>
          <div className={styles.infoBox}><Info size={16}/><span>Your content will be processed by our autonomous AI agent team for research, creation and optimization.</span></div>
        </article>
      </aside>
    </form>
  </section>;
}
