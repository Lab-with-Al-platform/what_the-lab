"use client";

import { ReactNode, useState } from "react";
import { Chip, FieldTitle, INPUT_CLASS, Modal, toggle, useSaving } from "@/components/modal";
import {
  DATA_STATUS_LABELS,
  DATA_TYPE_LABELS,
  DataStatus,
  DataType,
  emptyInput,
  LIMITS,
  MEETING_LABELS,
  MeetingType,
  OUTPUT_LABELS,
  OutputType,
  Research,
  ResearchInput,
  REWARD_LABELS,
  RewardCode,
  SHARE_LABELS,
  SharePolicy,
  stepReady,
  toInput,
} from "@/lib/my-research";

// 분류표 목록 (내 이력과 같은 API 응답 모양)
export type AbleWorkOption = { able_work_id: string; name: string; show_default: boolean };
export type FieldCategory = { field_category_id: string; name: string; fields: { field_id: string; name: string }[] };

type Props = {
  research: Research | null; // null = 새 연구 작성
  ableWorks: AbleWorkOption[];
  fields: FieldCategory[];
  onClose: () => void;
  onSave: (input: ResearchInput) => Promise<void>;
  onDelete: () => Promise<void>;
};

const STEPS = ["연구", "데이터", "협업", "확인"];
const DATA_TYPES = Object.keys(DATA_TYPE_LABELS) as DataType[];
const DATA_STATUSES = Object.keys(DATA_STATUS_LABELS) as DataStatus[];
const SHARES = Object.keys(SHARE_LABELS) as SharePolicy[];
const OUTPUTS = Object.keys(OUTPUT_LABELS) as OutputType[];
const REWARDS = Object.keys(REWARD_LABELS) as RewardCode[];
const MEETINGS = Object.keys(MEETING_LABELS) as MeetingType[];

