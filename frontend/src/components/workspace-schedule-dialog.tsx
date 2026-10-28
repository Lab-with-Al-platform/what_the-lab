"use client";

import { useState } from "react";
import { shortDate } from "@/lib/collab-requests";
import { addSchedule, Collaboration, KIND_LABELS, Schedule, ScheduleKind, schedulePeriod, updateSchedule, WorkspaceData } from "@/lib/workspace";
import { Chip, FieldTitle, INPUT_CLASS, Modal, ModalActions, useSaving } from "@/components/modal";

const KINDS: ScheduleKind[] = ["meeting", "work", "due", "etc"];
const LIMITS = { title: 60, memo: 500 } as const; // 백엔드 workspace_rules 와 같은 글자 수

type Props = {
  collabs: Collaboration[]; // 일정을 넣을 수 있는 협업 (진행 중 · 시작 전)
  editing?: Schedule; // 있으면 수정, 없으면 새 일정
  defaultCollabId?: number; // 처음부터 골라 둘 협업 (할 일 [+ 일정 추가]에서 열 때)
  defaultDate?: string; // 처음 날짜 (달력 날짜를 눌러서 열 때)
  today: string;
  onClose: () => void;
  onSaved: (data: WorkspaceData) => void; // 저장한 뒤 최신 목록
};

