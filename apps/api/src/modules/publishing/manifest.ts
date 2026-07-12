import { createDomainModule } from "../../common/module-manifest";

export const publishingModule = createDomainModule({
  name: "publishing",
  responsibility: "Manage channels, scheduler, SEO metadata, thumbnails, publishing queue, history, comments, engagement, and reports.",
  entities: ["Channel", "PublishingJob", "PublishingMetadata", "PublishingReport"],
  commands: ["ConnectChannel", "SchedulePublishingJob", "PublishProduction", "RecordEngagement"],
  queries: ["GetPublishingDashboard", "ListChannels", "ListPublishingHistory", "GetPublishingReports"],
  events: ["ChannelConnected", "PublishingScheduled", "ProductionPublished", "EngagementRecorded"]
});
