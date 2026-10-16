"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";

type Me = { nickname: string };
type ResearcherProfile = { institution_name: string | null; department: string | null; is_verified: boolean };

// 가입 완료 화면: 방금 저장한 활동명과 소속을 보여 줍니다.
export function ResearcherSignupDone() {
  const [nickname, setNickname] = useState<string | null>(null); // 디스코드 활동명
  const [profile, setProfile] = useState<ResearcherProfile | null>(null);

  useEffect(() => {
    // 두 요청은 서로 기다릴 필요가 없어서 동시에 보냅니다.
    Promise.all([requestApi<Me>("/auth/me"), requestApi<ResearcherProfile>("/researcher/profile")])
      .then(([me, researcher]) => {
        setNickname(me.nickname);
        setProfile(researcher);
      })
      .catch(() => {
        // 정보를 못 불러와도 가입은 끝난 상태라, 화면은 그대로 두고 값만 비워 둡니다.
      });
  }, []);

  // "서울대학교 · 컴퓨터공학부"처럼 있는 값만 이어 붙입니다.
  const affiliation = profile ? [profile.institution_name, profile.department].filter(Boolean).join(" · ") : null;

  return (
    <div className="mx-auto max-w-[520px] rounded-[20px] border border-line bg-card p-10 text-center shadow-card">
      <h1 className="text-2xl font-bold">가입을 환영해요!</h1>
      <p className="mt-2 text-sm text-muted">이제 연구 프로젝트를 열고 AI 전문가를 찾아볼 수 있어요</p>

      {/* 가입 정보 요약 */}
      <dl className="mt-8 divide-y divide-line rounded-[10px] border border-line text-left text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-muted">활동명</dt>
          <dd className="font-semibold">{nickname ?? "…"}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-muted">소속</dt>
          <dd className="flex items-center gap-2 font-semibold">
            {affiliation || "…"}
            {profile?.is_verified && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">인증 완료</span>}
          </dd>
        </div>
      </dl>

      {/* TODO: 디스코드 DM 발송이 생기면 실제 결과에 따라 보여 줍니다. 실패하면 DM 허용 안내로 바꿉니다. */}
      <div className="mt-6 rounded-[10px] bg-brand-soft px-4 py-3 text-left">
        <p className="text-sm font-semibold text-brand">디스코드 DM으로 환영 메시지를 보냈어요</p>
        <p className="mt-0.5 text-xs text-muted">요청 도착, 수락, 일정 같은 알림도 이 DM으로 받아요</p>
      </div>

      <Link
        href="/"
        className="mt-8 flex h-[52px] items-center justify-center rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-hover"
      >
        시작하기
      </Link>
    </div>
  );
}