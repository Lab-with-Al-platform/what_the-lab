import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExpertDetail } from "@/components/expert-detail";
import { EXPERTS, getExpert, relatedExperts } from "@/lib/experts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return EXPERTS.map((expert) => ({ slug: expert.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const expert = getExpert(slug);
  return { title: expert ? `${expert.name} · AI 전문가` : "AI 전문가" };
}

export default async function ExpertDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const expert = getExpert(slug);

  if (!expert) {
    notFound();
  }

  return <ExpertDetail expert={expert} related={relatedExperts(expert)} />;
}
