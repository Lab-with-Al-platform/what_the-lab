"use client";

import { useState } from "react";

interface InterviewSlide {
  quote: string;
  body: string;
  who: string;
  place: string;
}

const SLIDES: InterviewSlide[] = [
  {
    quote: "“라벨링에 쓰던 시간을 실험에 더 투자할 수 있었습니다.”",
    body: "세포 사진 수천 장을 일일이 분류하다가 1년 가까이가 걸리던 작업이 AI 전문가와의 협업으로 자동화되고, 새로운 실험에 집중할 수 있게 되었습니다.",
    who: "세포생물학 연구실 연구원",
    place: "국내 대학 · 예시 인터뷰",
  },
  {
    quote: "“모델 결과보다, 어떤 사진을 보여 줘야 하는지가 먼저였습니다.”",
    body: "전문가와 맞춘 뒤에는 정확도 숫자보다 염색이 다른 사진을 얼마나 구분할지 실험 노트로 남기게 되었습니다.",
    who: "재료공학 연구실 대학원생",
    place: "국내 대학 · 예시 인터뷰",
  },
  {
    quote: "“논문 요약을 맡긴 뒤에도 인용은 직접 열어 봅니다.”",
    body: "느린 문헌 정리를 줄이는 데는 도움이 됐고, 없는 참고문헌이 생기지 않는지 확인하는 시간은 그대로 두었습니다.",
    who: "환경공학 연구실 연구원",
    place: "국내 대학 · 예시 인터뷰",
  },
];

/**
 * 인터뷰 상세 페이지는 아직 없습니다.
 * 좌우 이동만 되고, ‘인터뷰 더 보기’는 눌리지 않는 자리표시입니다.
 */
export function InterviewPanel() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0];
  const total = SLIDES.length;

  function move(step: number) {
    setIndex((current) => (current + step + total) % total);
  }

  return (
    <aside className="rounded-card border border-line bg-[linear-gradient(135deg,#f7f5ff_0%,#f4f2ff_100%)] p-6 text-ink" aria-labelledby="interview-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="interview-heading" className="text-sm font-semibold">
          연구자 인터뷰
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-faint" onClick={() => move(-1)}>
            <span className="sr-only">이전 인터뷰</span>←
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-ink" onClick={() => move(1)}>
            <span className="sr-only">다음 인터뷰</span>→
          </button>
        </div>
      </div>
      <blockquote className="mt-5 text-[19px] leading-snug font-bold tracking-tight">{slide.quote}</blockquote>
      <p className="mt-3 text-xs leading-5 text-muted">{slide.body}</p>
      <p className="mt-5 text-sm font-semibold">{slide.who}</p>
      <p className="text-xs text-muted">{slide.place}</p>
      <p className="mt-5 inline-flex border-b border-brand pb-0.5 text-sm font-semibold text-brand">
        인터뷰 더 보기 →
        <span className="sr-only">상세 페이지는 아직 없어서 이동하지 않습니다.</span>
      </p>
    </aside>
  );
}
