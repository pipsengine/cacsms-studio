export type TrendDirection = "up" | "down" | "flat";
export type Priority = "low" | "medium" | "high" | "critical";
export type ItemStatus = "not-started" | "in-progress" | "pending" | "review" | "completed" | "failed";

export interface WorkspaceMetric {
  key: string;
  label: string;
  value: string;
  trendLabel: string;
  trendDirection: TrendDirection;
  tone: "purple" | "blue" | "green" | "orange" | "red" | "cyan";
  icon: "tasks" | "production" | "approval" | "review" | "drafts" | "deadline";
  sparkline: number[];
}

export interface WorkspaceTask {
  id: string;
  title: string;
  module: string;
  type: string;
  priority: Priority;
  dueDate: string;
  status: ItemStatus;
}

export interface ActiveProduction {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string;
  stage: string;
  progress: number;
  deadline: string;
  priority: Priority;
}

export interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  eventKinds?: Array<"deadline" | "review" | "event">;
}

export interface PerformancePoint {
  label: string;
  views: number;
  engagement: number;
  subscribers: number;
  watchTime: number;
}

export interface ActivityItem {
  id: string;
  title: string;
  module: string;
  timeAgo: string;
  icon: "document" | "image" | "video" | "schedule" | "approval" | "research";
  tone: "purple" | "blue" | "green" | "orange" | "red" | "cyan";
}

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  timeAgo: string;
  unread: boolean;
  tone: "green" | "blue" | "orange" | "red" | "purple";
}

export interface DeadlineItem {
  id: string;
  date: string;
  title: string;
  module: string;
  remaining: string;
  priority: Priority;
}

export interface FileAccessItem {
  id: string;
  label: string;
  count: number;
  icon: "document" | "storyboard" | "media" | "template" | "shared" | "audio";
}

export interface StorageSlice {
  label: string;
  valueGb: number;
  tone: "purple" | "blue" | "green" | "orange" | "yellow";
}

export interface MyWorkspaceResponse {
  generatedAt: string;
  user: {
    displayName: string;
    initials: string;
    role: string;
    avatarUrl?: string;
  };
  metrics: WorkspaceMetric[];
  tasks: WorkspaceTask[];
  productions: ActiveProduction[];
  calendar: {
    monthLabel: string;
    days: CalendarDay[];
    summary: { deadlines: number; reviews: number; events: number };
  };
  contentPerformance: {
    summary: Array<{ label: string; value: string; delta: string }>;
    points: PerformancePoint[];
  };
  activity: ActivityItem[];
  notifications: NotificationItem[];
  deadlines: DeadlineItem[];
  fileAccess: FileAccessItem[];
  storage: {
    usedGb: number;
    totalGb: number;
    slices: StorageSlice[];
  };
}
