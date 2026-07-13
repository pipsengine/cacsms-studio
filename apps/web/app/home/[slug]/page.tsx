import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeOperationalPage } from "@/components/home-remaining-pages/HomeOperationalPage";
import { homeOperationalPages, homeOperationalSlugs } from "@/lib/home-operational-pages";

export function generateStaticParams() {
  return homeOperationalSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const config = homeOperationalPages[slug];
  return config ? { title: `${config.title} | CACSMS`, description: config.description } : {};
}

export default async function HomeOperationalRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = homeOperationalPages[slug];
  if (!config) notFound();
  return <HomeOperationalPage config={config} />;
}
