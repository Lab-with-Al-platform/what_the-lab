"use client";

import { useState } from "react";
import { Chip, FieldTitle, INPUT_CLASS, Modal, ModalActions, useSaving } from "@/components/modal";
import { Collaboration, LIMITS, MEETING_LABELS, MeetingType, REWARD_LABELS, RewardCode, TIME_LABELS, TimeCode } from "@/lib/my-career";

type Props = {
  collaboration: Collaboration | null;
  onClose: () => void;
  onSave: (values: Collaboration) => Promise<void>;
};

const MEETINGS = Object.keys(MEETING_LABELS) as MeetingType[];
const TIMES = Object.keys(TIME_LABELS) as TimeCode[];
const REWARDS = Object.keys(REWARD_LABELS) as RewardCode[];

/** 협업 조건: 미팅 방식, 주당 가능 시간, 희망 보상 */
export function MyCareerCollaborationModal({ collaboration, onClose, onSave }: Props) {
  const [meetingType, setMeetingType] = useState<MeetingType | null>(collaboration?.meeting_type ?? null);
  const [area, setArea] = useState(collaboration?.face_to_area ?? "");
  const [time, setTime] = useState<TimeCode | null>(collaboration?.available_time ?? null);
  const [rewards, setRewards] = useState<RewardCode[]>(collaboration?.rewards ?? []);
  const { saving, error, run } = useSaving();

  const needsArea = meetingType === "offline_ok";
  const canSave = meetingType !== null && time !== null && rewards.length > 0 && (!needsArea || area.trim().length > 0);

  function pickReward(code: RewardCode) {
    if (rewards.includes(code)) {
      setRewards(rewards.filter((item) => item !== code));
    } else if (code === "undecided") {
      setRewards(["undecided"]); // '상의 후 결정'은 혼자만
    } else {
      setRewards([...rewards.filter((item) => item !== "undecided"), code]);
    }
  }

  function save() {
    if (!meetingType || !time) return;
    run(() =>
      onSave({
        meeting_type: meetingType,
        face_to_area: needsArea ? area.trim() : null,
        available_time: time,
        rewards,
      }),
    );
  }

  return (
    <Modal
      title="협업 조건"
      description="연구자가 요청 전에 확인하는 정보예요. 언제든 바꿀 수 있어요"
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} onSave={save} canSave={canSave} saving={saving} error={error} />}
    >
      <FieldTitle required>미팅 방식</FieldTitle>
      <div className="grid grid-cols-2 gap-2">
        {MEETINGS.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={meetingType === code}
            onClick={() => setMeetingType(code)}
            className={`h-12 rounded-button border text-sm ${meetingType === code ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:border-brand"}`}
          >
            {MEETING_LABELS[code]}
          </button>
        ))}
      </div>
      {needsArea && (
        <div className="mt-3">
          <input value={area} maxLength={LIMITS.area} onChange={(event) => setArea(event.target.value)} placeholder="예) 서울 · 경기" aria-label="대면 가능 지역" className={INPUT_CLASS} />
          <p className="mt-1 text-xs text-faint">대면이 가능한 지역을 적어 주세요</p>
        </div>
      )}

      <div className="mt-8">
        <FieldTitle required>주당 가능 시간</FieldTitle>
        <div className="grid grid-cols-3 gap-2">
          {TIMES.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={time === code}
              onClick={() => setTime(code)}
              className={`h-12 rounded-button border text-sm ${time === code ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:border-brand"}`}
            >
              {TIME_LABELS[code]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <FieldTitle required extra="여러 개 선택">
          희망 보상
        </FieldTitle>
        <div className="flex flex-wrap gap-2">
          {REWARDS.map((code) => (
            <Chip key={code} selected={rewards.includes(code)} onClick={() => pickReward(code)}>
              {REWARD_LABELS[code]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">&lsquo;상의 후 결정&rsquo;은 다른 보상과 함께 고를 수 없어요</p>
      </div>

      <p className="mt-8 rounded-button bg-page p-4 text-[13px] leading-relaxed text-muted">
        데이터 공유·보안 조건은 연구자가 연구에 적어요.
        <br />
        요청을 받을 때 확인하고, 동의하면 수락할 수 있어요.
      </p>
    </Modal>
  );
}