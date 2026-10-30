import type { ReactNode } from "react";

type GuideIconName = "insight" | "experts" | "match" | "project" | "bot" | "calendar";

/** 안내 그림은 SVG와 HTML로 만들어 작은 화면에서도 글자가 선명하게 유지됩니다. */
function GuideIcon({ name }: { name: GuideIconName }) {
  const paths: Record<GuideIconName, ReactNode> = {
    insight: <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM13 7a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2" /><path d="M7 8h3M7 12h3M16 8h2M16 12h2" /></>,
    experts: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5" /></>,
    match: <><path d="m3 10 5-5 4 2 4-2 5 5-6 8h-5zM8 5l-5 5M16 5l5 5M8 12l4-4 4 4-4 5M6 14l5 5 2-1" /></>,
    project: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18m-13 5 3 3 5-5" /></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M2 12v4M22 12v4M9 16h6" /><circle cx="9" cy="12" r=".6" /><circle cx="15" cy="12" r=".6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h2M8 18h3" /></>,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

// 프로필 설정 화면과 같은 Discord 심볼입니다. 새 로고 이미지를 내려받지 않습니다.
function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.5.3 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.9 19.9 0 0 0 6-3c.4-5.2-.7-9.7-3.6-13.6ZM8.7 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}

const PLATFORM_STEPS: { icon: GuideIconName; title: string; summary: string }[] = [
  { icon: "insight", title: "인사이트", summary: "AI 활용의 힌트 발견" },
  { icon: "experts", title: "전문가 찾기", summary: "함께할 사람 탐색" },
  { icon: "match", title: "협업 매칭", summary: "요청부터 프로젝트 확정" },
  { icon: "project", title: "프로젝트 진행", summary: "함께 논의하고 연구" },
];

export function PlatformGuideVisual() {
  return (
    <figure className="home-guide home-guide--process" aria-label="인사이트에서 전문가를 찾고 협업 매칭을 거쳐 프로젝트를 진행하는 이용 흐름">
      <div className="home-guide__eyebrow"><span /> YOUR RESEARCH JOURNEY</div>
      <p className="home-guide__lead">하나의 아이디어가, 함께하는 연구로.</p>
      <ol className="home-process">
        {PLATFORM_STEPS.map((step, index) => (
          <li key={step.icon}>
            <span className="home-process__number">0{index + 1}</span>
            <div className="home-process__icon"><GuideIcon name={step.icon} /></div>
            <strong>{step.title}</strong><p>{step.summary}</p>
            {index < PLATFORM_STEPS.length - 1 ? <span className="home-process__arrow" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>
      <figcaption className="home-process__caption"><span>협업의 시작</span><p>협업 요청 <i aria-hidden="true">→</i> 검토·협의 <i aria-hidden="true">→</i> <strong>프로젝트 확정</strong></p></figcaption>
    </figure>
  );
}

export function DiscordGuideVisual() {
  return (
    <figure className="home-guide home-guide--discord" aria-label="Discord 프로젝트 채널을 중심으로 챗봇과 Google Calendar가 연결되는 협업 공간 개념도">
      <div className="home-discord">
        <div className="home-discord__header"><span className="home-discord__mark"><DiscordMark /></span><strong>Discord</strong><span>함께하는 연구 공간</span></div>
        <div className="home-discord__body">
          <div className="home-discord__channels" aria-hidden="true"><p>PROJECT</p><span># 프로젝트 안내</span><span className="home-discord__selected"># 연구 논의</span><span># 일정 공유</span></div>
          <div className="home-discord__conversation">
            <p className="home-discord__channel"><span>#</span> 프로젝트 채널</p>
            <p className="home-discord__message">아이디어를 나누고</p>
            <p className="home-discord__message home-discord__message--reply">함께 다음 연구를 준비해요.</p>
            <p className="home-discord__hint">대화 · 협업 · 일정, 한 흐름으로</p>
          </div>
        </div>
      </div>
      <div className="home-discord__connections">
        <div><span className="home-discord__tool-icon"><GuideIcon name="bot" /></span><p><strong>챗봇</strong><span>협업 보조</span></p></div>
        <div><span className="home-discord__tool-icon"><GuideIcon name="calendar" /></span><p><strong>Google Calendar</strong><span>프로젝트 일정 연결</span></p></div>
      </div>
      <figcaption className="home-discord__caption">연결 구조 예시 · 실제 채널 화면이 아닙니다.</figcaption>
    </figure>
  );
}
