import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentIntelligencePage } from "@/components/content-intelligence/ContentIntelligencePage";
import { contentIntelligencePages, contentIntelligenceSlugs } from "@/lib/content-intelligence-pages";
export function generateStaticParams(){return contentIntelligenceSlugs.map(slug=>({slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const page=contentIntelligencePages[slug];return page?{title:`${page.title} | CACSMS`,description:page.subtitle}:{}}
export default async function ContentIntelligenceRoute({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const page=contentIntelligencePages[slug];if(!page)notFound();return <ContentIntelligencePage page={page}/>}
