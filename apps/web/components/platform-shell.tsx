import Link from "next/link";
import type React from "react";
import {
  Activity,
  Bot,
  Boxes,
  CalendarClock,
  Clapperboard,
  FileText,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  Library,
  Megaphone,
  Mic2,
  Network,
  PenLine,
  PlaySquare,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2
} from "lucide-react";
import { navigationModules } from "@cacsms/contracts";

const icons = [
  LayoutDashboard,
  Clapperboard,
  Sparkles,
  PenLine,
  Network,
  FileText,
  Wand2,
  PlaySquare,
  Mic2,
  CalendarClock,
  ShieldCheck,
  FolderOpen,
  Radio,
  Library,
  Boxes,
  Bot,
  Activity,
  Gauge,
  Users,
  Network,
  Settings,
  Settings
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Studio navigation">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">CA</span>
          <span>
            <span className="brand-title">CACSMS Autonomous Media Studio</span>
            <span className="brand-subtitle">Complete multimedia production</span>
          </span>
        </Link>

        <nav>
          {navigationModules.map((module, index) => {
            const Icon = icons[index] ?? Boxes;
            return (
              <section className="nav-section" key={module.slug}>
                <Link className="nav-link" href={`/${module.slug}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{module.label}</span>
                </Link>
                <div className="nav-children">
                  {module.children.slice(0, module.slug === "agents" ? 10 : 7).map((child) => (
                    <Link
                      className="nav-child"
                      href={module.slug === "productions" && child.slug === "create-production" ? "/productions/create" : `/${module.slug}/${child.slug}`}
                      key={child.slug}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <h1>CACSMS Autonomous Media Studio</h1>
            <div className="muted">Topic to script, scenes, visuals, audio, timeline, QA, export, and publishing.</div>
          </div>
          <div className="topbar-actions">
            <Link className="button" href="/quality">
              <ShieldCheck size={16} aria-hidden="true" />
              QA
            </Link>
            <Link className="button primary" href="/productions/create">
              <Clapperboard size={16} aria-hidden="true" />
              Create
            </Link>
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
