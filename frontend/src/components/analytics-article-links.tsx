"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { InsightCard } from "@/components/insight-card";
import { sendAnalytics } from "@/lib/analytics-collect";
import type { InsightArticle } from "@/lib/insights";

/** 공개 글이 보인 뒤, 그 글을 읽은 세션을 남기기 위한 기록입니다. 조회수 수집과는 별개입니다. */
export function AnalyticsArticleBeacon({ kind, slug }: { kind: "case" | "trend"; slug: string }) {
  useEffect(() => {
    sendAnalytics({ event_name: "article_view", target: `${kind}/${slug}` });
  }, [kind, slug]);
  return null;
}

/** 전문가 찾기와 관련 글 이동만 구분해서 보냅니다. 검색어 전체는 보내지 않습니다. */
export function TrackedArticleLink({
  href,
  className,
  eventName,
  target,
  children,
}: {
  href: string;
  className: string;
  eventName: "expert_search_click" | "related_article_open";
  target: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => sendAnalytics({ event_name: eventName, target })}
    >
      {children}
    </Link>
  );
}

/** 글 아래 관련 카드. 카드 안 링크를 눌러도 관련 글 이동 한 건으로 남깁니다. */
export function RelatedArticleCard({ article }: { article: InsightArticle }) {
  return (
    <div onClick={() => sendAnalytics({
      event_name: "related_article_open",
      target: `${article.kind}/${article.slug}`,
    })}
    >
      <InsightCard article={article} />
    </div>
  );
}
