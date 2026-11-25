"use client";

import { useState } from "react";
import { Chip, FieldTitle, Modal, ModalActions, toggle, useSaving } from "@/components/modal";
import { AbleWorkOption, CareerProfile, FieldCategory, LIMITS } from "@/lib/my-career";

export type IntroValues = { introduce: string; domain_ids: string[]; able_work_ids: string[] };

type Props = {
  profile: CareerProfile;
  ableWorks: AbleWorkOption[];
  fields: FieldCategory[];
  onClose: () => void;
  onSave: (values: IntroValues) => Promise<void>;
};

/** 소개 카드 [수정]: 한 줄 소개 + 도메인 키워드 + 할 수 있는 일 */
export function MyCareerIntroModal({ profile, ableWorks, fields, onClose, onSave }: Props) {
  const [introduce, setIntroduce] = useState(profile.introduce ?? "");
  const [domainIds, setDomainIds] = useState(profile.domain_ids);
  const [ableWorkIds, setAbleWorkIds] = useState(profile.able_work_ids);
  const [categoryId, setCategoryId] = useState(fields[0]?.field_category_id ?? "");
  const [showAllWorks, setShowAllWorks] = useState(false);
  const { saving, error, run } = useSaving();

  const fieldName = new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name])));
  const category = fields.find((item) => item.field_category_id === categoryId);
  // 기본 노출 7개 + 이미 고른 것은 항상 보이게
  const visibleWorks = showAllWorks ? ableWorks : ableWorks.filter((work) => work.show_default || ableWorkIds.includes(work.able_work_id));
  const canSave = introduce.trim().length > 0 && domainIds.length > 0 && ableWorkIds.length > 0;

  return (
    <Modal
      title="소개와 키워드"
      description="연구자가 찾기 목록과 상세에서 가장 먼저 보는 정보예요"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(() => onSave({ introduce: introduce.trim(), domain_ids: domainIds, able_work_ids: ableWorkIds }))}
          canSave={canSave}
          saving={saving}
          error={error}
        />
      }
    >
      <FieldTitle htmlFor="introduce" required>
        한 줄 소개
      </FieldTitle>
      <textarea
        id="introduce"
        value={introduce}
        maxLength={LIMITS.introduce}
        rows={2}
        onChange={(event) => setIntroduce(event.target.value.replace(/\n/g, ""))}
        placeholder="예) 의료영상에서 원하는 대상을 찾아내는 분할 모델을 만들어요"
        className="w-full resize-none rounded-button border border-line px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-brand"
      />
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>어떤 일을 주로 하는지 한 문장으로 적어 주세요</span>
        <span>
          {introduce.length} / {LIMITS.introduce}
        </span>
      </div>

      <div className="mt-8">
        <FieldTitle required extra={`${domainIds.length} / ${LIMITS.domains}개`}>
          도메인 키워드
        </FieldTitle>
        <p className="mb-3 text-xs text-muted">어떤 분야의 데이터를 다뤄 봤나요?</p>
        <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
          {fields.map((item) => {
            const picked = item.fields.filter((field) => domainIds.includes(field.field_id)).length;
            const active = item.field_category_id === categoryId;
            return (
              <button
                key={item.field_category_id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategoryId(item.field_category_id)}
                className={`h-9 shrink-0 rounded-button px-3 text-sm ${active ? "bg-ink font-semibold text-white" : "bg-page text-muted hover:text-ink"}`}
              >
                {item.name}
                {picked > 0 && <span className={`ml-1 ${active ? "text-white/80" : "text-brand"}`}>{picked}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {category?.fields.map((field) => (
            <Chip
              key={field.field_id}
              selected={domainIds.includes(field.field_id)}
              disabled={domainIds.length >= LIMITS.domains}
              onClick={() => setDomainIds(toggle(domainIds, field.field_id))}
            >
              {field.name}
            </Chip>
          ))}
        </div>
        {domainIds.length > 0 && (
          <div className="mt-4 rounded-button bg-page p-3">
            <p className="text-xs font-semibold text-muted">고른 키워드</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {domainIds.map((id) => (
                <span key={id} className="inline-flex h-8 items-center gap-1 rounded-full bg-card pl-3 pr-1 text-sm text-ink">
                  {fieldName.get(id) ?? id}
                  <button type="button" onClick={() => setDomainIds(domainIds.filter((item) => item !== id))} className="grid h-6 w-6 place-items-center rounded-full text-faint hover:bg-page hover:text-ink">
                    <span className="sr-only">{fieldName.get(id)} 빼기</span>
                    <span aria-hidden="true">×</span>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <FieldTitle required extra={`${ableWorkIds.length} / ${LIMITS.ableWorks}개 · 가입할 때 고른 키워드`}>
          할 수 있는 일
        </FieldTitle>
        <div className="flex flex-wrap gap-2">
          {visibleWorks.map((work) => (
            <Chip
              key={work.able_work_id}
              selected={ableWorkIds.includes(work.able_work_id)}
              disabled={ableWorkIds.length >= LIMITS.ableWorks}
              onClick={() => setAbleWorkIds(toggle(ableWorkIds, work.able_work_id))}
            >
              {work.name}
            </Chip>
          ))}
        </div>
        {!showAllWorks && visibleWorks.length < ableWorks.length && (
          <button type="button" onClick={() => setShowAllWorks(true)} className="mt-3 text-sm font-semibold text-brand">
            + 더 보기
          </button>
        )}
      </div>
    </Modal>
  );
}