import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { getInsight, insightsByKind, relatedInsights } from "@/lib/insights";
import { insightArticleJsonLd, insightMetadata } from "@/lib/insight-seo";
import { NON_INDEXABLE } from "@/lib/site-seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return insightsByKind("trend").map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getInsight(slug);
  if (!article || article.kind !== "trend") {
    return { ...NON_INDEXABLE, title: "트렌드를 찾을 수 없습니다" };
  }
  return insightMetadata(article);
}

export default async function TrendDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = getInsight(slug);
  if (!article || article.kind !== "trend") {
    notFound();
  }
  const jsonLd = insightArticleJsonLd(article);
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      <ArticleView
        article={article}
        related={relatedInsights(article)}
        companion={article.companionSlug ? getInsight(article.companionSlug) : undefined}
      />
    </>
  );
}
