"use client";

import { useState } from "react";
import { photoOrDefault, shortPeriod } from "@/lib/collab-requests";
import { Collaboration, ddayText, progress, toneOf } from "@/lib/workspace";
import { Avatar, StatusBadge } from "@/components/request-parts";

const FOLDED = 3; // 처음에는 3개까지만, 나머지는 [n개 더 보기]

/**
 * 맨 위 "내 협업" 목록. 한 줄에 협업 하나를 가로로 길게, 높이는 낮게 보여 줘요.
 * 1개면 1줄, 여러 개면 아래로 쌓이고 3개가 넘으면 접어요.
 * 색 네모 = 달력에서 이 협업 일정의 색. 협업이 2개 이상이면 눌러서 달력에서 끄고 켤 수 있어요.
 * 오른쪽 [💬 디스코드] = 둘만의 비공개 채널로 바로 가기
 */
export function CollabList({
  collabs,
  hidden,
  today,
  onToggle,
}: {
  collabs: Collaboration[];
  hidden: number[]; // 달력에서 끈 협업 번호
  today: string;
  onToggle: (id: number) => void;
}) {
  const [all, setAll] = useState(false);
  const canToggle = collabs.length > 1;
  const shown = all ? collabs : collabs.slice(0, FOLDED);

  return (
    <section className="mt-5 rounded-card border border-line bg-card shadow-card">
      <ul>
        {shown.map((collab) => (
          <Row
            key={collab.collaboration_id}
            collab={collab}
            today={today}
            off={hidden.includes(collab.collaboration_id)}
            canToggle={canToggle}
            onToggle={() => onToggle(collab.collaboration_id)}
          />
        ))}
      </ul>
      {collabs.length > FOLDED && (
        <button type="button" onClick={() => setAll((value) => !value)} className="w-full border-t border-line py-2.5 text-[13px] font-semibold text-brand hover:bg-page">
          {all ? "접기" : `${collabs.length - FOLDED}개 더 보기`}
        </button>
      )}
    </section>
  );
}

function Row({
  collab,
  today,
  off,
  canToggle,
  onToggle,
}: {
  collab: Collaboration;
  today: string;
  off: boolean;
  canToggle: boolean;
  onToggle: () => void;
}) {
  const tone = toneOf(collab.collaboration_id);
  const waiting = collab.status === "waiting";
  const swatch = `block h-3.5 w-3.5 shrink-0 rounded ${off ? "border-2 border-line bg-card" : tone.dot}`;

  return (
    <li className="flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:items-center sm:gap-4 sm:px-5">
      {canToggle ? (
        <button type="button" onClick={onToggle} aria-pressed={!off} title={off ? "달력에 다시 보이기" : "달력에서 잠깐 숨기기"} className="p-1">
          <span className={swatch} />
        </button>
      ) : (
        <span className={`m-1 ${swatch}`} aria-hidden="true" />
      )}

      {/* 넓은 화면: 한 줄로 [제목 | 상태 | D-day | 버튼] / 모바일: 제목 아래에 [D-day ... 버튼] */}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-bold ${off ? "text-faint" : ""}`}>{collab.research.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            <Avatar src={photoOrDefault(collab.partner.user_photo, collab.partner.role)} size={16} />
            {collab.partner.nickname} 님과 1:1 · {shortPeriod(collab.start_date, collab.end_date)}
          </p>
        </div>

        {/* 상태 (넓은 화면에서만) */}
        <div className="hidden w-36 shrink-0 md:block">
          {waiting ? (
            <StatusBadge tone="danger">시작 전</StatusBadge>
          ) : (
            <div title={`${progress(collab, today)}% 지났어요`}>
              <StatusBadge tone="brand">진행 중</StatusBadge>
              <div className="mt-1.5 h-1 rounded-full bg-page">
                <div className={`h-1 rounded-full ${tone.dot}`} style={{ width: `${progress(collab, today)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 sm:mt-0 sm:justify-end">
          <span className={`text-[13px] font-bold sm:w-16 sm:text-right ${tone.text}`}>{ddayText(collab, today)}</span>
          {/* TODO(협업 상세): [상세 ›] 링크 */}
          <div className="sm:w-[104px] sm:text-right">
            {collab.discord_channel_url ? (
              <a
                href={collab.discord_channel_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-button bg-[#5865F2] px-3 text-[13px] font-semibold text-white hover:opacity-90"
              >
                💬 디스코드
              </a>
            ) : (
              <span title="협업을 확정하면 몇 초 안에 둘만의 채널이 생겨요" className="text-xs text-faint">
                채널 준비 중
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}