"use client";

import Link from "next/link";
import { useState } from "react";
import { SignupSteps } from "@/components/signup-steps";

type Role = "researcher" | "expert";

// 카드 내용. 문구를 바꿀 때 여기만 고치면 됩니다.
const ROLE_OPTIONS: {
  key: Role;
  title: string;
  description: string[];
  features: string[];
  note: string;
  buttonLabel: string;
  nextHref: string;
}[] = [
  {
    key: "researcher",
    title: "연구회원",
    description: ["연구실·연구기관 소속으로", "프로젝트를 열고 협업자를 찾아요"],
    features: ["대학·연구기관 이메일로 인증", "프로젝트 등록·협업 요청"],
    note: "소속 인증을 마치면 회원 유형은 바꿀 수 없어요.",
    buttonLabel: "연구회원으로 계속하기",
    nextHref: "/signup/researcher",
  },
  {
    key: "expert",
    title: "AI 전문가",
    description: ["AI 기술과 경험으로", "연구 프로젝트에 참여해요"],
    features: ["포트폴리오로 경력 소개", "연구자의 협업 요청 받기"],
    note: "가입 후에도 프로필을 채워야 AI 전문가 찾기 목록에 보여요.",
    buttonLabel: "AI 전문가로 계속하기",
    nextHref: "/signup/expert",
  },
];

// 연구회원과 AI 전문가는 가입 단계 수가 다릅니다.
const STEPS: Record<Role, string[]> = {
  researcher: ["회원 유형", "소속 인증", "기본 정보"],
  expert: ["회원 유형", "간단 프로필"],
};

export function SignupRoleForm() {
  // 아직 아무것도 고르지 않은 상태(null)에서 시작합니다.
  const [selected, setSelected] = useState<Role | null>(null);
  const option = ROLE_OPTIONS.find((item) => item.key === selected);

  return (
    <div>
      <SignupSteps steps={STEPS[selected ?? "researcher"]} current={1} />

      <h1 className="mt-10 text-center text-2xl font-bold">어떤 회원으로 가입할까요?</h1>
      <p className="mt-2 text-center text-sm text-muted">회원 유형에 따라 인증 방법과 쓸 수 있는 기능이 달라요</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {ROLE_OPTIONS.map((item) => {
          const isSelected = item.key === selected;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(item.key)}
              className={`rounded-card border p-6 text-left transition ${
                isSelected ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand/40"
              }`}
            >
              <p className="text-lg font-bold">{item.title}</p>
              <p className="mt-2 text-sm text-muted">
                {item.description[0]}
                <br />
                {item.description[1]}
              </p>
              <ul className="mt-4 space-y-1 text-xs text-muted">
                {item.features.map((feature) => (
                  <li key={feature}>· {feature}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {option && <p className="mt-4 text-center text-xs text-faint">{option.note}</p>}

      {option ? (
        <Link
          href={option.nextHref}
          className="mt-6 flex h-12 items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover"
        >
          {option.buttonLabel}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-6 flex h-12 w-full items-center justify-center rounded-button bg-line text-sm font-semibold text-faint"
        >
          회원 유형을 골라 주세요
        </button>
      )}
    </div>
  );
}