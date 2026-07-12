import { createDomainModule } from "../../common/module-manifest";

export const exportsModule = createDomainModule({
  name: "exports",
  responsibility: "Create final video, editable scene, CapCut, audio, subtitle, storyboard, script, course, presentation, social, and publishing packages.",
  entities: ["ExportJob", "ExportPackage", "DownloadAsset", "ExportHistory"],
  commands: ["CreateExportJob", "PackageCapCutScenes", "PackageFullProduction", "PublishDownload"],
  queries: ["GetExportDashboard", "ListExportHistory", "GetDownloadCenter"],
  events: ["ExportQueued", "ExportCompleted", "ExportFailed", "DownloadPublished"]
});
