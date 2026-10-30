"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
import { DiscordGuideVisual, PlatformGuideVisual } from "@/components/home-guide-visuals";
import "./home-hero.css";

const SLIDE_DURATION_MS = 9000;
const HOME_SLIDES = [
  { id: "intro", label: "LabBridge 소개", eyebrow: "RESEARCH × AI × COLLABORATION", firstLine: "연구의 질문이", secondLine: "AI와 만나는 곳, ", accent: "LabBridge", body: "실제 연구사례와 최신 기술 동향을 통해 내 연구에 맞는 AI 아이디어를 발견하고, 함께할 AI 전문가를 찾아보세요." },
  { id: "platform", label: "플랫폼 이용 안내", eyebrow: "GET STARTED WITH LABBRIDGE", firstLine: "연구의 시작부터", secondLine: "협업의 완성까지", accent: "", body: "인사이트에서 가능성을 발견하고, 내 연구에 맞는 전문가와 연결되세요. 함께할 팀을 만나 프로젝트를 이어갑니다." },
  { id: "discord", label: "Discord 이용 안내", eyebrow: "YOUR COLLABORATION SPACE", firstLine: "함께하는 연구의 현장,", secondLine: "Discord로 이어집니다.", accent: "", body: "프로젝트의 대화와 협업이 이어지는 공간. 챗봇과 Google Calendar의 연결로 연구 논의와 일정이 한 흐름으로 이어집니다." },
] as const;

/** 홈의 전환만 담당합니다. 기존 연구 이미지는 서버에서 만든 ReactNode로 전달받습니다. */
export function HomeHero({ introVisual }: { introVisual: ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const isRunning = !userPaused && !hovering && !tabHidden && !reduceMotion;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(motion.matches);
    const syncVisibility = () => setTabHidden(document.hidden);
    syncMotion();
    syncVisibility();
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      motion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  function selectSlide(index: number): void {
    setActiveIndex((index + HOME_SLIDES.length) % HOME_SLIDES.length);
  }

  function handlePointer(event: PointerEvent<HTMLElement>, entering: boolean): void {
    // 터치 뒤 남는 가상 hover 때문에 자동 넘김이 멈추지 않게 합니다.
    if (event.pointerType === "mouse") setHovering(entering);
  }

  function handleFocus(event: FocusEvent<HTMLElement>): void {
    const cameFromOutside = !event.currentTarget.contains(event.relatedTarget as Node | null);
    if (cameFromOutside && event.target.matches(":focus-visible")) setUserPaused(true);
  }

  return (
    <section aria-label="LabBridge 소개와 이용 안내" aria-roledescription="carousel" onPointerEnter={(event) => handlePointer(event, true)} onPointerLeave={(event) => handlePointer(event, false)} onFocus={handleFocus}>
      <h1 className="sr-only">LabBridge · 연구의 질문이 AI와 만나는 곳</h1>
      <PageContainer className="home-hero">
        {/* 같은 그리드 칸을 공유하면 가장 긴 화면에 높이가 맞춰져 아래 카드가 흔들리지 않습니다. */}
        <div className="home-hero__slides" aria-live={isRunning ? "off" : "polite"}>
          {HOME_SLIDES.map((slide, index) => (
            <div key={slide.id} className="home-hero__slide" data-home-slide={slide.id} data-active={activeIndex === index} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${HOME_SLIDES.length}: ${slide.label}`} aria-hidden={activeIndex !== index} inert={activeIndex !== index}>
              <div className="home-hero__copy">
                <p className="home-hero__eyebrow">{slide.eyebrow}</p>
                <h2 className="home-hero__title">{slide.firstLine}<br /><span className={slide.id === "intro" ? undefined : "text-brand"}>{slide.secondLine}</span>{slide.accent ? <span className="text-brand">{slide.accent}</span> : null}</h2>
                <p className="home-hero__description">{slide.body}</p>
                {slide.id === "intro" ? (
                  <Link href="#paths" className="home-hero__cta">지금 시작하기 <span aria-hidden="true">→</span></Link>
                ) : (
                  // 팀원이 문서를 준비하기 전에는 클릭되지 않는 가짜 링크를 만들지 않습니다.
                  <p className="home-hero__manual"><span>상세 매뉴얼 준비 중</span> 자세한 이용 방법은 FAQ에서 만나요.</p>
                )}
              </div>
              {slide.id === "intro" ? (
                <div className="home-hero__intro-art">
                  {introVisual}
                  <div className="home-hero__intro-mobile" aria-hidden="true"><span>RESEARCH × AI</span><strong>서로 다른 전문성이<br />새로운 가능성으로.</strong><p>생명과학 <i>·</i> 의료 <i>·</i> 기후·환경</p></div>
                </div>
              ) : slide.id === "platform" ? <PlatformGuideVisual /> : <DiscordGuideVisual />}
            </div>
          ))}
        </div>
        <div className="home-hero__controls">
          <div className="home-hero__choices" role="group" aria-label="홈 소개 화면 선택">
            {HOME_SLIDES.map((slide, index) => (
              <button key={slide.id} type="button" onClick={() => selectSlide(index)} aria-current={activeIndex === index ? "true" : undefined} className="home-hero__choice">
                <span className="home-hero__choice-number">0{index + 1}</span><span>{slide.label}</span>
                <span key={activeIndex === index ? `active-${index}` : "idle"} className="home-hero__progress" data-running={isRunning && activeIndex === index} style={{ "--home-slide-duration": `${SLIDE_DURATION_MS}ms` } as CSSProperties} onAnimationEnd={activeIndex === index ? () => selectSlide(activeIndex + 1) : undefined} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="home-hero__navigation">
            <button type="button" aria-label="이전 홈 소개" onClick={() => selectSlide(activeIndex - 1)}>←</button>
            <span className="home-hero__count" aria-hidden="true">0{activeIndex + 1} <i>/</i> 03</span>
            <button type="button" aria-label="다음 홈 소개" onClick={() => selectSlide(activeIndex + 1)}>→</button>
            <button type="button" aria-label={userPaused || reduceMotion ? "홈 소개 자동 넘김 재생" : "홈 소개 자동 넘김 일시정지"} disabled={reduceMotion} title={reduceMotion ? "기기의 동작 줄이기 설정으로 자동 넘김을 멈췄습니다." : undefined} onClick={() => setUserPaused((current) => !current)}><span aria-hidden="true">{userPaused || reduceMotion ? "▶" : "Ⅱ"}</span></button>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
