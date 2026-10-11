"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SignupSteps } from "@/components/signup-steps";

const POSITION_OPTIONS = ["학부연구생", "석사과정", "박사과정", "박사후연구원", "교수", "연구원"];

export function ResearcherInfoForm() {
  const router = useRouter();
  // TODO: 백엔드가 생기면 소속 인증에서 확인한 실제 기관명으로 바꿉니다.
  const institution = "서울대학교";
  const [department, setDepartment] = useState(""); // 학과·부서 (선택)
  const [position, setPosition] = useState<string | null>(null); // 직위 (선택, 하나만)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: 백엔드가 생기면 여기서 department, position을 저장합니다.
    router.push("/signup/researcher/done");
  }

  return (
    <form onSubmit={handleSubmit}>
      <SignupSteps steps={["회원 유형", "소속 인증", "기본 정보"]} current={3} />

      <div className="mt-5 rounded-[20px] border border-line bg-card p-10 shadow-card">
        <span className="inline-block rounded bg-researcher-soft px-2 py-0.5 text-xs font-semibold text-researcher">연구회원</span>
        <h1 className="mt-3 text-[22px] font-bold">거의 다 됐어요!</h1>
        <p className="mt-1.5 text-sm text-muted">프로필에 보여줄 정보를 알려 주세요</p>

        {/* 기관명: 소속 인증에서 확인한 값이라 수정할 수 없습니다. */}
        <div className="mt-6 rounded-[10px] border border-line bg-page px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{institution}</span>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">소속 인증 완료</span>
          </div>
          <p className="mt-1 text-xs text-faint">이메일에서 확인한 기관명이라 수정할 수 없어요</p>
        </div>

        <label htmlFor="department" className="mt-6 block text-[13px] font-semibold">
          학과·부서 <span className="text-xs font-normal text-faint">(선택)</span>
        </label>
        <input
          id="department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          placeholder="예) 컴퓨터공학부"
          className="mt-2 h-12 w-full rounded-[10px] border border-line px-4 text-[15px] outline-none focus:border-brand"
        />

        <p className="mt-6 text-[13px] font-semibold">
          직위 <span className="text-xs font-normal text-faint">(선택)</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {POSITION_OPTIONS.map((item) => {
            const selected = item === position;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                // 이미 고른 칩을 다시 누르면 선택을 풉니다. (선택 항목이라 비워 둘 수 있어야 함)
                onClick={() => setPosition(selected ? null : item)}
                className={`h-9 rounded-full border px-4 text-sm transition ${
                  selected ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-card text-muted hover:border-brand/40"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <button
          type="submit"
          className="mt-8 h-[52px] w-full rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-hover"
        >
          가입 완료
        </button>
      </div>
    </form>
  );
}