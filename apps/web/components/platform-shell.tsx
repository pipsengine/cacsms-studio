"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Power,
  Settings
} from "lucide-react";
import { navigationModuleGroups, navigationModules } from "@cacsms/contracts";
import { getNavigationIcon } from "@/lib/navigation-icons";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [systemRunning, setSystemRunning] = useState(true);
  const activeModule =
    (pathname.startsWith("/home/") ? navigationModules.find((module) => module.slug === "dashboard") : undefined) ??
    (pathname.startsWith("/production-studio") ? navigationModules.find((module) => module.slug === "productions") : undefined) ??
    (pathname.startsWith("/content-intelligence") ? navigationModules.find((module) => module.slug === "intelligence") : undefined) ??
    (pathname.startsWith("/opportunity-intelligence") ? navigationModules.find((module) => module.slug === "opportunity-intelligence") : undefined) ??
    (pathname.startsWith("/knowledge-universe") ? navigationModules.find((module) => module.slug === "knowledge-universe") : undefined) ??
    (pathname.startsWith("/production-workflow") ? navigationModules.find((module) => module.slug === "dashboard") : undefined) ??
    navigationModules.find((module) => pathname === `/${module.slug}` || pathname.startsWith(`/${module.slug}/`)) ??
    navigationModules.find((module) => module.slug === "dashboard");
  const [openModule, setOpenModule] = useState<string | null>(activeModule?.slug ?? "dashboard");
  const hideWorkspaceHeader =
    pathname.startsWith("/writing/script-editor") ||
    pathname.startsWith("/visuals/image-generator") ||
    pathname.startsWith("/storyboard/storyboard-editor") ||
    pathname.startsWith("/video/scene-video-generator") ||
    pathname.startsWith("/audio/narration-generator") ||
    pathname.startsWith("/audio/music-generator");
  const [collapsed, setCollapsed] = useState(false);
  const dashboardRoute =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/home/") ||
    pathname.startsWith("/production-studio") ||
    pathname.startsWith("/content-intelligence") ||
    pathname.startsWith("/opportunity-intelligence") ||
    pathname.startsWith("/knowledge-universe") ||
    pathname.startsWith("/production-workflow") ||
    pathname.startsWith("/coming-soon");
  const groupedModules = useMemo(
    () =>
      navigationModuleGroups.map((group) => ({
        ...group,
        modules: group.slugs
          .map((slug) => navigationModules.find((module) => module.slug === slug))
          .filter((module): module is (typeof navigationModules)[number] => Boolean(module))
      })),
    []
  );

  useEffect(() => {
    setOpenModule(activeModule?.slug ?? "dashboard");
  }, [activeModule?.slug]);

  useEffect(() => {
    const stored = window.localStorage.getItem("cacsms-system-running");
    if (stored === "false") setSystemRunning(false);
    if (stored === "true") setSystemRunning(true);
  }, []);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "include" }).catch(() => undefined);
  }, []);

  function toggleSystem() {
    setSystemRunning((current) => {
      const next = !current;
      window.localStorage.setItem("cacsms-system-running", String(next));
      return next;
    });
  }

  const nigeriaTime = now
    ? new Intl.DateTimeFormat("en-NG", {timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit"}).format(now)
    : "--:--:--";
  const nigeriaDate = now
    ? new Intl.DateTimeFormat("en-NG", {timeZone: "Africa/Lagos", weekday: "long", day: "2-digit", month: "long", year: "numeric"}).format(now)
    : "Loading Nigeria local date";

  return (
    <div className={`shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Studio navigation">
        <div className="brand-row">
          <Link className="brand" href="/dashboard" prefetch={false} aria-label="CACSMS dashboard">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="brand-copy">
              <strong>CACSMS</strong>
              <small>Autonomous Media Studio</small>
            </span>
          </Link>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav className="sidebar-scroll" aria-label="CACSMS modules">
          {groupedModules.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.modules.map((module) => {
                const Icon = getNavigationIcon(module.slug);
                const isActive = activeModule?.slug === module.slug;
                const isOpen = openModule === module.slug;
                return (
                  <details
                    className="pipeline-nav-group"
                    key={module.slug}
                    open={isOpen}
                    onToggle={(event) => {
                      setOpenModule(event.currentTarget.open ? module.slug : null);
                    }}
                  >
                    <summary className={`nav-item${isActive ? " active" : ""}`}>
                      <Icon size={16} aria-hidden="true" />
                      <Link href={hrefForModule(module.slug)} prefetch={false}>
                        {module.label}
                      </Link>
                      <span className="nav-badge">{formatCount(module.children.length, module.slug)}</span>
                      {isOpen ? <ChevronDown className="nav-chevron" aria-hidden="true" /> : <ChevronRight className="nav-chevron" aria-hidden="true" />}
                    </summary>
                    <div className="pipeline-subnav">
                      {module.children.map((child) => (
                        <Link
                          href={hrefForChild(module.slug, child.slug)}
                          key={child.slug}
                          prefetch={false}
                          aria-current={isActiveChild(module.slug, child.slug, pathname) ? "page" : undefined}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar">SA</span>
          <span className="profile-copy">
            <strong>Sarah A.</strong>
            <small>Administrator</small>
          </span>
          <Settings size={17} aria-hidden="true" />
        </div>
      </aside>

      <div className="content">
        <header className="system-topbar" aria-label="System status bar">
          <div className="system-clock">
            <CalendarClock size={17} aria-hidden="true" />
            <span>
              <strong>{nigeriaTime}</strong>
              <small>{nigeriaDate}</small>
            </span>
          </div>
          <div className="system-controls">
            <button className={`system-toggle${systemRunning ? " running" : " stopped"}`} type="button" onClick={toggleSystem}>
              <Power size={16} aria-hidden="true" />
              {systemRunning ? "Stop" : "Start"}
            </button>
            <span className={`system-state${systemRunning ? " online" : " offline"}`}>
              <i aria-hidden="true" />
              System {systemRunning ? "Online" : "Offline"}
            </span>
          </div>
        </header>
        {!dashboardRoute && !hideWorkspaceHeader ? (
          <header className="topbar">
            <div>
              <h1>CACSMS Autonomous Media Studio</h1>
              <div className="muted">Topic to script, scenes, visuals, audio, timeline, QA, export, and publishing.</div>
            </div>
          </header>
        ) : null}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}

function hrefForChild(moduleSlug: string, childSlug: string) {
  if (moduleSlug === "dashboard" && childSlug === "executive-dashboard") {
    return "/dashboard/executive-dashboard";
  }
  if (moduleSlug === "dashboard" && childSlug === "my-workspace") {
    return "/dashboard/my-workspace";
  }
  if (moduleSlug === "dashboard" && childSlug === "active-productions") {
    return "/dashboard/active-productions";
  }
  if (moduleSlug === "dashboard" && childSlug === "recent-productions") {
    return "/dashboard/recent-productions";
  }
  if (moduleSlug === "dashboard" && childSlug === "production-workflow") {
    return "/production-workflow/discover";
  }
  if (moduleSlug === "dashboard" && childSlug === "production-pipeline") {
    return "/production-workflow/discover";
  }
  if (
    moduleSlug === "dashboard" &&
    ["rendering-monitor", "agent-activity", "publishing-overview", "calendar", "notifications", "system-health"].includes(childSlug)
  ) {
    return `/home/${childSlug}`;
  }
  if (moduleSlug === "productions" && childSlug === "production-pipeline") {
    return "/production-workflow/discover";
  }
  if (moduleSlug === "productions" && childSlug === "create-production") {
    return "/production-studio/create-production";
  }
  if (moduleSlug === "productions") {
    return `/production-studio/${childSlug}`;
  }
  if (moduleSlug === "intelligence") {
    return `/content-intelligence/${childSlug}`;
  }
  if (moduleSlug === "opportunity-intelligence") {
    return `/opportunity-intelligence/${childSlug}`;
  }
  if (moduleSlug === "knowledge-universe") {
    return `/knowledge-universe/${childSlug}`;
  }
  if (moduleSlug === "settings" && childSlug === "production-defaults") {
    return "/settings/production-defaults";
  }
  return `/${moduleSlug}/${childSlug}`;
}

function hrefForModule(moduleSlug: string) {
  if (moduleSlug === "productions") return "/production-studio";
  if (moduleSlug === "intelligence") return "/content-intelligence";
  if (moduleSlug === "opportunity-intelligence") return "/opportunity-intelligence";
  if (moduleSlug === "knowledge-universe") return "/knowledge-universe/executive-dashboard";
  if (moduleSlug === "dashboard") return "/dashboard";
  return `/${moduleSlug}`;
}

function isActiveChild(moduleSlug: string, childSlug: string, pathname: string) {
  return pathname === hrefForChild(moduleSlug, childSlug);
}

function formatCount(count: number, slug: string) {
  if (slug === "knowledge-universe") return "1.8M";
  return String(count);
}
