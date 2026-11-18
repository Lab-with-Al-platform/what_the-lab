import type { Metadata } from "next";
import { articlePath } from "./insight-meta";
import type { InsightArticle } from "./insights";
import { canonicalUrl, searchIndexMetadata } from "./site-seo";

/** 출처 링크가 있다고 모두 검색에 공개할 수는 없습니다. 별도 표시한 글만 포함합니다. */
function indexableCitation(article: InsightArticle): string | undefined {
  if (!article.evidence || !article.sourceUrl) return undefined;

  try {
    const url = new URL(article.sourceUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function insightCanonical(article: InsightArticle): string | undefined {
  return indexableCitation(article) ? canonicalUrl(articlePath(article)) : undefined;
}

export function insightMetadata(article: InsightArticle): Metadata {
  return {
    title: article.title,
    description: article.summary,
    ...searchIndexMetadata(insightCanonical(article)),
  };
}

/** 본문에서 독자가 확인할 수 있는 값만 Article 데이터에 넣습니다. */
export function insightArticleJsonLd(article: InsightArticle): string | undefined {
  const citation = indexableCitation(article);
  const canonical = citation ? canonicalUrl(articlePath(article)) : undefined;
  if (!canonical) return undefined;

  const { author, publishedOn } = article.editorial ?? {};
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    headline: article.title,
    description: article.summary,
    inLanguage: "ko",
    citation,
    ...(author ? { author: { "@type": author.type, name: author.name } } : {}),
    ...(publishedOn ? { datePublished: publishedOn } : {}),
  };

  // 제목에 </script> 같은 문자열이 있어도 HTML의 script가 중간에 닫히지 않게 합니다.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
