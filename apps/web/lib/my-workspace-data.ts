import { contentTypeDefinitions, navigationModules } from "@cacsms/contracts";
import type { CalendarDay, MyWorkspaceResponse, WorkspaceMetric } from "@/types/my-workspace";

export async function getMyWorkspaceData(): Promise<MyWorkspaceResponse> {
  const now = new Date();

  return {
    generatedAt: now.toISOString(),
    user: {
      displayName: "Sarah A.",
      initials: "SA",
      role: "Administrator"
    },
    metrics: buildMetrics(),
    tasks: [],
    productions: [],
    calendar: {
      monthLabel: new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(now),
      days: buildCalendar(now),
      summary: { deadlines: 0, reviews: 0, events: 0 }
    },
    contentPerformance: {
      summary: [
        { label: "Views", value: "0", delta: "0%" },
        { label: "Engagement", value: "0%", delta: "0%" },
        { label: "Subscribers", value: "0", delta: "0%" },
        { label: "Watch Time", value: "0h", delta: "0%" },
        { label: "Revenue", value: "$0", delta: "0%" }
      ],
      points: ["W1", "W2", "W3", "W4", "W5", "W6"].map((label) => ({
        label,
        views: 0,
        engagement: 0,
        subscribers: 0,
        watchTime: 0
      }))
    },
    activity: [
      {
        id: "workspace-ready",
        title: "Workspace ready",
        module: `${navigationModules.length} modules and ${contentTypeDefinitions.length} production types available`,
        timeAgo: "Now",
        icon: "document",
        tone: "blue"
      }
    ],
    notifications: [
      {
        id: "no-live-notifications",
        title: "No live notifications connected",
        subtitle: "Notification services are pending platform integration.",
        timeAgo: "Now",
        unread: false,
        tone: "purple"
      }
    ],
    deadlines: [],
    fileAccess: [
      { id: "documents", label: "Documents", count: 0, icon: "document" },
      { id: "storyboards", label: "Storyboards", count: 0, icon: "storyboard" },
      { id: "media-assets", label: "Media Assets", count: 0, icon: "media" },
      { id: "templates", label: "Templates", count: 0, icon: "template" },
      { id: "shared-files", label: "Shared Files", count: 0, icon: "shared" },
      { id: "audio-assets", label: "Audio Assets", count: 0, icon: "audio" }
    ],
    storage: {
      usedGb: 0,
      totalGb: 100,
      slices: [
        { label: "Video", valueGb: 0, tone: "purple" },
        { label: "Images", valueGb: 0, tone: "blue" },
        { label: "Audio", valueGb: 0, tone: "green" },
        { label: "Documents", valueGb: 0, tone: "orange" }
      ]
    }
  };
}

function buildMetrics(): WorkspaceMetric[] {
  return [
    ["my-tasks", "My Tasks", "0", "0%", "purple", "tasks"],
    ["active-productions", "Active Productions", "0", "0%", "blue", "production"],
    ["pending-approvals", "Pending Approvals", "0", "0%", "green", "approval"],
    ["reviews", "Reviews", "0", "0%", "orange", "review"],
    ["drafts", "Drafts", "0", "0%", "cyan", "drafts"],
    ["deadlines", "Deadlines", "0", "0%", "red", "deadline"]
  ].map(([key, label, value, trendLabel, tone, icon]) => ({
    key,
    label,
    value,
    trendLabel,
    trendDirection: "flat",
    tone,
    icon,
    sparkline: [0, 0, 0, 0, 0, 0]
  })) as WorkspaceMetric[];
}

function buildCalendar(now: Date): CalendarDay[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    days.push({ day: daysInPreviousMonth - index, isCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ day, isCurrentMonth: true, isToday: day === now.getDate() });
  }

  let nextDay = 1;
  while (days.length < 42) {
    days.push({ day: nextDay, isCurrentMonth: false });
    nextDay += 1;
  }

  return days;
}
