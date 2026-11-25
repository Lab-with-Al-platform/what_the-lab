"use client";

import { useState } from "react";
import { FieldTitle, INPUT_CLASS, Modal, ModalActions, useSaving } from "@/components/modal";
import { Career, Certificate, Education, LIMITS } from "@/lib/my-career";

export type HistoryTab = "careers" | "educations" | "certificates";
export type HistoryItem = Career | Education | Certificate;
export type HistoryValues = { tab: HistoryTab; body: Record<string, string | null> };

export const HISTORY_LABELS: Record<HistoryTab, string> = { careers: "경력", educations: "학력", certificates: "자격증" };

type Props = {
  tab: HistoryTab; // 처음 열 탭
  item: HistoryItem | null; // null = 새로 추가, 있으면 그 항목 수정 (탭은 바꿀 수 없어요)
  onClose: () => void;
  onSave: (values: HistoryValues) => Promise<void>;
  onDelete: () => Promise<void>;
};

/** 비어 있으면 null(= 입력 안 함)로 보냅니다. */
function orNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function MyCareerHistoryModal({ tab: initialTab, item, onClose, onSave, onDelete }: Props) {
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const career = item && "career_id" in item ? item : null;
  const education = item && "education_id" in item ? item : null;
  const certificate = item && "certificate_id" in item ? item : null;

  // 경력
  const [company, setCompany] = useState(career?.company ?? "");
  const [job, setJob] = useState(career?.job ?? "");
  const [startMonth, setStartMonth] = useState(career?.start_month ?? "");
  const [endMonth, setEndMonth] = useState(career?.end_month ?? "");
  const [working, setWorking] = useState(career ? career.end_month === null : false);
  // 학력
  const [school, setSchool] = useState(education?.school ?? "");
  const [major, setMajor] = useState(education?.major ?? "");
  const [graduatedYear, setGraduatedYear] = useState(education?.graduated_year ?? "");
  // 자격증
  const [name, setName] = useState(certificate?.name ?? "");
  const [issuer, setIssuer] = useState(certificate?.issuer ?? "");
  const [acquiredYear, setAcquiredYear] = useState(certificate?.acquired_year ?? "");

  const { saving, error, run } = useSaving();
  const isYear = (value: string) => value === "" || /^\d{4}$/.test(value);

  const canSave =
    tab === "careers"
      ? job.trim() !== "" && startMonth !== "" && (working || endMonth !== "") && (working || endMonth >= startMonth)
      : tab === "educations"
        ? school.trim() !== "" && major.trim() !== "" && isYear(graduatedYear)
        : name.trim() !== "" && isYear(acquiredYear);

  function bodyOf(): Record<string, string | null> {
    if (tab === "careers") {
      return { company: orNull(company), job: job.trim(), start_month: startMonth, end_month: working ? null : endMonth };
    }
    if (tab === "educations") {
      return { school: school.trim(), major: major.trim(), graduated_year: orNull(graduatedYear) };
    }
    return { name: name.trim(), issuer: orNull(issuer), acquired_year: orNull(acquiredYear) };
  }

  return (
    <Modal
      title={item ? `${HISTORY_LABELS[tab]} 수정` : "이력 추가"}
      description="한 줄이면 충분해요. 자세한 내용은 포트폴리오가 보여줘요"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSave={() => run(() => onSave({ tab, body: bodyOf() }))}
          onDelete={item ? () => run(onDelete) : undefined}
          canSave={canSave}
          saving={saving}
          error={error}
          saveLabel={item ? "저장하기" : "추가하기"}
        />
      }
    >
      {!item && (
        <div className="mb-6 inline-flex rounded-button bg-page p-1" role="tablist">
          {(Object.keys(HISTORY_LABELS) as HistoryTab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`h-9 rounded-button px-4 text-sm ${tab === key ? "bg-card font-semibold text-ink shadow-card" : "text-muted"}`}
            >
              {HISTORY_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {tab === "careers" && (
        <>
          <FieldTitle htmlFor="company" optional>
            회사·기관명
          </FieldTitle>
          <input id="company" value={company} maxLength={LIMITS.short} onChange={(event) => setCompany(event.target.value)} placeholder="예) OO헬스케어" className={INPUT_CLASS} />
          <p className="mt-1 text-xs text-faint">밝히고 싶지 않다면 비워 두거나 &ldquo;헬스케어 스타트업&rdquo;처럼 적어도 돼요</p>

          <div className="mt-6">
            <FieldTitle htmlFor="job" required>
              직무
            </FieldTitle>
            <input id="job" value={job} maxLength={LIMITS.short} onChange={(event) => setJob(event.target.value)} placeholder="예) 머신러닝 엔지니어" className={INPUT_CLASS} />
          </div>

          <div className="mt-6">
            <FieldTitle required>기간</FieldTitle>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input type="month" aria-label="시작한 달" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} className={INPUT_CLASS} />
              <span className="text-faint">~</span>
              {working ? (
                <span className="flex h-11 items-center rounded-button border border-line bg-page px-4 text-sm text-muted">재직 중</span>
              ) : (
                <input type="month" aria-label="끝난 달" value={endMonth} min={startMonth || undefined} onChange={(event) => setEndMonth(event.target.value)} className={INPUT_CLASS} />
              )}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={working} onChange={(event) => setWorking(event.target.checked)} className="h-4 w-4 accent-brand" />
              지금 다니고 있어요
            </label>
            {!working && endMonth && startMonth && endMonth < startMonth && <p className="mt-1 text-xs text-danger">끝난 달이 시작한 달보다 빨라요</p>}
          </div>
        </>
      )}

      {tab === "educations" && (
        <>
          <FieldTitle htmlFor="school" required>
            학교
          </FieldTitle>
          <input id="school" value={school} maxLength={LIMITS.short} onChange={(event) => setSchool(event.target.value)} placeholder="예) OO대학교" className={INPUT_CLASS} />
          <div className="mt-6">
            <FieldTitle htmlFor="major" required>
              전공·학위
            </FieldTitle>
            <input id="major" value={major} maxLength={LIMITS.short} onChange={(event) => setMajor(event.target.value)} placeholder="예) 컴퓨터공학 석사" className={INPUT_CLASS} />
          </div>
          <div className="mt-6">
            <FieldTitle htmlFor="graduated-year" optional>
              졸업 연도
            </FieldTitle>
            <YearInput id="graduated-year" value={graduatedYear} onChange={setGraduatedYear} />
          </div>
        </>
      )}

      {tab === "certificates" && (
        <>
          <FieldTitle htmlFor="certificate-name" required>
            자격증 이름
          </FieldTitle>
          <input id="certificate-name" value={name} maxLength={LIMITS.short} onChange={(event) => setName(event.target.value)} placeholder="예) 빅데이터분석기사" className={INPUT_CLASS} />
          <div className="mt-6">
            <FieldTitle htmlFor="issuer" optional>
              발급 기관
            </FieldTitle>
            <input id="issuer" value={issuer} maxLength={LIMITS.short} onChange={(event) => setIssuer(event.target.value)} placeholder="예) 한국데이터산업진흥원" className={INPUT_CLASS} />
          </div>
          <div className="mt-6">
            <FieldTitle htmlFor="acquired-year" optional>
              취득 연도
            </FieldTitle>
            <YearInput id="acquired-year" value={acquiredYear} onChange={setAcquiredYear} />
          </div>
        </>
      )}

      <p className="mt-8 rounded-button bg-page p-4 text-[13px] leading-relaxed text-muted">
        적은 내용은 연구자에게 그대로 보여요.
        <br />
        따로 인증하지 않고, 증명서도 받지 않아요.
      </p>
    </Modal>
  );
}

/** 연도 4자리만 받는 칸 */
function YearInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <>
      <input
        id={id}
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        placeholder="예) 2021"
        className={`${INPUT_CLASS} max-w-40`}
      />
      {value !== "" && value.length < 4 && <p className="mt-1 text-xs text-danger">연도는 4자리로 적어 주세요</p>}
    </>
  );
}