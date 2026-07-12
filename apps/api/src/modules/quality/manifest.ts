import { createDomainModule } from "../../common/module-manifest";

export const qualityModule = createDomainModule({
  name: "quality",
  responsibility: "Run content, script, fact, visual, video, audio, subtitle, continuity, accessibility, copyright, platform, AI safety, human review, and approval checks.",
  entities: ["QualityReview", "QualityCheck", "CompliancePolicy", "Approval"],
  commands: ["StartQualityReview", "RecordQualityCheck", "RequestHumanReview", "ApproveProduction"],
  queries: ["GetQualityDashboard", "GetReviewStatus", "ListCompliancePolicies"],
  events: ["QualityReviewStarted", "QualityCheckCompleted", "HumanReviewRequested", "ProductionApproved"]
});
