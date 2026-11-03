"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { writeHomeVideoRecord } from "@/lib/home-intro-video-policy";

const VIDEO_SRC = "/generated/labbridge-intro-55s.mp4";
const POSTER_SRC = "/generated/labbridge-hero-v1.jpg";
// 터치로 탭한 뒤 버튼을 또렷하게 보여 주는 시간입니다.
const CONTROLS_REVEAL_MS = 3000;

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" /></svg>;
}

function PauseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" fill="currentColor" /></svg>;
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4v-5Z" fill="currentColor" />
      {muted ? <path d="M16 9.2 20.8 14m0-4.8L16 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <path d="M15.5 9.2a3.6 3.6 0 0 1 0 5.6M17.8 7a6.2 6.2 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

function SkipIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.2 13.2 12 5 17.8V6.2ZM15 6h3.2v12H15V6Z" fill="currentColor" /></svg>;
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M4.5 4.5v4.2h4.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

/** 배너 영상을 재생합니다. 9초 슬라이드 타이머와는 따로 둡니다. */
export function HomeIntroVideo({
  playedOn,
  autoplay,
  onFinish,
}: {
  playedOn: string;
  autoplay: boolean;
  onFinish: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rememberedRef = useRef(false);
  const userPausedRef = useRef(false);
  const resumeOnVisibleRef = useRef(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const [controlsRevealed, setControlsRevealed] = useState(false);
  const revealTimerRef = useRef<number | undefined>(undefined);
  const blockNextClickRef = useRef(false);
  // 재생 중에만 버튼을 흐리게 해 영상에 시선이 가게 합니다. 멈춤·끝·오류·탭 직후에는 또렷하게 둡니다.
  const dimControls = !paused && !blocked && !ended && !failed && !controlsRevealed;

  /** 휴대폰에는 hover가 없으므로, 영상을 탭하면 버튼을 잠깐 또렷하게 보여 줍니다. */
  function revealControlsOnTouch(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "mouse") return;
    // 흐린 버튼을 탭하면 그 탭은 보여 주기만 합니다. 버튼 동작은 또렷해진 뒤 다음 탭부터입니다.
    blockNextClickRef.current = dimControls && event.target instanceof Element && event.target.closest("button") !== null;
    window.clearTimeout(revealTimerRef.current);
    setControlsRevealed(true);
    revealTimerRef.current = window.setTimeout(() => {
      blockNextClickRef.current = false;
      setControlsRevealed(false);
    }, CONTROLS_REVEAL_MS);
  }

  /** capture 단계라 버튼의 onClick보다 먼저 실행되어, 첫 탭의 클릭을 버튼까지 보내지 않습니다. */
  function blockRevealTapClick(event: MouseEvent<HTMLDivElement>): void {
    if (!blockNextClickRef.current) return;
    blockNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function rememberWatch(): void {
    if (rememberedRef.current || !playedOn) return;
    rememberedRef.current = true;
    writeHomeVideoRecord(window.localStorage, playedOn);
  }

  function playFromGesture(): void {
    const video = videoRef.current;
    if (!video || failed) return;
    userPausedRef.current = false;
    setBlocked(false);
    video.muted = muted;
    void video.play().catch(() => setBlocked(true));
  }

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video || failed) return;
    if (video.paused) playFromGesture();
    else {
      userPausedRef.current = true;
      resumeOnVisibleRef.current = false;
      video.pause();
    }
  }

  function toggleMuted(): void {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function replayFromStart(): void {
    const video = videoRef.current;
    if (!video || failed) return;
    video.currentTime = 0;
    playFromGesture();
  }

  /** 건너뛰기와 (영상이 끝난 뒤의) 닫기가 같은 방식으로 영상을 닫습니다. */
  function skip(): void {
    if (!failed) rememberWatch();
    onFinish();
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoplay || failed) return undefined;
    video.muted = true;
    const pending = video.play();
    if (!pending) return undefined;
    pending.catch(() => setBlocked(true));
    return undefined;
  }, [autoplay, failed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const onVisibility = () => {
      if (document.hidden) {
        if (!video.paused && !userPausedRef.current) {
          resumeOnVisibleRef.current = true;
          video.pause();
        }
        return;
      }
      if (resumeOnVisibleRef.current && !userPausedRef.current) {
        resumeOnVisibleRef.current = false;
        void video.play().catch(() => setBlocked(true));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // 영상을 닫은 뒤 남은 타이머가 상태를 바꾸지 않도록 정리합니다.
  useEffect(() => () => window.clearTimeout(revealTimerRef.current), []);

  return (
    <div className="home-hero__video-stage">
      <div className="home-hero__video-frame" onPointerDown={revealControlsOnTouch}>
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          playsInline
          preload="metadata"
          onPlay={() => {
            setPaused(false);
            setEnded(false);
          }}
          onPause={() => setPaused(true)}
          onPlaying={rememberWatch}
          onEnded={() => {
            // 끝나도 닫지 않고 마지막 화면에 머뭅니다. 다시보기나 닫기는 사용자가 고릅니다.
            rememberWatch();
            setEnded(true);
          }}
          onError={() => setFailed(true)}
        />
        <div className="home-hero__video-bar" data-dimmed={dimControls} onClickCapture={blockRevealTapClick}>
          <button type="button" className="home-hero__video-icon" aria-label={paused || blocked ? "재생" : "일시정지"} onClick={togglePlay} disabled={failed}>{paused || blocked ? <PlayIcon /> : <PauseIcon />}</button>
          <button type="button" className="home-hero__video-icon" aria-label="처음부터 다시보기" onClick={replayFromStart} disabled={failed}><ReplayIcon /></button>
          <button type="button" className="home-hero__video-icon" aria-label={muted ? "소리 켜기" : "소리 끄기"} aria-pressed={!muted} onClick={toggleMuted}><SoundIcon muted={muted} /></button>
          <button type="button" className="home-hero__video-icon" aria-label={ended ? "닫기" : "건너뛰기"} onClick={skip}>{ended ? <CloseIcon /> : <SkipIcon />}</button>
        </div>
      </div>
      {failed ? <p className="home-hero__video-status">영상을 재생하지 못했습니다. 안내 화면으로 돌아갈 수 있습니다.</p> : null}
      <p className="home-hero__video-credit">
        Music: Bensound
        <br />
        Artist: Benjamin Tissot
        <br />
        License code: CXLAPYSMSXVMMJQM
      </p>
    </div>
  );
}
