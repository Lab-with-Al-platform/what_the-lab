import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { getInsight, insightsByKind } from "@/lib/insights";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return insightsByKind("case").map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getInsight(slug);
  if (!article || article.kind !== "case") {
    return { title: "사례를 찾을 수 없습니다" };
  }
  return { title: article.title, description: article.summary };
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = getInsight(slug);
  if (!article || article.kind !== "case") {
    notFound();
  }
  return <ArticleView article={article} />;
}
