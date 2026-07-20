import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  Boxes,
  CalendarClock,
  Clapperboard,
  DatabaseZap,
  FileText,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  Library,
  Mic2,
  Network,
  PenLine,
  PlaySquare,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Telescope,
  Users,
  Wand2
} from "lucide-react";

export const navigationIconBySlug: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  productions: Clapperboard,
  intelligence: Sparkles,
  "opportunity-intelligence": Telescope,
  "knowledge-universe": DatabaseZap,
  writing: PenLine,
  "story-learning": Network,
  storyboard: FileText,
  visuals: Wand2,
  video: PlaySquare,
  audio: Mic2,
  timeline: CalendarClock,
  quality: ShieldCheck,
  exports: FolderOpen,
  publishing: Radio,
  assets: Library,
  templates: Boxes,
  agents: Bot,
  automation: Activity,
  analytics: Gauge,
  collaboration: Users,
  integrations: Network,
  administration: Settings,
  settings: Settings
};

export function getNavigationIcon(slug: string): LucideIcon {
  return navigationIconBySlug[slug] ?? Boxes;
}
