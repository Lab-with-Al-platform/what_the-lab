"use client";

import { API_BASE_URL } from "@/lib/api";
import { addDays, daysBetween, photoOrDefault } from "@/lib/collab-requests";
import { Schedule } from "@/lib/workspace";
import { CollaborationDetail, periodHeadline, ROLE_LABELS } from "@/lib/workspace-detail";
import { fieldName } from "@/lib/taxonomy-options";
import { Avatar } from "@/components/request-parts";

const STATUS = {
  waiting: { text: "진행 전", className: "bg-editorial-warning-soft text-editorial-warning" },
  active: { text: "진행 중", className: "bg-brand-soft text-brand" },
  done: { text: "완료", className: "bg-success-soft text-success" },
  ended_early: { text: "중단", className: "bg-page text-muted" },
  canceled: { text: "취소", className: "bg-page text-muted" },
} as const;

/** 머리: 상태 · 분야 · 제목 · 두 사람 · [디스코드 채널] [구글 캘린더] + 아래에 협업 기간 타임라인 */
export function DetailHead({ detail }: { detail: CollaborationDetail }) {
  const { collaboration: collab, agreement } = detail;
  const status = STATUS[collab.status];
  const field = agreement.field_ids?.[0];
  const ended = collab.status !== "waiting" && collab.status !== "active";
  const researcher = collab.my_side === "researcher" ? collab.me : collab.partner;
  const expert = collab.my_side === "expert" ? collab.me : collab.partner;

  return (
    <section className="rounded-card bg-card px-5 pb-5 pt-6 shadow-card sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-[1_1_420px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>{status.text}</span>
            {field && <span className="rounded-full bg-page px-2.5 py-0.5 text-xs font-semibold text-muted">{fieldName(field)}</span>}
          </div>
          <h1 className="mt-2 text-[22px] font-extrabold leading-snug tracking-tight [text-wrap:balance] sm:text-2xl">{collab.research.title}</h1>
          <div className="mt-2.5 flex items-center gap-2.5 text-[13px] text-muted">
            <span className="flex">
              {[researcher, expert].map((person, index) => (
                <span key={person.user_id} className={`rounded-full ring-2 ring-card ${index ? "-ml-2" : ""}`}>
                  <Avatar src={photoOrDefault(person.user_photo, person.role)} size={28} />
                </span>
              ))}
            </span>
            <span className="min-w-0">
              <b className="font-semibold text-ink">{researcher.nickname}</b> {ROLE_LABELS.researcher} · <b className="font-semibold text-ink">{expert.nickname}</b>{" "}
              {ROLE_LABELS.expert}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {collab.discord_channel_url ? (
            <a
              href={collab.discord_channel_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover"
            >
              💬 디스코드 채널
            </a>
          ) : (
            !ended && <span className="inline-flex h-10 items-center px-2 text-xs text-faint">디스코드 채널 준비 중</span>
          )}
          {!ended && <GoogleButton detail={detail} />}
        </div>
      </div>

      <Timeline detail={detail} />
    </section>
  );
}

/** 구글 캘린더: 연결했으면 [구글 캘린더에서 보기], 아직이면 [내 구글 캘린더에 추가] (서버에 구글 설정이 없으면 숨김) */
function GoogleButton({ detail }: { detail: CollaborationDetail }) {
  const { collaboration: collab } = detail;
  if (!detail.google_enabled) return null;
  const className = "inline-flex h-10 items-center gap-1.5 rounded-button border border-line bg-card px-4 text-[13px] font-semibold hover:bg-page";
  if (collab.google_linked && collab.google_calendar_url) {
    return (
      <a href={collab.google_calendar_url} target="_blank" rel="noreferrer" className={className}>
        📅 구글 캘린더에서 보기
      </a>
    );
  }
  return (
    <a href={`${API_BASE_URL}/google/connect?collaboration_id=${collab.collaboration_id}`} className={className} title="구글 로그인 후 이 협업 일정이 내 구글 캘린더에 보여요 (보기 전용)">
      📅 내 구글 캘린더에 추가
    </a>
  );
}

// ---------------------------------------------------------------------------
// 협업 기간 타임라인: 확정일(또는 시작일) ~ 종료일 한 줄 위에 미팅(●) · 마감(◆) · 작업 기간(막대) · 오늘
// ---------------------------------------------------------------------------

function Timeline({ detail }: { detail: CollaborationDetail }) {
  const { collaboration: collab, schedules } = detail;
  const headline = periodHeadline(collab);
  const from = collab.confirmed_on < collab.start_date ? collab.confirmed_on : collab.start_date;
  const span = Math.max(1, daysBetween(from, collab.end_date));
  const x = (day: string) => Math.max(0, Math.min(100, (daysBetween(from, day) / span) * 100)); // 날짜 → 왼쪽에서 몇 %
  const weeks = Math.max(1, Math.round((daysBetween(collab.start_date, collab.end_date) + 1) / 7));
  const today = collab.today;
  const running = collab.status === "active";
  const thisWeek = running ? Math.floor(daysBetween(collab.start_date, today) / 7) + 1 : null;
  const past = (item: Schedule) => item.end_date < today;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <p className="text-[15px] font-extrabold text-ink">
          {headline ? (
            <>
              {headline.label} <span className="text-brand">{headline.dday}</span>
            </>
          ) : (
            <>{shortDay(collab.end_date)}에 끝났어요</>
          )}
        </p>
        <p>
          {shortDay(collab.start_date)} ~ {shortDay(collab.end_date)} · {thisWeek ? `${thisWeek}주차 / ` : ""}
          {weeks}주
        </p>
      </div>

      <div className="relative mt-3 h-9" aria-hidden="true">
        {/* 확정일 ~ 시작일 사이(준비 기간)는 점선 */}
        {from < collab.start_date && (
          <span className="absolute left-0 top-[17px] h-0.5 border-t-2 border-dashed border-line" style={{ width: `${x(collab.start_date)}%` }} />
        )}
        <span className="absolute right-0 top-4 h-1 rounded-full bg-line" style={{ left: `${x(collab.start_date)}%` }} />
        {running && <span className="absolute top-4 h-1 rounded-full bg-brand" style={{ left: `${x(collab.start_date)}%`, width: `${x(today) - x(collab.start_date)}%` }} />}

        {schedules
          .filter((item) => item.kind === "work")
          .map((item) => (
            <span
              key={item.schedule_id}
              className={`absolute top-[26px] h-1.5 rounded-full bg-collab-6 ${past(item) ? "opacity-35" : ""}`}
              style={{ left: `${x(item.start_date)}%`, width: `${Math.max(1, x(addDays(item.end_date, 1)) - x(item.start_date))}%` }}
            />
          ))}
        {schedules
          .filter((item) => item.kind !== "work")
          .map((item) => (
            <span
              key={item.schedule_id}
              title={`${shortDay(item.start_date)} ${item.title}`}
              className={`absolute top-3 h-3 w-3 -translate-x-1/2 border-2 border-card ${
                item.kind === "due" ? "rotate-45 rounded-[2px] bg-danger" : item.kind === "meeting" ? "rounded-full bg-brand" : "rounded-full bg-faint"
              } ${past(item) ? "opacity-35" : ""}`}
              style={{ left: `${x(item.start_date)}%` }}
            />
          ))}

        {(running || collab.status === "waiting") && (
          <span className="absolute bottom-0 top-0 w-0.5 -translate-x-px rounded bg-ink" style={{ left: `${x(today)}%` }}>
            <span className={`absolute -top-1 whitespace-nowrap text-[11px] font-bold ${x(today) > 85 ? "right-1.5" : "left-1.5"}`}>오늘</span>
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-faint">
        <span>{from < collab.start_date ? `${shortDay(from)} 확정` : `${shortDay(collab.start_date)} 시작`}</span>
        <span className="flex gap-3 text-muted">
          <Legend className="rounded-full bg-brand">미팅</Legend>
          <Legend className="rotate-45 rounded-[1px] bg-danger">마감</Legend>
          <Legend className="h-1.5 w-3 rounded-full bg-collab-6">작업 기간</Legend>
        </span>
        <span>{shortDay(collab.end_date)} 종료</span>
      </div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <i className={`inline-block h-2 w-2 ${className}`} />
      {children}
    </span>
  );
}

/** "2026-11-03" → "11.3" */
function shortDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${month}.${date}`;
}