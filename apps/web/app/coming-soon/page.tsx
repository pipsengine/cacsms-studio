import { ComingSoonPage } from "@/features/coming-soon/ComingSoonPage";

export default async function ComingSoonRoute({
  searchParams
}: {
  searchParams: Promise<{ title?: string; href?: string }>;
}) {
  const params = await searchParams;
  return (
    <ComingSoonPage
      title={params.title ? decodeURIComponent(params.title) : "Coming Soon"}
      href={params.href ? decodeURIComponent(params.href) : undefined}
    />
  );
}
