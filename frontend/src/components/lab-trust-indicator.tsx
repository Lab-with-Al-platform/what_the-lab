"use client";

import { useId } from "react";
import type { ReputationSnapshot } from "@/lib/reviews";

type Variant = "compact" | "featured" | "profile";

function indexColor(score: number | null, demo: boolean) {
  if (demo) return { from: "#8271f6", to: "#48c4d5", stroke: "#615dd6", bubble: "#f1fbff" };
  if (score === null) return { from: "#ced5e6", to: "#e2e7f3", stroke: "#a2adc6", bubble: "#ffffff" };
  if (score >= 80) return { from: "#0faaa0", to: "#75dcd2", stroke: "#207f8b", bubble: "#ebfffc" };
  if (score >= 65) return { from: "#6269e4", to: "#a5a2ff", stroke: "#6867bd", bubble: "#f3f1ff" };
  return { from: "#c08a51", to: "#f4c996", stroke: "#a0784a", bubble: "#fff8ee" };
}

function FlaskArt({ fill, demo, color, size }: {
  fill: number | null;
  demo: boolean;
  color: ReturnType<typeof indexColor>;
  size: number;
}) {
  const uid = useId().replace(/:/g, "");
  const clipId = "lab-flask-clip-" + uid;
  const fillId = "lab-flask-liquid-" + uid;
  const glassId = "lab-flask-glass-" + uid;
  const available = fill !== null;
  const fraction = available ? Math.max(0, Math.min(100, fill!)) / 100 : 0;
  const y = 148 - fraction * 124;
  return (
    <svg viewBox="0 0 144 168" width={size} height={Math.round(size * 1.167)}
      className="block shrink-0 overflow-visible" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <path d="M62 22 V65 L23 135 Q17 148 33 148 H111 Q127 148 121 135 L82 65 V22 Z" />
        </clipPath>
        <linearGradient id={fillId} x1="0" x2="0.95" y1="1" y2="0">
          <stop offset="0%" stopColor={color.from}/>
          <stop offset="100%" stopColor={color.to}/>
        </linearGradient>
        <linearGradient id={glassId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fcfdff" stopOpacity=".97"/>
          <stop offset="57%" stopColor="#f3f7ff" stopOpacity=".38"/>
          <stop offset="100%" stopColor="#d8e5fc" stopOpacity=".24"/>
        </linearGradient>
      </defs>
      <ellipse cx="72" cy="148.2" rx="48" ry="5" fill="#7b8eab" opacity=".14"/>
      <path d="M61 15 H83 V65 L20 135 Q13 151 31 154 H113 Q131 151 124 135 L81 65 V15"
        fill={`url(#${glassId})`} stroke="#9eaaca" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      <g clipPath={`url(#${clipId})`}>
        {available && (
          <>
            <path d={`M10 ${y} C29 ${y-4} 46 ${y+5} 68 ${y} S108 ${y-5} 134 ${y+2} V165 H10 Z`}
              fill={`url(#${fillId})`} opacity=".95"/>
            <path d={`M12 ${y} C34 ${y-4} 47 ${y+4} 69 ${y} S107 ${y-5} 133 ${y+2}`}
              fill="none" stroke="#ffffff" strokeOpacity=".58" strokeWidth="2.3"/>
            {fraction > .24 && <>
              <circle cx="45" cy="124" r="3.2" fill={color.bubble} opacity=".7"/>
              <circle cx="93" cy="132" r="2.3" fill={color.bubble} opacity=".65"/>
              <circle cx="71" cy="112" r="4.1" fill={color.bubble} opacity=".32"/>
            </>}
            {fraction > .58 && <>
              <circle cx="54" cy="82" r="2.5" fill={color.bubble} opacity=".75"/>
              <circle cx="98" cy="101" r="3.3" fill={color.bubble} opacity=".5"/>
            </>}
          </>
        )}
      </g>
      <path d="M62 15 H82 M59 19 H85" stroke="#526988" strokeWidth="3.2" strokeLinecap="round"/>
      <path d="M56 79 L29 135" stroke="#ffffff" strokeWidth="4" opacity=".62" strokeLinecap="round"/>
      <path d="M87 79 L115 135" stroke="#ffffff" strokeWidth="2.2" opacity=".4" strokeLinecap="round"/>
      <path d="M34 139 L43 139 M104 139 L111 139" stroke="#6b819f" opacity=".32" strokeLinecap="round"/>
      {demo && <path d="M118 19 l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5Z"
        fill="#a6a2eb" opacity=".8" />}
    </svg>
  );
}

/**
 * LAB TRUST: verified subjective cooperation feedback, never a licence or ID badge.
 * Score=null is genuinely insufficient evidence, not zero. undefined is loading,
 * null snapshot signals data-unavailable, not an unscored expert.
 * A fake preview can be passed only from local-demo guarded code.
 */
export function LabTrustIndicator({
  snapshot, variant = "compact", demoPreview,
}: {
  snapshot?: ReputationSnapshot | null;
  variant?: Variant;
  demoPreview?: number | null;
}) {
  const demo = demoPreview !== null && demoPreview !== undefined;
  const isLoading = snapshot === undefined && !demo;
  const unavailable = snapshot === null && !demo;
  const established = !demo && snapshot?.state === "established" && snapshot.score !== null;
  const score = demo ? Math.max(0, Math.min(100, Math.round(demoPreview!))) :
    established ? snapshot!.score : null;
  const palette = indexColor(score, demo);
  const label = demo ? "시연용 플라스크" : unavailable ? "신뢰 지수 조회 불가" :
    isLoading ? "신뢰 지수 확인 중" : established ? snapshot!.level : "평가 축적 중";
  const isCompact = variant === "compact";
  const size = isCompact ? 43 : variant === "featured" ? 61 : 101;
  const subtitle = established
    ? `완료 협업 평가 ${snapshot!.review_count}건 · 연구자 ${snapshot!.reviewer_count}명`
    : demo ? "LOCAL DEMO · 실제 지수가 아닙니다"
    : unavailable ? "평가 데이터를 확인할 수 없어요"
    : isLoading ? "검증된 평가 데이터를 확인 중"
    : snapshot
      ? `반영 평가 ${snapshot.review_count}건 / 최소 ${snapshot.minimum_reviews}건 · 연구자 ${snapshot.reviewer_count}/${snapshot.minimum_reviewers}명`
      : "완료된 협업 평가로 신뢰도를 쌓아요";
  const headline = demo ? "LAB TRUST · 가상 미리보기" : "LAB TRUST";
  const scoreLabel = score !== null ? `${score} / 100` : "미산정";
  const compact = (
    <div className="flex min-w-0 items-center gap-2.5">
      <FlaskArt fill={score} color={palette} demo={demo} size={size}/>
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#69779c]">{headline}</p>
        <p className="mt-0.5 whitespace-nowrap text-[12px] font-extrabold tracking-tight text-[#253b62]">
          {score !== null ? <><span className="text-[17px] tabular-nums">{score}</span><span className="ml-0.5 text-[10px] font-semibold text-[#8993aa]">/100</span></> : label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#7b89a2]">
          {score === null || demo ? subtitle : label}
        </p>
      </div>
    </div>
  );

  if (isCompact) {
    return <div role="group" aria-label={`LAB TRUST: ${label}, ${scoreLabel}. ${subtitle}`}
      className="rounded-xl border border-[#e4eafa] bg-gradient-to-r from-[#f9fbff] to-[#f6fbff] px-2.5 py-2">
      {compact}
    </div>;
  }

  return (
    <section aria-label="LAB TRUST 협업 신뢰 지수" className={
      "relative overflow-hidden rounded-[20px] border border-[#dce7f3] bg-gradient-to-br from-[#f9fbff] via-white to-[#eef9f8] " +
      (variant === "profile" ? "p-5 shadow-[0_12px_36px_rgba(35,67,108,0.065)]" : "p-3.5")
    }>
      <div className="pointer-events-none absolute -right-12 -top-14 size-36 rounded-full bg-[#8fd0dd]/10 blur-2xl" aria-hidden="true"/>
      <div className="relative flex items-center gap-3">
        <div className="shrink-0 rounded-2xl border border-white/85 bg-white/50 px-1.5 py-1">
          <FlaskArt fill={score} color={palette} demo={demo} size={size}/>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold tracking-[0.13em] text-[#5072a4]">{headline}</p>
          <p className="mt-1.5 text-[12px] font-semibold text-[#536888]">협업 신뢰 지수</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
            {score !== null ? (
              <><strong className="text-[31px] font-extrabold tabular-nums tracking-[-0.045em] text-[#233a5b]">{score}</strong>
                <span className="text-[12px] font-bold text-[#8997ae]">/100</span></>
            ) : <strong className="text-[20px] font-extrabold tracking-tight text-[#435477]">{label}</strong>}
          </div>
          {score !== null && !demo && <p className="mt-0.5 text-xs font-bold text-[#287b87]">{label}</p>}
          <p className="mt-2 text-[11px] leading-[18px] text-[#697b95]">{subtitle}</p>
        </div>
      </div>
      {variant === "profile" && (
        <div className="relative mt-4 border-t border-[#e4ecf3] pt-3">
          <p className="text-[11px] leading-[19px] text-[#64768e]">
            단순 접속·응답 속도가 아닌, <strong className="text-[#3d587a]">플랫폼상 정상 종료된 협업의 연구회원 평가</strong>로 계산해요.
            종료 상태는 일정 기준으로 자동 확정될 수 있어, 신원·자격증·연구 결과물의 외부 검증이나 협업 성공 보장을 의미하지 않습니다.
          </p>
          <details className="group mt-3 rounded-xl bg-white/80 px-3 py-3 text-[11px] text-[#536783] open:ring-1 open:ring-[#d6e3f3]">
            <summary className="cursor-pointer font-bold text-[#496ca3] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[#5d80cd]">
              점수 계산 원칙과 신규 전문가 보호 기준 보기
            </summary>
            <div className="mt-3 space-y-2 border-t border-[#e6ecf6] pt-3 leading-5">
              <p>정상 종료 후 7일이 지난 연구회원 평가만 반영합니다. 중도 종료·비공개 처리된 후기는 제외해요.</p>
              <p>전문성 30% · 결과물 품질 35% · 소통 20% · 일정 준수 15%를 반영합니다.</p>
              <p><strong>최소 3건·서로 다른 연구자 2명</strong>이 되기 전에는 점수를 표시하지 않아요. 동일 연구자의 최근 평가 최대 3건까지만 반영해요.</p>
              <p>초기 소수 평가의 급격한 변동을 줄이기 위해 3.8점 기준값과 가상 표본 5건을 계산상 적용합니다. <strong>가상의 후기를 생성하는 것은 아닙니다.</strong></p>
              <p>신규 회원이나 평가가 부족한 회원을 0점으로 취급하지 않고, 검색 순위에도 이 점수를 사용하지 않습니다.</p>
            </div>
          </details>
          <a href="/faq#lab-trust" className="mt-2 inline-flex min-h-9 items-center text-[11px] font-semibold text-[#466bae] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#5d80cd]">LAB TRUST 자주 묻는 질문 보기</a>
        </div>
      )}
    </section>
  );
}
