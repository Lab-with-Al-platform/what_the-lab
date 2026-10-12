"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SignupSteps } from "@/components/signup-steps";

const MAX_SKILLS = 3;

// 선택지 목록. 항목을 바꿀 때 여기만 고치면 됩니다.
const SKILL_OPTIONS = [
  "이미지 분류", "객체 검출·분할", "수치 예측", "자연어 처리", "문서 검색(RAG)",
  "생성형 AI·LLM", "시계열 분석", "음성 인식", "추천", "데이터 전처리·라벨링",
];
const JOB_OPTIONS = ["대학원생", "연구원", "기업 재직", "프리랜서", "교수", "기타"];
const CAREER_OPTIONS = ["1년 미만", "1~3년", "3~5년", "5~10년", "10년 이상"];

export function ExpertSignupForm() {
  const router = useRouter();
  const [skills, setSkills] = useState<string[]>([]); // 여러 개 선택 (최대 3개)
  const [job, setJob] = useState<string | null>(null); // 하나만 선택
  const [career, setCareer] = useState<string | null>(null); // 하나만 선택
  const [affiliation, setAffiliation] = useState(""); // 선택 입력

  // 필수 세 가지를 다 골랐을 때만 가입 완료 버튼이 켜집니다.
  const canSubmit = skills.length > 0 && job !== null && career !== null;

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // 페이지 새로고침 막기
    // TODO: 백엔드가 생기면 여기서 skills, job, career, affiliation을 저장합니다.
    router.push("/signup/expert/done");
  }

  return (
    <form onSubmit={handleSubmit}>
      <SignupSteps steps={["회원 유형", "간단 프로필"]} current={2} />

      <p className="mt-10 text-center text-xs font-semibold text-brand">AI 전문가</p>
      <h1 className="mt-2 text-center text-2xl font-bold">어떤 AI 전문가인지 알려 주세요</h1>
      <p className="mt-2 text-center text-sm text-muted">세 가지만 고르면 가입이 끝나요</p>

      <FieldTitle label="할 수 있는 일" required extra={`${skills.length} / ${MAX_SKILLS}개`} />
      <ChipGroup options={SKILL_OPTIONS} isSelected={(item) => skills.includes(item)} onSelect={toggleSkill} />

      <FieldTitle label="지금 하는 일" required />
      <ChipGroup options={JOB_OPTIONS} isSelected={(item) => item === job} onSelect={setJob} />

      <FieldTitle label="AI 관련 경력" required />
      <ChipGroup options={CAREER_OPTIONS} isSelected={(item) => item === career} onSelect={setCareer} />

      <FieldTitle label="소속" extra="(선택)" />
      <input
        value={affiliation}
        onChange={(event) => setAffiliation(event.target.value)}
        placeholder="회사·기관 이름"
        className="mt-3 h-11 w-full rounded-button border border-line px-4 text-sm outline-none focus:border-brand"
      />
      <p className="mt-2 text-xs text-faint">나중에 회사 이메일로 인증하면 인증 배지가 붙어요</p>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-10 flex h-12 w-full items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
      >
        가입 완료
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
  onSelect,
}: {
  options: string[];
  isSelected: (item: string) => boolean;
  onSelect: (item: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((item) => {
        const selected = isSelected(item);
        return (
          <button
            key={item}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(item)}
            className={`h-9 rounded-full border px-4 text-sm transition ${
              selected ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-card text-muted hover:border-brand/40"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}