/** 일정 추가·수정 창. 협업 → 유형 → 일정명 → 날짜 → 메모. 날짜는 그 협업에서 잡을 수 있는 기간 안에서만 골라요. */
export function ScheduleDialog({ collabs, editing, defaultCollabId, defaultDate, today, onClose, onSaved }: Props) {
  const firstCollab = editing?.collaboration_id ?? defaultCollabId ?? (collabs.length === 1 ? collabs[0].collaboration_id : 0);
  const [collabId, setCollabId] = useState(firstCollab);
  const collab = collabs.find((item) => item.collaboration_id === collabId);
  const period = collab ? schedulePeriod(collab) : null;

  const [kind, setKind] = useState<ScheduleKind>(editing?.kind ?? "meeting");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [start, setStart] = useState(editing?.start_date ?? (collab ? suggestDay(collab, today, defaultDate) : ""));
  const [end, setEnd] = useState(editing?.end_date ?? start);
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [repeat, setRepeat] = useState(false);
  const { saving, error, run } = useSaving();

  const oneDay = start === end;
  const canRepeat = !editing && kind === "meeting" && oneDay; // 매주 반복은 새 하루짜리 미팅만
  const inPeriod = Boolean(period && start && end && start >= period.first && end <= period.last);
  const canSave = Boolean(collab && title.trim() && start && end && end >= start && inPeriod);

  function chooseCollab(id: number) {
    setCollabId(id);
    const next = collabs.find((item) => item.collaboration_id === id);
    if (next) {
      // 협업을 바꾸면 그 협업 기간 안의 날짜로 다시 맞춰요
      const day = suggestDay(next, today, defaultDate);
      setStart(day);
      setEnd(day);
    }
  }

  function changeStart(value: string) {
    // 하루짜리였거나 종료일이 시작일보다 앞이면 종료일도 같이 옮겨요
    if (oneDay || end < value) setEnd(value);
    setStart(value);
  }

  function save() {
    run(async () => {
      const input = {
        kind,
        title: title.trim(),
        start_date: start,
        end_date: end,
        memo: memo.trim(),
        repeat_weekly: canRepeat && repeat,
        // 화면에 없는 칸은 원래 값 그대로 (수정할 때 지워지지 않게)
        start_time: editing?.start_time ?? null,
        end_time: editing?.end_time ?? null,
        place: editing?.place ?? "",
        assignee: editing?.assignee ?? null,
      };
      onSaved(editing ? await updateSchedule(editing.schedule_id, input) : await addSchedule(collabId, input));
    });
  }

  return (
    <Modal
      title={editing ? "일정 수정" : "일정 추가"}
      description="두 사람이 같은 일정을 봐요. 대화는 디스코드 채널에서 해요."
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} onSave={save} canSave={canSave} saving={saving} error={error} saveLabel={editing ? "수정하기" : "추가하기"} />}
    >
      <div className="space-y-6">
        {/* 협업: 수정할 때나 협업이 하나면 고정, 여러 개면 고르기 */}
        <div>
          <FieldTitle required htmlFor="schedule-collab">
            어느 협업 일정인가요
          </FieldTitle>
          {editing || collabs.length === 1 ? (
            <p className="rounded-button bg-page px-4 py-3 text-sm font-semibold">{collab ? collabName(collab) : ""}</p>
          ) : (
            <select id="schedule-collab" value={collabId} onChange={(event) => chooseCollab(Number(event.target.value))} className={INPUT_CLASS}>
              <option value={0} disabled>
                협업을 골라 주세요
              </option>
              {collabs.map((item) => (
                <option key={item.collaboration_id} value={item.collaboration_id}>
                  {collabName(item)}
                </option>
              ))}
            </select>
          )}
          {period && (
            <p className="mt-2 text-xs text-muted">
              이 협업 일정은 <b className="text-ink">{shortDate(period.first)} ~ {shortDate(period.last)}</b> 사이에 잡을 수 있어요.
            </p>
          )}
        </div>

        <div>
          <FieldTitle required>유형</FieldTitle>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <Chip key={item} selected={kind === item} onClick={() => setKind(item)}>
                {KIND_LABELS[item]}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <FieldTitle required htmlFor="schedule-title" extra={`${title.length} / ${LIMITS.title}`}>
            일정명
          </FieldTitle>
          <input
            id="schedule-title"
            value={title}
            maxLength={LIMITS.title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={PLACEHOLDERS[kind]}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <FieldTitle required>날짜</FieldTitle>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="시작일"
              value={start}
              min={period?.first}
              max={period?.last}
              disabled={!period}
              onChange={(event) => changeStart(event.target.value)}
              className={INPUT_CLASS}
            />
            <span className="text-muted">~</span>
            <input
              type="date"
              aria-label="종료일"
              value={end}
              min={start || period?.first}
              max={period?.last}
              disabled={!period}
              onChange={(event) => setEnd(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <p className="mt-2 text-xs text-muted">하루짜리 일정은 시작일과 종료일을 같게 두면 돼요.</p>
          {period && start && end && !inPeriod && <p className="mt-1 text-xs text-danger">협업 기간 안의 날짜를 골라 주세요.</p>}
          {canRepeat && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} className="h-4 w-4 accent-brand" />
              매주 같은 요일에 반복 <span className="text-xs text-faint">(협업 종료일까지)</span>
            </label>
          )}
        </div>

        <div>
          <FieldTitle optional htmlFor="schedule-memo" extra={`${memo.length} / ${LIMITS.memo}`}>
            메모
          </FieldTitle>
          <textarea
            id="schedule-memo"
            value={memo}
            maxLength={LIMITS.memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={3}
            placeholder="준비할 것, 회의 링크 등"
            className="w-full rounded-button border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
          />
        </div>
      </div>
    </Modal>
  );
}

const PLACEHOLDERS: Record<ScheduleKind, string> = {
  meeting: "예: 킥오프 미팅",
  work: "예: 세포 이미지 라벨링",
  due: "예: 1차 결과 공유",
  etc: "예: 데이터 전달",
};

/** "형광 현미경 사진에서… · cayongu 님" */
function collabName(collab: Collaboration): string {
  const title = collab.research.title.length > 24 ? `${collab.research.title.slice(0, 24)}…` : collab.research.title;
  return `${title} · ${collab.partner.nickname} 님`;
}

/** 처음 보여 줄 날짜: 고른 날 → 오늘 → 잡을 수 있는 첫날 순서로, 협업 기간 안의 날짜 */
function suggestDay(collab: Collaboration, today: string, wanted?: string): string {
  const { first, last } = schedulePeriod(collab);
  const inside = (day: string) => day >= first && day <= last;
  if (wanted && inside(wanted)) return wanted;
  if (inside(today)) return today;
  return today < first ? first : last;
}