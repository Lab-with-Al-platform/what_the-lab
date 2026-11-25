"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FocusEvent, type PointerEvent } from "react";
import { CoverArt } from "@/components/cover-art";
import { KeywordTag } from "@/components/keyword-tag";
import { PageContainer } from "@/components/page-container";
import { articlePath, type InsightKind, type InsightListItem } from "@/lib/insight-meta";

// 큰 제목·두 줄 소개·태그를 읽을 수 있도록 5초보다 조금 길게 잡았습니다.
const SLIDE_DURATION_MS = 7000;

interface InsightFeatureCarouselProps {
  kind: InsightKind;
  items: InsightListItem[];
}

function slideNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function InsightFeatureCarousel({ kind, items }: InsightFeatureCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  // 사용자가 직접 멈춘 상태와, 마우스·탭 전환으로 잠시 멈춘 상태를 나눠 관리합니다.
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  const canRotate = items.length > 1;
  const isRunning = canRotate && !userPaused && !hovering && !tabHidden;
  const active = items[Math.min(activeIndex, Math.max(items.length - 1, 0))];
  const isCase = kind === "case";

  // '동작 줄이기'를 켠 사용자에게는 자동 전환을 시작하지 않습니다.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setUserPaused(true);
    }
  }, []);

  // 다른 탭을 보는 동안 넘어가 버리지 않도록 멈춥니다.
  useEffect(() => {
    const syncVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  function showNext() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  // 터치는 손을 뗀 뒤에도 hover가 남을 수 있어 마우스일 때만 잠시 멈춥니다.
  function handlePointer(event: PointerEvent, entering: boolean) {
    if (event.pointerType === "mouse") setHovering(entering);
  }

  // 키보드로 영역에 처음 들어오면 멈추고, 다시 재생할지는 사용자가 정합니다.
  function handleFocus(event: FocusEvent<HTMLElement>) {
    const cameFromOutside = !event.currentTarget.contains(event.relatedTarget as Node | null);
    if (cameFromOutside && event.target.matches(":focus-visible")) setUserPaused(true);
  }

  if (!active) {
    return null;
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={isCase ? "이번 주 추천 사례" : "이번 주 주목 트렌드"}
      onPointerEnter={(event) => handlePointer(event, true)}
      onPointerLeave={(event) => handlePointer(event, false)}
      onFocus={handleFocus}
    >
      {/* 배경 사진의 기준점을 화면 전체가 아닌 공통 본문 프레임으로 제한합니다. */}
      <PageContainer className="insight-feature">
        {/* 사진을 겹쳐 두고 투명도만 바꿔서, 넘어갈 때 레이아웃이 흔들리지 않게 합니다. */}
        {items.map((item, index) => (
          <div
            key={item.slug}
            className="insight-feature__art"
            data-active={index === activeIndex}
            aria-hidden="true"
          >
            <CoverArt
              theme={item.cover}
              src={item.coverSrc}
              className="h-full w-full"
              priority={index === 0}
              sizes="(min-width: 1440px) 960px, (min-width: 1024px) 68vw, (min-width: 768px) 80vw, 100vw"
            />
          </div>
        ))}
        <div className="relative z-10">
          <div className="insight-feature__copy">
            <p className="text-xs font-semibold tracking-[0.08em] text-brand">
              {isCase ? "이번 주 추천 사례" : "이번 주 주목 트렌드"}
            </p>

            {/* 모든 글을 같은 칸에 겹쳐서, 가장 긴 글 높이에 맞추면 버튼 위치가 고정됩니다. */}
            <div className="insight-feature__slides" aria-live={isRunning ? "off" : "polite"}>
              {items.map((item, index) => (
                <div
                  key={item.slug}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} / ${items.length}`}
                  aria-hidden={index !== activeIndex}
                  className="insight-feature__slide"
                  data-active={index === activeIndex}
                >
                  <h2 className="insight-feature__title">{item.featuredHeadline ?? item.title}</h2>
                  <p className="mt-4 max-w-lg text-sm leading-7 text-muted md:text-base">
                    {item.featuredSummary ?? item.summary}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    {item.field}
                    {item.field !== item.topicLabel ? ` · ${item.topicLabel}` : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.map((tag) => <KeywordTag key={tag} label={tag} />)}
                  </div>
                </div>
              ))}
            </div>

            {/* 버튼은 제자리에 두고 연결 주소만 지금 보이는 글로 바꿉니다. */}
            <Link
              href={articlePath(active)}
              aria-label={`${isCase ? "연구 과정 살펴보기" : "트렌드 살펴보기"}: ${active.title}`}
              className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-button bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {isCase ? "연구 과정 살펴보기" : "트렌드 살펴보기"}
              <span aria-hidden="true">→</span>
            </Link>

            {canRotate ? (
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUserPaused(!userPaused)}
                  aria-label={userPaused ? "자동 넘김 재생" : "자동 넘김 일시정지"}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white/80 text-ink"
                >
                  <span aria-hidden="true" className="text-xs">{userPaused ? "▶" : "❚❚"}</span>
                </button>
                <p className="w-14 shrink-0 text-xs font-semibold tabular-nums text-muted" aria-hidden="true">
                  <span className="text-ink">{slideNumber(activeIndex)}</span> / {slideNumber(items.length)}
                </p>
                <div className="flex flex-1 gap-2" role="group" aria-label="추천 글 고르기">
                  {items.map((item, index) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      aria-label={`${index + 1}번째 추천 글 보기: ${item.title}`}
                      aria-current={index === activeIndex ? "true" : undefined}
                      className="insight-feature__step"
                    >
                      <span
                        // key를 바꾸면 진행 막대 애니메이션이 처음부터 다시 시작합니다.
                        key={index === activeIndex ? `active-${activeIndex}` : "idle"}
                        className="insight-feature__step-fill"
                        data-state={index < activeIndex ? "done" : index === activeIndex ? "active" : "todo"}
                        data-running={isRunning}
                        style={{ "--feature-duration": `${SLIDE_DURATION_MS}ms` } as CSSProperties}
                        // 진행 막대가 끝까지 차면 다음 글로 넘어가므로, 멈춤·재개가 막대와 항상 맞습니다.
                        onAnimationEnd={index === activeIndex ? showNext : undefined}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
