"use client";

import { ReactNode, useState } from "react";
import { Collaboration, dayLabel, deleteSchedule, KIND_LABELS, Schedule, toneOf, WorkspaceData } from "@/lib/workspace";
import { Modal, useSaving } from "@/components/modal";

type Props = {
  schedule: Schedule;
  collab: Collaboration | undefined;
  editable: boolean; // 끝난 협업이면 보기만
  onClose: () => void;
  onEdit: () => void; // [수정] → 수정 창으로
  onDeleted: (data: WorkspaceData) => void; // 지운 뒤 최신 목록
};

/** 일정을 눌렀을 때 뜨는 창: 내용 · 작성자 · 작성일 보기, [수정] [삭제]. 두 사람 모두 고치고 지울 수 있어요. */
export function ScheduleView({ schedule, collab, editable, onClose, onEdit, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const { saving, error, run } = useSaving();
  const tone = toneOf(schedule.collaboration_id);
  const oneDay = schedule.start_date === schedule.end_date;
  const edited = schedule.updated_at && schedule.created_at && schedule.updated_at.slice(0, 16) !== schedule.created_at.slice(0, 16);

  function remove(series: boolean) {
    run(async () => onDeleted(await deleteSchedule(schedule.schedule_id, series)));
  }

  const footer = !editable ? (
    <p className="text-right text-xs text-faint">끝난 협업의 일정은 바꿀 수 없어요.</p>
  ) : confirming ? (
    <div>
      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}
      <p className="mb-3 text-sm font-semibold text-danger">이 일정을 지울까요? 상대방 달력에서도 사라져요.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="h-11 rounded-button border border-line px-4 text-sm font-semibold text-muted hover:bg-page">
          아니요
        </button>
        {schedule.series_id && (
          <button type="button" onClick={() => remove(true)} disabled={saving} className="h-11 rounded-button border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger-soft">
            이후 반복 일정 모두
          </button>
        )}
        <button type="button" onClick={() => remove(false)} disabled={saving} className="h-11 rounded-button bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "지우는 중…" : schedule.series_id ? "이 일정만" : "삭제하기"}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={() => setConfirming(true)} className="mr-auto h-11 rounded-button px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
        삭제
      </button>
      <button type="button" onClick={onClose} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
        닫기
      </button>
      <button type="button" onClick={onEdit} className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">
        수정
      </button>
    </div>
  );

  return (
    <Modal title={schedule.title} onClose={onClose} footer={footer}>
      <dl className="space-y-4 text-sm">
        <Row label="유형">
          {KIND_LABELS[schedule.kind]}
          {schedule.series_id && <span className="ml-2 text-xs text-faint">매주 반복</span>}
        </Row>
        <Row label="날짜">
          {oneDay ? dayLabel(schedule.start_date) : `${dayLabel(schedule.start_date)} ~ ${dayLabel(schedule.end_date)}`}
          {schedule.start_time && ` · ${schedule.start_time}${schedule.end_time ? `~${schedule.end_time}` : ""}`}
        </Row>
        <Row label="협업">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${tone.text}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            {collab ? `${collab.research.title} · ${collab.partner.nickname} 님` : ""}
          </span>
        </Row>
        {schedule.place && <Row label="장소">{schedule.place}</Row>}
        {schedule.memo && (
          <Row label="메모">
            <span className="whitespace-pre-line">{schedule.memo}</span>
          </Row>
        )}
        <Row label="작성">
          {schedule.created_by_nickname ?? "탈퇴한 회원"}
          {schedule.created_at && ` · ${monthDay(schedule.created_at)}`}
          {edited && schedule.updated_at && <span className="ml-2 text-xs text-faint">({monthDay(schedule.updated_at)} 수정됨)</span>}
        </Row>
      </dl>
    </Modal>
  );
}

/** 저장 시각(ISO) → 내 컴퓨터 시간 기준 "10.28" */
function monthDay(iso: string): string {
  const day = new Date(iso);
  return `${day.getMonth() + 1}.${day.getDate()}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-12 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}