export interface HomeOperationalPageConfig {
  slug: string;
  title: string;
  description: string;
  entityLabel: string;
  columns: string[];
  metricLabels: string[];
  panelTitles: string[];
}

export const homeOperationalPages: Record<string, HomeOperationalPageConfig> = {
  "production-pipeline": {
    slug: "production-pipeline",
    title: "Production Pipeline",
    description: "Track productions through research, writing, creation, review, approval, scheduling, and publishing.",
    entityLabel: "Pipeline Item",
    columns: ["Production", "Stage", "Progress", "Status", "Owner", "Due"],
    metricLabels: ["Pipeline Items", "In Progress", "Blocked", "Completed Today", "SLA Breaches", "Avg. Cycle Time"],
    panelTitles: ["Stage Health", "Bottlenecks"]
  },
  "rendering-monitor": {
    slug: "rendering-monitor",
    title: "Rendering Monitor",
    description: "Monitor rendering queues, engines, progress, completion estimates, failures, and resource utilization.",
    entityLabel: "Rendering Job",
    columns: ["Production", "Asset", "Engine", "Preset", "Progress", "Status", "ETA"],
    metricLabels: ["Running Jobs", "Queued Jobs", "Completed Today", "Failed Jobs", "Render Utilization", "Average ETA"],
    panelTitles: ["Rendering Engines", "Recent Failures"]
  },
  "agent-activity": {
    slug: "agent-activity",
    title: "Agent Activity",
    description: "Monitor AI-agent assignments, queues, execution, success rates, heartbeat health, and operating cost.",
    entityLabel: "Agent",
    columns: ["Agent", "Role", "Task", "Production", "Status", "Queue", "Success", "Cost Today", "Heartbeat"],
    metricLabels: ["Registered Agents", "Active Agents", "Busy Agents", "Idle Agents", "Failed Agents", "Agent Cost Today"],
    panelTitles: ["Queue Summary", "Recent Agent Events"]
  },
  "publishing-overview": {
    slug: "publishing-overview",
    title: "Publishing Overview",
    description: "Monitor channel connections, schedules, outcomes, retries, and publication failures.",
    entityLabel: "Publication",
    columns: ["Production", "Channel", "Account", "Status", "Scheduled", "Published", "Attempts"],
    metricLabels: ["Scheduled Posts", "Ready to Publish", "Published Today", "Failed Posts", "Connected Channels", "Publishing Success"],
    panelTitles: ["Connected Channels", "Recent Failures"]
  },
  calendar: {
    slug: "calendar",
    title: "Calendar",
    description: "Coordinate milestones, reviews, deadlines, publishing schedules, meetings, and operational events.",
    entityLabel: "Event",
    columns: ["Event", "Type", "Start", "End", "Status", "Production", "Owner"],
    metricLabels: ["Events Today", "Events This Week", "Upcoming Deadlines", "Scheduled Publishing", "Reviews", "Schedule Conflicts"],
    panelTitles: ["Upcoming Events", "Schedule Conflicts"]
  },
  notifications: {
    slug: "notifications",
    title: "Notifications",
    description: "Review production updates, approvals, publishing outcomes, agent events, deadline alerts, and system notices.",
    entityLabel: "Notification",
    columns: ["Notification", "Category", "Severity", "Status", "Created", "Entity"],
    metricLabels: ["All Notifications", "Unread", "Critical", "Approvals", "Publishing", "System Alerts"],
    panelTitles: ["Categories", "Notification Preferences"]
  },
  "system-health": {
    slug: "system-health",
    title: "System Health",
    description: "Monitor API, database, storage, AI providers, queues, rendering, publishing, and integration health.",
    entityLabel: "Service",
    columns: ["Service", "Category", "Status", "Latency", "Uptime", "Last Checked", "Message"],
    metricLabels: ["Platform Health Score", "Healthy Services", "Degraded Services", "Offline Services", "Open Incidents", "Average Latency"],
    panelTitles: ["Open Incidents", "Latest Checks"]
  }
};

export const homeOperationalSlugs = Object.keys(homeOperationalPages);