/** 연구 등록·수정 창. 4단계(연구 → 데이터 → 협업 → 확인)로 나눠 받아요. */
export function MyResearchModal({ research, ableWorks, fields, onClose, onSave, onDelete }: Props) {
  const [input, setInput] = useState<ResearchInput>(research ? toInput(research) : emptyInput());
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState(fields[0]?.field_category_id ?? "");
  const [showAllWorks, setShowAllWorks] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { saving, error, run } = useSaving();

  const registered = research?.status === "registered"; // 이미 등록한 연구를 고치는 중인지
  const fieldName = new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name])));
  const workName = new Map(ableWorks.map((work) => [work.able_work_id, work.name]));
  const ready = stepReady(step, input);

  /** 입력값 일부만 바꿉니다. 예: change({ title: "..." }) */
  function change(patch: Partial<ResearchInput>) {
    setInput((current) => ({ ...current, ...patch }));
  }

  /** 여러 개 고르기 + '혼자만 고를 수 있는 값'(아직 모름 등) 처리 */
  function pickExclusive<T extends string>(list: T[], value: T, exclusive: T): T[] {
    if (list.includes(value)) return list.filter((item) => item !== value);
    if (value === exclusive) return [exclusive];
    return [...list.filter((item) => item !== exclusive), value];
  }

  function save(status: "draft" | "registered") {
    run(() => onSave({ ...input, status, title: input.title.trim(), description: input.description.trim() }));
  }

  const footer = confirmDelete ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <p className="mr-auto text-sm font-semibold text-danger">이 연구를 삭제할까요? 되돌릴 수 없어요.</p>
      <FooterButton onClick={() => setConfirmDelete(false)} disabled={saving}>
        아니요
      </FooterButton>
      <button type="button" onClick={() => run(onDelete)} disabled={saving} className="h-11 rounded-button bg-danger px-5 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "삭제하는 중…" : "삭제하기"}
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {step > 1 ? (
        <FooterButton onClick={() => setStep(step - 1)} disabled={saving}>
          이전
        </FooterButton>
      ) : (
        research && (
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving} className="h-11 rounded-button px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
            삭제
          </button>
        )
      )}
      <div className="ml-auto flex items-center gap-2">
        {!registered && (
          <FooterButton onClick={() => save("draft")} disabled={saving || input.title.trim() === ""}>
            임시 저장
          </FooterButton>
        )}
        {step < 4 ? (
          <PrimaryButton onClick={() => setStep(step + 1)} disabled={!ready}>
            다음
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => save("registered")} disabled={saving}>
            {saving ? "저장하는 중…" : registered ? "저장하기" : "등록하기"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      title={research ? "연구 수정" : "연구 등록"}
      description="등록한 연구는 나만 볼 수 있고, 협업 요청을 보낼 때 골라서 함께 보내요."
      onClose={onClose}
      footer={
        <div>
          {error && (
            <p role="alert" className="mb-3 text-[13px] text-danger">
              {error}
            </p>
          )}
          {footer}
        </div>
      }
    >
      <Stepper step={step} onJump={(target) => target < step && setStep(target)} />

      {step === 1 && (
        <>
          <StepHead title="어떤 연구인가요?" description="전문가가 요청을 받았을 때 가장 먼저 보는 내용이에요." />
          <FieldTitle htmlFor="research-title" required extra={`${input.title.length} / ${LIMITS.title}`}>
            연구 제목
          </FieldTitle>
          <input
            id="research-title"
            value={input.title}
            maxLength={LIMITS.title}
            onChange={(event) => change({ title: event.target.value })}
            placeholder="예) 형광 현미경 사진에서 세포 수를 자동으로 세고 싶어요"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-faint">전문가가 한눈에 알 수 있게 한 줄로 써 주세요.</p>

          <div className="mt-8">
            <FieldTitle required extra={`${input.field_ids.length} / ${LIMITS.fields}개`}>
              분야
            </FieldTitle>
            <p className="mb-3 text-xs text-muted">큰 분야를 고른 뒤, 가장 가까운 세부 분야를 골라 주세요. AI 전문가의 도메인과 같은 기준이에요.</p>
            <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
              {fields.map((category) => {
                const picked = category.fields.filter((field) => input.field_ids.includes(field.field_id)).length;
                const active = category.field_category_id === categoryId;
                return (
                  <button
                    key={category.field_category_id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategoryId(category.field_category_id)}
                    className={`h-9 shrink-0 rounded-button px-3 text-sm ${active ? "bg-ink font-semibold text-white" : "bg-page text-muted hover:text-ink"}`}
                  >
                    {category.name}
                    {picked > 0 && <span className={`ml-1 ${active ? "text-white/80" : "text-brand"}`}>{picked}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {fields
                .find((category) => category.field_category_id === categoryId)
                ?.fields.map((field) => (
                  <Chip
                    key={field.field_id}
                    selected={input.field_ids.includes(field.field_id)}
                    disabled={input.field_ids.length >= LIMITS.fields}
                    onClick={() => change({ field_ids: toggle(input.field_ids, field.field_id) })}
                  >
                    {field.name}
                  </Chip>
                ))}
            </div>
            {input.field_ids.length > 0 && (
              <PickedList
                label="고른 분야"
                items={input.field_ids.map((id) => ({ id, name: fieldName.get(id) ?? id }))}
                onRemove={(id) => change({ field_ids: input.field_ids.filter((item) => item !== id) })}
              />
            )}
          </div>

          <div className="mt-8">
            <FieldTitle htmlFor="research-description" required extra={`${input.description.length} / ${LIMITS.description}`}>
              연구 내용
            </FieldTitle>
            <textarea
              id="research-description"
              value={input.description}
              maxLength={LIMITS.description}
              rows={6}
              onChange={(event) => change({ description: event.target.value })}
              placeholder="무엇을 알아내고 싶은지, 지금 어디서 막혀 있는지 적어 주세요."
              className="w-full resize-none rounded-button border border-line px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-brand"
            />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <StepHead title="어떤 데이터가 있나요?" description="데이터 공유 조건은 이 연구의 조건이 기준이 돼요." />
          <FieldTitle required extra="여러 개 고를 수 있어요">
            데이터 종류
          </FieldTitle>
          <div className="flex flex-wrap gap-2">
            {DATA_TYPES.map((code) => (
              <Chip key={code} selected={input.data_types.includes(code)} onClick={() => change({ data_types: toggle(input.data_types, code) })}>
                {DATA_TYPE_LABELS[code]}
              </Chip>
            ))}
          </div>

          <div className="mt-8">
            <FieldTitle required>데이터 상태</FieldTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DATA_STATUSES.map((code) => (
                <OptionButton key={code} selected={input.data_status === code} onClick={() => change({ data_status: code })}>
                  {DATA_STATUS_LABELS[code]}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <FieldTitle required>데이터 공유 조건</FieldTitle>
            <p className="mb-3 text-xs text-muted">AI 전문가는 이 조건에 동의해야 요청을 수락할 수 있어요.</p>
            <div className="space-y-2">
              {SHARES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={input.share_policy === code}
                  onClick={() => change({ share_policy: code, share_condition: code === "open" ? null : input.share_condition })}
                  className={`flex w-full items-start gap-3 rounded-button border px-4 py-3 text-left ${input.share_policy === code ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}
                >
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${input.share_policy === code ? "border-brand" : "border-line"}`}>
                    {input.share_policy === code && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{SHARE_LABELS[code].title}</span>
                    <span className="block text-xs text-muted">{SHARE_LABELS[code].detail}</span>
                  </span>
                </button>
              ))}
            </div>
            {input.share_policy === "conditional" && (
              <input
                value={input.share_condition ?? ""}
                maxLength={LIMITS.shareCondition}
                onChange={(event) => change({ share_condition: event.target.value })}
                placeholder="예) 연구실 내부 데이터라 보안 서약 후 공유할 수 있어요"
                aria-label="공유 조건 설명"
                className={`${INPUT_CLASS} mt-3`}
              />
            )}
          </div>

          <Notice>사이트에는 데이터 파일을 올리지 않아요. 요청이 수락된 뒤 이 조건에 맞춰 주고받아요.</Notice>
        </>
      )}

      {step === 3 && (
        <>
          <StepHead title="어떻게 협업하고 싶나요?" description="기간과 하고 싶은 말은 협업 요청을 보낼 때 전문가마다 따로 적어요." />
          <FieldTitle required extra={input.task_unsure ? "잘 모르겠어요" : `${input.able_work_ids.length} / ${LIMITS.ableWorks}개`}>
            AI에게 맡기고 싶은 일
          </FieldTitle>
          <p className="mb-3 text-xs text-muted">&ldquo;이 연구로 전문가 찾기&rdquo;에서 이 키워드로 전문가를 찾아 드려요.</p>
          <div className="flex flex-wrap gap-2">
            {(showAllWorks ? ableWorks : ableWorks.filter((work) => work.show_default || input.able_work_ids.includes(work.able_work_id))).map((work) => (
              <Chip
                key={work.able_work_id}
                selected={input.able_work_ids.includes(work.able_work_id)}
                disabled={input.able_work_ids.length >= LIMITS.ableWorks}
                onClick={() => change({ able_work_ids: toggle(input.able_work_ids, work.able_work_id), task_unsure: false })}
              >
                {work.name}
              </Chip>
            ))}
            <Chip selected={input.task_unsure} onClick={() => change({ task_unsure: !input.task_unsure, able_work_ids: [] })}>
              잘 모르겠어요
            </Chip>
          </div>
          {!showAllWorks && ableWorks.some((work) => !work.show_default && !input.able_work_ids.includes(work.able_work_id)) && (
            <button type="button" onClick={() => setShowAllWorks(true)} className="mt-3 text-sm font-semibold text-brand">
              + 더 보기
            </button>
          )}
          {input.task_unsure && <p className="mt-2 text-xs text-muted">연구 내용을 보고 어떤 AI 작업이 맞을지 전문가와 함께 정해요.</p>}

          <div className="mt-8">
            <FieldTitle required extra="여러 개 고를 수 있어요">
              원하는 결과물
            </FieldTitle>
            <div className="flex flex-wrap gap-2">
              {OUTPUTS.map((code) => (
                <Chip key={code} selected={input.outputs.includes(code)} onClick={() => change({ outputs: pickExclusive(input.outputs, code, "unknown") })}>
                  {OUTPUT_LABELS[code]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <FieldTitle optional>보상 형태</FieldTitle>
            <p className="mb-3 text-xs text-muted">전문가가 수락할지 정할 때 가장 먼저 보는 정보예요.</p>
            <div className="flex flex-wrap gap-2">
              {REWARDS.map((code) => (
                <Chip key={code} selected={input.rewards.includes(code)} onClick={() => change({ rewards: pickExclusive(input.rewards, code, "undecided") })}>
                  {REWARD_LABELS[code]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <FieldTitle optional>미팅</FieldTitle>
            <div className="grid grid-cols-2 gap-2">
              {MEETINGS.map((code) => (
                <OptionButton
                  key={code}
                  selected={input.meeting_type === code}
                  // 한 번 더 누르면 선택을 풀어요 (선택 항목이라)
                  onClick={() => change({ meeting_type: input.meeting_type === code ? null : code, face_to_area: code === "offline_ok" ? input.face_to_area : null })}
                >
                  {MEETING_LABELS[code]}
                </OptionButton>
              ))}
            </div>
            {input.meeting_type === "offline_ok" && (
              <input
                value={input.face_to_area ?? ""}
                maxLength={LIMITS.area}
                onChange={(event) => change({ face_to_area: event.target.value })}
                placeholder="예) 서울 · 경기"
                aria-label="대면 가능 지역"
                className={`${INPUT_CLASS} mt-3`}
              />
            )}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <StepHead title="마지막으로 확인해 주세요" description={`${registered ? "저장" : "등록"}하면 내 공간의 "내 연구"에 저장돼요.`} />
          <Summary title="1. 연구" onEdit={() => setStep(1)}>
            <Row label="제목" value={input.title} />
            <Row label="분야" value={input.field_ids.map((id) => fieldName.get(id) ?? id).join(", ")} />
            <Row label="연구 내용" value={input.description} multiline />
          </Summary>
          <Summary title="2. 데이터" onEdit={() => setStep(2)}>
            <Row label="데이터 종류" value={input.data_types.map((code) => DATA_TYPE_LABELS[code]).join(", ")} />
            <Row label="데이터 상태" value={input.data_status ? DATA_STATUS_LABELS[input.data_status] : ""} />
            <Row
              label="공유 조건"
              value={input.share_policy === "conditional" ? `조건이 있어요 · ${input.share_condition ?? ""}` : input.share_policy ? SHARE_LABELS[input.share_policy].title : ""}
            />
          </Summary>
          <Summary title="3. 협업" onEdit={() => setStep(3)}>
            <Row label="맡기고 싶은 일" value={input.task_unsure ? "잘 모르겠어요" : input.able_work_ids.map((id) => workName.get(id) ?? id).join(", ")} />
            <Row label="원하는 결과물" value={input.outputs.map((code) => OUTPUT_LABELS[code]).join(", ")} />
            <Row label="보상 형태" value={input.rewards.map((code) => REWARD_LABELS[code]).join(", ") || "선택 안 함"} />
            <Row
              label="미팅"
              value={input.meeting_type === "offline_ok" ? `대면 가능 · ${input.face_to_area ?? ""}` : input.meeting_type ? MEETING_LABELS[input.meeting_type] : "선택 안 함"}
            />
          </Summary>
          <Notice>이 연구는 나만 볼 수 있어요. 협업 요청을 보낼 때 그 전문가에게만 전달돼요.</Notice>
        </>
      )}
    </Modal>
  );
}

/** 위쪽 단계 표시. 지나온 단계는 눌러서 돌아갈 수 있어요. */
function Stepper({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  return (
    <ol className="mb-7 grid grid-cols-4 gap-2">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < step ? "done" : number === step ? "current" : "todo";
        return (
          <li key={label}>
            <button type="button" onClick={() => onJump(number)} disabled={state !== "done"} className="w-full text-left disabled:cursor-default">
              <span className={`block h-1 rounded-full ${state === "todo" ? "bg-line" : "bg-brand"}`} />
              <span className={`mt-2 block text-xs ${state === "current" ? "font-bold text-brand" : state === "done" ? "font-semibold text-ink" : "text-faint"}`}>
                {number}. {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-12 rounded-button border px-2 text-sm ${selected ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line hover:border-brand"}`}
    >
      {children}
    </button>
  );
}

function PickedList({ label, items, onRemove }: { label: string; items: { id: string; name: string }[]; onRemove: (id: string) => void }) {
  return (
    <div className="mt-4 rounded-button bg-page p-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.id} className="inline-flex h-8 items-center gap-1 rounded-full bg-card pl-3 pr-1 text-sm">
            {item.name}
            <button type="button" onClick={() => onRemove(item.id)} className="grid h-6 w-6 place-items-center rounded-full text-faint hover:bg-page hover:text-ink">
              <span className="sr-only">{item.name} 빼기</span>
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-8 rounded-button bg-page p-4 text-[13px] leading-relaxed text-muted">{children}</p>;
}

function Summary({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="mb-3 rounded-card border border-line p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold">{title}</h4>
        <button type="button" onClick={onEdit} className="h-8 rounded-button px-2 text-[13px] font-semibold text-brand hover:bg-brand-soft">
          수정
        </button>
      </div>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className={multiline ? "whitespace-pre-line line-clamp-4" : ""}>{value || "—"}</dd>
    </div>
  );
}

function FooterButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page disabled:opacity-50">
      {children}
    </button>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
    >
      {children}
    </button>
  );
}