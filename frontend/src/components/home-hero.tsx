"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { BrandWordmark } from "@/components/brand-wordmark";
import { DiscordGuideVisual, PlatformGuideVisual } from "@/components/home-guide-visuals";
import { HomeIntroVideo } from "@/components/home-intro-video";
import { PageContainer } from "@/components/page-container";
import { decideDailyHomeVideoFromBrowser, seoulDateKey } from "@/lib/home-intro-video-policy";
import "./home-hero.css";

const SLIDE_DURATION_MS = 9000;
const HOME_SLIDES = [
  { id: "intro", label: "LabBridge 소개", eyebrow: "RESEARCH × AI × COLLABORATION", firstLine: "연구의 질문이", secondLine: "AI와 만나는 곳,", accent: "", body: "실제 연구사례와 최신 기술 동향을 통해 내 연구에 맞는 AI 아이디어를 발견하고, 함께할 AI 전문가를 찾아보세요." },
  { id: "platform", label: "플랫폼 이용 안내", eyebrow: "GET STARTED WITH LABBRIDGE", firstLine: "연구의 시작부터", secondLine: "협업의 완성까지", accent: "", body: "인사이트에서 가능성을 발견하고, 내 연구에 맞는 전문가와 연결되세요. 함께할 팀을 만나 프로젝트를 이어갑니다." },
  { id: "discord", label: "Discord 이용 안내", eyebrow: "YOUR COLLABORATION SPACE", firstLine: "함께하는 연구의 현장,", secondLine: "Discord로 이어집니다.", accent: "", body: "프로젝트의 대화와 협업이 이어지는 공간. 챗봇과 Google Calendar의 연결로 연구 논의와 일정이 한 흐름으로 이어집니다." },
] as const;

function slideVisual(slideId: (typeof HOME_SLIDES)[number]["id"], introVisual: ReactNode): ReactNode {
  if (slideId === "intro") return introVisual;
  if (slideId === "platform") return <PlatformGuideVisual />;
  return <DiscordGuideVisual />;
}

/** 홈의 전환만 담당합니다. 소개 사진은 서버에서 만든 ReactNode로 전달받습니다. */
export function HomeHero({ introVisual }: { introVisual: ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoSession, setVideoSession] = useState(0);
  const [autoplayVideo, setAutoplayVideo] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  // 영상이 켜져 있으면 9초 배너 타이머는 멈춥니다. 페이지를 연 시각의 날짜만 사용합니다.
  const isRunning = !showVideo && !userPaused && !tabHidden;

  useEffect(() => {
    const syncVisibility = () => setTabHidden(document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    const decision = decideDailyHomeVideoFromBrowser();
    setEntryDate(decision.today);
    if (!decision.show) return undefined;
    const openDailyVideo = () => {
      setAutoplayVideo(true);
      setShowVideo(true);
    };
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", onVisible);
        openDailyVideo();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
    openDailyVideo();
    return undefined;
  }, []);

  // 진행 막대는 장식입니다. 실제 전환은 타이머가 맡아서, 마우스가 배너 위에 있어도 넘어갑니다.
  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % HOME_SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isRunning]);

  function selectSlide(index: number): void {
    setShowVideo(false);
    setAutoplayVideo(false);
    setActiveIndex((index + HOME_SLIDES.length) % HOME_SLIDES.length);
  }

  function openVideo(): void {
    setEntryDate((current) => current || seoulDateKey(new Date()));
    setVideoSession((current) => current + 1);
    setAutoplayVideo(true);
    setShowVideo(true);
  }

  function finishVideo(): void {
    setShowVideo(false);
    setAutoplayVideo(false);
    setActiveIndex(0);
  }

  function handleFocus(event: FocusEvent<HTMLElement>): void {
    const cameFromOutside = !event.currentTarget.contains(event.relatedTarget as Node | null);
    if (cameFromOutside && event.target instanceof Element && event.target.matches(":focus-visible")) setUserPaused(true);
  }

  return (
    <section aria-label="LabBridge 소개와 이용 안내" aria-roledescription="carousel" onFocus={handleFocus}>
      <h1 className="sr-only">LabBridge · 연구의 질문이 AI와 만나는 곳</h1>
      <PageContainer className="home-hero">
        {/* 영상은 순환 밖입니다. 끝나거나 건너뛰면 소개 화면부터 세 배너만 다시 돕니다. */}
        {showVideo ? (
          <HomeIntroVideo key={videoSession} playedOn={entryDate} autoplay={autoplayVideo} onFinish={finishVideo} />
        ) : (
        <div className="home-hero__slides" aria-live={isRunning ? "off" : "polite"}>
          {HOME_SLIDES.map((slide, index) => (
            <div key={slide.id} className="home-hero__slide" data-home-slide={slide.id} data-active={activeIndex === index} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${HOME_SLIDES.length}: ${slide.label}`} aria-hidden={activeIndex !== index}>
              <div className="home-hero__copy">
                <p className="home-hero__eyebrow">{slide.eyebrow}</p>
                <h2 className="home-hero__title">{slide.firstLine}<br /><span className={slide.id === "intro" ? undefined : "text-brand"}>{slide.secondLine}</span>{slide.id === "intro" ? <span className="mt-3 block"><BrandWordmark variant="hero" height={56} priority className="h-10 w-auto md:h-14" /></span> : slide.accent ? <span className="text-brand">{slide.accent}</span> : null}</h2>
                <p className="home-hero__description">{slide.body}</p>
                {slide.id === "intro" ? (
                  <Link href="#paths" className="home-hero__cta">지금 시작하기 <span aria-hidden="true">→</span></Link>
                ) : (
                  // 팀원이 문서를 준비하기 전에는 클릭되지 않는 가짜 링크를 만들지 않습니다.
                  <p className="home-hero__manual"><span>상세 매뉴얼 준비 중</span> 자세한 이용 방법은 FAQ에서 만나요.</p>
                )}
              </div>
              <div className="home-hero__intro-art">
                {slideVisual(slide.id, introVisual)}
              </div>
            </div>
          ))}
        </div>
        )}
        <div className="home-hero__controls">
          <div className="home-hero__choices" role="group" aria-label="홈 소개 화면 선택">
            <button type="button" onClick={openVideo} aria-current={showVideo ? "true" : undefined} className="home-hero__choice">
              <span>영상</span>
            </button>
            {HOME_SLIDES.map((slide, index) => (
              <button key={slide.id} type="button" onClick={() => selectSlide(index)} aria-current={!showVideo && activeIndex === index ? "true" : undefined} className="home-hero__choice">
                <span className="home-hero__choice-number">0{index + 1}</span><span>{slide.label}</span>
                <span key={activeIndex === index ? `active-${index}` : "idle"} className="home-hero__progress" data-running={isRunning && activeIndex === index} style={{ "--home-slide-duration": `${SLIDE_DURATION_MS}ms` } as CSSProperties} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="home-hero__navigation">
            <button type="button" aria-label="이전 홈 소개" onClick={() => selectSlide(activeIndex - 1)}>←</button>
            <span className="home-hero__count" aria-hidden="true">{showVideo ? "영상" : `0${activeIndex + 1}`} <i>/</i> 03</span>
            <button type="button" aria-label="다음 홈 소개" onClick={() => selectSlide(activeIndex + 1)}>→</button>
            <button type="button" aria-label={userPaused ? "홈 소개 자동 넘김 재생" : "홈 소개 자동 넘김 일시정지"} onClick={() => setUserPaused((current) => !current)}><span aria-hidden="true">{userPaused ? "▶" : "Ⅱ"}</span></button>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
