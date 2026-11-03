"use client";

import type { ReactNode } from "react";

function GuidePhoto({ src, objectPosition }: { src: string; objectPosition: string }) {
  // 원본이 1024px입니다. 최적화 서버가 더 큰 크기로 늘리면 더 흐려져서 파일을 그대로 씁니다.
  return (
    <div className="home-hero__guide-photo">
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition }}
      />
      <div className="home-hero__guide-fade" />
    </div>
  );
}

function HeroNote({
  className,
  title,
  body,
}: {
  className: string;
  title: string;
  body: string;
}) {
  return (
    <div className={`home-hero__note ${className}`}>
      <p className="home-hero__note-title">{title}</p>
      <p className="home-hero__note-body">{body}</p>
    </div>
  );
}

function GuideCollage({
  label,
  src,
  objectPosition,
  children,
}: {
  label: string;
  src: string;
  objectPosition: string;
  children: ReactNode;
}) {
  return (
    <div className="home-hero__collage home-hero__collage--guide" aria-label={label}>
      <GuidePhoto src={src} objectPosition={objectPosition} />
      <div className="home-hero__guide-notes">{children}</div>
    </div>
  );
}

export function PlatformGuideVisual() {
  return (
    <GuideCollage
      label="인사이트에서 전문가를 찾고 협업 매칭을 거쳐 프로젝트를 진행하는 이용 흐름"
      src="/generated/labbridge-platform-guide-v1.jpg"
      objectPosition="72% center"
    >
      <HeroNote className="home-hero__note--platform-insight" title="인사이트" body="사례와 트렌드에서 힌트를 얻어요" />
      <HeroNote className="home-hero__note--platform-experts" title="전문가 찾기" body="연구에 맞는 파트너를 찾아요" />
      <HeroNote className="home-hero__note--platform-match" title="협업 매칭" body="협업 요청부터 프로젝트 확정까지" />
    </GuideCollage>
  );
}

export function DiscordGuideVisual() {
  return (
    <GuideCollage
      label="Discord 협업 채널을 중심으로 챗봇과 Google Calendar가 연결되는 협업 공간 개념도"
      src="/generated/labbridge-discord-guide-v1.jpg"
      objectPosition="78% center"
    >
      <HeroNote className="home-hero__note--discord-bot" title="챗봇" body="채널에서 요청을 남겨요" />
      <HeroNote className="home-hero__note--discord-channel" title="협업 채널" body="두 사람만 보이는 공간" />
      <HeroNote className="home-hero__note--discord-cal" title="Google Calendar" body="LabBridge 일정을 복사해요" />
    </GuideCollage>
  );
}
