import { ModuleWorkspace } from "@/features/module-workspace";

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const resolvedParams = await params;

  return <ModuleWorkspace moduleSlug={resolvedParams.module} />;
}
