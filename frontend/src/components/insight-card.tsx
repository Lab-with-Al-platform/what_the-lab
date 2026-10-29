import Link from "next/link";
import { CoverArt, INSIGHT_CARD_COVER_CLASS } from "@/components/cover-art";
import { KindBadge } from "@/components/kind-badge";
import { articlePath, kindLabel, type InsightListItem } from "@/lib/insight-meta";

interface InsightCardProps {
  article: InsightListItem;
  variant?: "default" | "landing" | "editorial";
  /** 내 키워드와 같을 때만 한 줄 이유를 붙입니다. */
  reason?: string | null;
}

/**
 * 홈과 목록에서 같은 크기로 쓰는 인사이트 카드입니다.
 * 저장은 MVP+라서 버튼을 두지 않습니다. 눌러도 아무 일도 없는 아이콘을 완성 기능처럼 보이지 않게 합니다.
 */
export function InsightCard({ article, variant = "default", reason }: InsightCardProps) {
  const href = articlePath(article);
  const isLanding = variant === "landing";

  // 목록 전용 스타일만 분리해 홈과 상세의 기존 카드 디자인은 보존합니다.
  if (variant === "editorial") {
    return (
      <article className="insight-editorial-card">
        {/* 카드 전체를 링크 하나로 묶어 클릭과 키보드 탐색을 모두 쉽게 합니다. */}
        <Link href={href} className="group flex h-full flex-col" aria-label={`${kindLabel(article.kind)}: ${article.title}`}>
          <CoverArt
            theme={article.cover} src={article.coverSrc} className={INSIGHT_CARD_COVER_CLASS}
            sizes="(min-width: 1440px) 440px, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          />
          <div className="flex flex-1 flex-col p-5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
              <span className={`font-semibold ${article.kind === "case" ? "text-brand" : "text-trend"}`}>{kindLabel(article.kind)}</span>
              <span aria-hidden="true" className="text-line">|</span>
              <span className="text-muted">{article.field}</span>
            </p>
            {reason ? <p className="mt-1 text-xs font-medium text-brand">{reason}</p> : null}
            <h3 className="mt-2 line-clamp-2 text-base leading-snug font-bold tracking-tight text-ink transition-colors group-hover:text-brand md:min-h-[2lh]">{article.title}</h3>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted md:min-h-[2lh]">{article.summary}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-muted">
              <time dateTime={article.publishedOn}>{article.publishedOn}</time>
              <span className="flex items-center gap-3">
                읽는 시간 {article.readingMinutes}분
                <span aria-hidden="true" className="text-base text-brand">↗</span>
              </span>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-card shadow-card">
      <Link href={href} className="relative block shrink-0">
        <CoverArt
          theme={article.cover} src={article.coverSrc}
          className={isLanding ? "h-[132px] w-full shrink-0" : INSIGHT_CARD_COVER_CLASS}
          sizes={isLanding
            ? "(min-width: 1440px) 350px, (min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
            : "(min-width: 1440px) 460px, (min-width: 768px) 33vw, 100vw"}
        />
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
