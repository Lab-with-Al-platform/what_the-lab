"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InsightCard } from "@/components/insight-card";
import {
  matchesTopicFilter,
  type InsightKind,
  type InsightListItem,
  type InsightTopic,
} from "@/lib/insight-meta";
import { articleReason, rankRelated } from "@/lib/related-rank";
import { useViewerInterest } from "@/lib/viewer-interest";
import { useCardsPerView } from "@/lib/use-cards-per-view";

interface InsightListProps {
  kind: InsightKind;
  articles: InsightListItem[];
  topics: InsightTopic[];
  topicCounts: Record<string, number>;
  listTitle: string;
  footnote?: string;
}

export function InsightList({
  kind,
  articles,
  topics,
  topicCounts,
  listTitle,
  footnote,
}: InsightListProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const topic = searchParams.get("topic") ?? "all";
  const [sort, setSort] = useState<"latest" | "title">("latest");
  const [page, setPage] = useState(1);
  const interest = useViewerInterest();
  // 한 페이지 = 한 줄. PC 3장, 태블릿 2장, 모바일 1장이에요.
  const pageSize = useCardsPerView();

  const filtered = useMemo(() => {
    const matched = articles.filter((article) => matchesTopicFilter(article, topic));
    const ordered = [...matched].sort((left, right) => {
      if (sort === "title") {
        return left.title.localeCompare(right.title, "ko");
      }
      return right.publishedOn.localeCompare(left.publishedOn);
    });
    if (sort !== "latest" || !interest) return ordered;
    return rankRelated(ordered, (article) => Boolean(articleReason(article, interest)));
  }, [articles, interest, sort, topic]);
  const rankedCount = interest && sort === "latest" ? filtered.filter((article) => articleReason(article, interest)).length : 0;

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function selectTopic(nextTopic: string) {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTopic === "all") {
      params.delete("topic");
    } else {
      params.set("topic", nextTopic);
    }
    const query = params.toString();
    // 목록은 서버 페이지 안의 작은 클라이언트라서, 물음표만 있는 주소는 이동하지 않습니다.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <section className="pt-8 md:pt-10" aria-labelledby={`${kind}-list-heading`}>
      <div className="flex flex-wrap items-end gap-3">
        <h2 id={`${kind}-list-heading`} className="text-2xl font-bold">{listTitle}</h2>
        <p className="text-sm text-muted">{kind === "case" ? "AI 기술 분야로 골라 보기" : "주제로 골라 보기"}</p>
        <label className="ml-auto text-sm text-muted">
          정렬{" "}
          <select
            className="bg-transparent font-semibold text-ink"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "latest" | "title");
              setPage(1);
            }}
          >
            <option value="latest">{kind === "case" ? "최신 등록순" : "최신순"}</option>
            <option value="title">제목순</option>
          </select>
        </label>
      </div>
      {/* 공간이 부족하면 다음 줄로 내려가 모든 분야를 가로 스크롤 없이 보여 줍니다. */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="주제 필터">
        {topics.map((item) => {
          const selected = topic === item.id || topic === item.label || (item.id === "all" && topic === "all");
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTopic(item.id)}
              className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm ${
                selected ? "border-brand bg-brand text-white" : "border-line bg-white text-ink"
              }`}
              aria-pressed={selected}
            >
              {/* 분류 코드는 선택·검색에만 사용하고, 사용자는 분야 이름으로 구분합니다. */}
              <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
              {kind === "case" ? <span className="shrink-0 text-xs opacity-80">{topicCounts[item.id] ?? 0}</span> : null}
            </button>
          );
        })}
      </div>
      {rankedCount > 0 ? (
        <p className="mt-3 text-sm text-muted">나와 같은 키워드의 글 {rankedCount}편을 위에 두었어요. 나머지 글도 그대로 볼 수 있어요.</p>
      ) : null}

      {topic !== "all" && !topics.some((item) => item.id === topic || item.label === topic) ? (
        <p className="mt-3 text-sm text-muted">
          ‘{topic}’ 분야만 보는 중입니다.{" "}
          <button type="button" className="font-semibold text-brand" onClick={() => selectTopic("all")}>
            전체 보기
          </button>
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-5 py-10 text-sm text-muted">이 조건에 해당하는 글이 없습니다. 다른 분야를 선택해 보세요.</p>
      ) : (
        // 한 줄만 보여 주고 양옆 버튼으로 넘겨요. 버튼은 카드 바깥 여백에 둬서 글을 가리지 않아요.
        <div className="relative mt-6 md:px-14">
          <SlideButton direction="prev" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} />
          <div
            className="grid items-stretch gap-5"
            style={{ gridTemplateColumns: `repeat(${pageSize}, minmax(0, 1fr))` }}
            aria-label="콘텐츠 목록"
            aria-live="polite"
          >
            {visible.map((article) => (
              <InsightCard key={article.slug} article={article} variant="editorial" reason={interest && sort === "latest" ? articleReason(article, interest) : null} />
            ))}
          </div>
          <SlideButton direction="next" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} />
        </div>
      )}

      {pageCount > 7 ? (
        // 모바일처럼 한 장씩 넘기면 번호가 너무 많아져서, 숫자로만 짧게 알려 줘요.
        <nav aria-label="페이지" className="mt-6 flex justify-center text-sm text-muted">
          <span aria-current="page">
            <strong className="text-ink">{safePage}</strong> / {pageCount}
          </span>
        </nav>
      ) : pageCount > 1 ? (
        <nav aria-label="페이지" className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              aria-current={pageNumber === safePage ? "page" : undefined}
              className={`grid h-11 w-11 place-items-center rounded-button ${
                pageNumber === safePage ? "bg-ink text-white" : "bg-white text-ink"
              }`}
            >
              {pageNumber}
            </button>
          ))}
        </nav>
      ) : null}
      {footnote ? <p className="mt-4 text-center text-xs leading-5 text-muted">{footnote}</p> : null}
    </section>
  );
}

/** 목록 양옆의 < > 버튼. 모바일은 카드 위에 겹쳐 두고, 태블릿부터는 카드 바깥 여백에 둬요. */
function SlideButton({ direction, disabled, onClick }: { direction: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "이전 글" : "다음 글"}
      className={`absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-xl text-ink shadow-card transition-colors hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-30 ${
        isPrev ? "left-1 md:left-0" : "right-1 md:right-0"
      }`}
    >
      <span aria-hidden="true">{isPrev ? "‹" : "›"}</span>
    </button>
  );
}
