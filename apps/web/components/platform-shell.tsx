"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type React from "react";
import { usePathname } from "next/navigation";
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
  Search,
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
  const pathname = usePathname();
  const activeModule = navigationModules.find((module) => pathname === `/${module.slug}` || pathname.startsWith(`/${module.slug}/`));
  const [openModule, setOpenModule] = useState(activeModule?.slug ?? "dashboard");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleModules = useMemo(() => {
    if (!normalizedQuery) return navigationModules;

    return navigationModules.filter((module) =>
      `${module.label} ${module.children.map((child) => child.label).join(" ")}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Studio navigation">
        <div className="sidebar-sticky">
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">CA</span>
            <span>
              <span className="brand-title">CACSMS Autonomous Media Studio</span>
              <span className="brand-subtitle">Autonomous production console</span>
            </span>
          </Link>

          <div className="sidebar-kicker">
            <span>Studio Map</span>
            <span className="live-dot">Live</span>
          </div>

          <div className="sidebar-tools">
            <label className="sidebar-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search studio modules"
                aria-label="Search studio modules"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="sidebar-actions">
              <Link className="sidebar-action primary" href="/productions/create">
                Create
              </Link>
              <Link className="sidebar-action" href="/api/health">
                Health
              </Link>
            </div>
          </div>

          <div className="sidebar-stats">
            <span>
              <strong>20</strong>
              Types
            </span>
            <span>
              <strong>22</strong>
              Modules
            </span>
            <span>
              <strong>10</strong>
              Stages
            </span>
          </div>
        </div>

        <div className="nav-label">
          <span>Navigation</span>
          <span>{navigationModules.length} modules</span>
        </div>

        <nav className="sidebar-nav">
          {visibleModules.map((module) => {
            const sourceIndex = navigationModules.findIndex((item) => item.slug === module.slug);
            const Icon = icons[sourceIndex] ?? Boxes;
            const isOpen = Boolean(normalizedQuery) || openModule === module.slug;
            return (
              <details
                className="nav-section"
                key={module.slug}
                open={isOpen}
                onToggle={(event) => {
                  if (normalizedQuery) return;
                  if (event.currentTarget.open) setOpenModule(module.slug);
                }}
              >
                <summary className="nav-link">
                  <span className="nav-icon">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <Link href={`/${module.slug}`}>{module.label}</Link>
                  <span className="nav-count">{module.children.length}</span>
                </summary>
                <div className="nav-children">
                  {module.children.map((child) => (
                    <Link
                      className="nav-child"
                      href={module.slug === "productions" && child.slug === "create-production" ? "/productions/create" : `/${module.slug}/${child.slug}`}
                      key={child.slug}
                      aria-current={isActiveChild(module.slug, child.slug, pathname) ? "page" : undefined}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </nav>
        {visibleModules.length === 0 ? <div className="sidebar-empty">No matching studio module found.</div> : null}
        <div className="sidebar-footer">IIS 3008 to Node 3018. CACSMS Studio runtime.</div>
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

function isActiveChild(moduleSlug: string, childSlug: string, pathname: string) {
  if (moduleSlug === "productions" && childSlug === "create-production") {
    return pathname === "/productions/create";
  }

  return pathname === `/${moduleSlug}/${childSlug}`;
}
