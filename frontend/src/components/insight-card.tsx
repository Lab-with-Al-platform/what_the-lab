import Link from "next/link";
import { CoverArt, INSIGHT_CARD_COVER_CLASS } from "@/components/cover-art";
import { KindBadge } from "@/components/kind-badge";
import { articlePath, type InsightArticle } from "@/lib/insights";

interface InsightCardProps {
  article: InsightArticle;
  variant?: "default" | "landing";
}

/**
 * 홈과 목록에서 같은 크기로 쓰는 인사이트 카드입니다.
 * 저장은 MVP+라서 버튼을 두지 않습니다. 눌러도 아무 일도 없는 아이콘을 완성 기능처럼 보이지 않게 합니다.
 */
export function InsightCard({ article, variant = "default" }: InsightCardProps) {
  const href = articlePath(article);
  const isLanding = variant === "landing";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-card shadow-card">
      <Link href={href} className="relative block shrink-0">
        <CoverArt theme={article.cover} className={isLanding ? "h-[132px] w-full shrink-0" : INSIGHT_CARD_COVER_CLASS} />
        <span className={`absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 ${isLanding ? "pt-8" : "pt-10"}`}>
          <KindBadge kind={article.kind} />
          <span className="rounded-md bg-white/20 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">{article.field}</span>
        </span>
      </Link>
      <div className={`flex flex-1 flex-col px-4 pb-4 ${isLanding ? "pt-3" : "pt-4"}`}>
        <h3 className={`line-clamp-2 min-h-[2lh] leading-snug font-bold tracking-tight ${isLanding ? "text-[14px]" : "text-[15px]"}`}>
          <Link href={href} className="hover:text-brand">
            {article.title}
          </Link>
        </h3>
        <p className={`mt-2 line-clamp-2 min-h-[2lh] text-muted ${isLanding ? "text-xs leading-5" : "text-sm leading-6"}`}>{article.summary}</p>
        <time className={`mt-auto text-xs text-faint ${isLanding ? "pt-3" : "pt-4"}`} dateTime={article.publishedOn}>
          {article.publishedOn}
        </time>
      </div>
    </article>
  );
}
