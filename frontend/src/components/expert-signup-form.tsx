"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { ApiError, requestApi } from "@/lib/api";

const MAX_SKILLS = 3;

// 칩 하나: value는 DB에 저장되는 코드, label은 화면 문구입니다.
type Option = { value: string; label: string };
type AbleWork = { able_work_id: string; name: string; show_default: boolean };

const JOB_OPTIONS: Option[] = [
  { value: "grad_student", label: "대학원생" },
  { value: "researcher", label: "연구원" },
  { value: "employee", label: "기업 재직" },
  { value: "freelancer", label: "프리랜서" },
  { value: "professor", label: "교수" },
  { value: "etc", label: "기타" },
];
const CAREER_OPTIONS: Option[] = [
  { value: "lt1", label: "1년 미만" },
  { value: "1_3", label: "1~3년" },
  { value: "3_5", label: "3~5년" },
  { value: "5_10", label: "5~10년" },
  { value: "gt10", label: "10년 이상" },
];

export function ExpertSignupForm() {
  const router = useRouter();
  const [ableWorks, setAbleWorks] = useState<AbleWork[]>([]); // 할 수 있는 일 목록 (택소노미 UG)
  const [showAll, setShowAll] = useState(false); // [더 보기]를 눌렀는지
  const [skills, setSkills] = useState<string[]>([]); // 고른 할 수 있는 일 ID (최대 3개)
  const [job, setJob] = useState<string | null>(null); // 하나만 선택
  const [career, setCareer] = useState<string | null>(null); // 하나만 선택
  const [affiliation, setAffiliation] = useState(""); // 선택 입력
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 화면이 열리면 할 수 있는 일 목록을 서버(able_work 테이블)에서 가져옵니다.
  useEffect(() => {
    requestApi<AbleWork[]>("/expert/able-works")
      .then(setAbleWorks)
      .catch(() => setError("할 수 있는 일 목록을 불러오지 못했어요. 새로고침해 주세요"));
  }, []);

  // 처음엔 기본 항목만 보이고, [더 보기]를 누르면 전부 보입니다. 이미 고른 항목은 항상 보입니다.
  const visibleWorks = ableWorks.filter((work) => showAll || work.show_default || skills.includes(work.able_work_id));
  const hiddenCount = ableWorks.length - visibleWorks.length;
  const skillOptions = visibleWorks.map((work) => ({ value: work.able_work_id, label: work.name }));

  // 필수 세 가지를 다 골랐을 때만 가입 완료 버튼이 켜집니다.
  const canSubmit = skills.length > 0 && job !== null && career !== null && !saving;

  function toggleSkill(skill: string) {
    if (skills.includes(skill)) {
      setSkills(skills.filter((item) => item !== skill)); // 이미 골랐으면 빼기
      return;
    }
    if (skills.length >= MAX_SKILLS) {
      return; // 3개를 다 골랐으면 더 추가하지 않기
    }
    setSkills([...skills, skill]); // 새로 추가하기
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // 페이지 새로고침 막기
    setSaving(true);
    setError(null);
    try {
      const data = await requestApi<{ next: string }>("/expert/signup", {
        method: "POST",
        body: JSON.stringify({ able_works: skills, current_job: job, ai_career: career, affiliation }),
      });
      router.push(data.next);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <SignupSteps steps={["회원 유형", "간단 프로필"]} current={2} />

      <p className="mt-10 text-center text-xs font-semibold text-brand">AI 전문가</p>
      <h1 className="mt-2 text-center text-2xl font-bold">어떤 AI 전문가인지 알려 주세요</h1>
      <p className="mt-2 text-center text-sm text-muted">세 가지만 고르면 가입이 끝나요</p>

      <FieldTitle label="할 수 있는 일" required extra={`${skills.length} / ${MAX_SKILLS}개`} />
      <ChipGroup
        options={skillOptions}
        isSelected={(value) => skills.includes(value)}
        isDisabled={(value) => skills.length >= MAX_SKILLS && !skills.includes(value)}
        onSelect={toggleSkill}
      />
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-sm font-semibold text-brand">
          + 더 보기 ({hiddenCount})
        </button>
      )}

      <FieldTitle label="지금 하는 일" required />
      <ChipGroup options={JOB_OPTIONS} isSelected={(value) => value === job} onSelect={setJob} />

      <FieldTitle label="AI 관련 경력" required />
      <ChipGroup options={CAREER_OPTIONS} isSelected={(value) => value === career} onSelect={setCareer} />

      <FieldTitle label="소속" extra="(선택)" />
      <input
        value={affiliation}
        onChange={(event) => setAffiliation(event.target.value)}
        maxLength={100}
        placeholder="회사·기관 이름"
        className="mt-3 h-11 w-full rounded-button border border-line px-4 text-sm outline-none focus:border-brand"
      />
      <p className="mt-2 text-xs text-faint">나중에 회사 이메일로 인증하면 인증 배지가 붙어요</p>

      {error && <p className="mt-6 text-[13px] text-danger">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-10 flex h-12 w-full items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
      >
        {saving ? "저장하는 중…" : "가입 완료"}
      </button>
    </form>
  );
}

// 항목 제목 한 줄: "할 수 있는 일 *  2 / 3개"
function FieldTitle({ label, required = false, extra }: { label: string; required?: boolean; extra?: string }) {
  return (
    <div className="mt-8 flex items-center gap-1 text-sm font-semibold">
      {label}
      {required && <span className="text-danger">*</span>}
      {extra && <span className="ml-auto text-xs font-normal text-faint">{extra}</span>}
    </div>
  );
}

// 칩 버튼 묶음. 하나만 고르는 곳과 여러 개 고르는 곳에서 같이 씁니다.
function ChipGroup({
  options,
  isSelected,
  isDisabled = () => false,
  onSelect,
}: {
  options: Option[];
  isSelected: (value: string) => boolean;
  isDisabled?: (value: string) => boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={isDisabled(option.value)}
            onClick={() => onSelect(option.value)}
            className={`h-9 rounded-full border px-4 text-sm transition disabled:opacity-40 ${
              selected ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-card text-muted hover:border-brand/40"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}