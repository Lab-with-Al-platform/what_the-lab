"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { ApiError, requestApi } from "@/lib/api";

type ResearcherProfile = {
  institution_name: string | null;
  institution_source: "list" | "manual";
  department: string | null;
  position: string | null;
  is_verified: boolean;
};

// value는 DB에 저장되는 코드, label은 화면 문구입니다.
const POSITION_OPTIONS = [
  { value: "undergrad", label: "학부연구생" },
  { value: "master", label: "석사과정" },
  { value: "phd", label: "박사과정" },
  { value: "postdoc", label: "박사후연구원" },
  { value: "professor", label: "교수" },
  { value: "researcher", label: "연구원" },
];

export function ResearcherInfoForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<ResearcherProfile | null>(null); // 소속 인증에서 저장된 정보
  const [department, setDepartment] = useState(""); // 학과·부서 (선택)
  const [position, setPosition] = useState<string | null>(null); // 직위 코드 (선택, 하나만)
  const [saving, setSaving] = useState(false); // 저장 중에는 버튼을 막아 두 번 눌리지 않게
  const [saveError, setSaveError] = useState<string | null>(null);

  // 화면이 열리면 소속 인증에서 저장한 기관명을 가져옵니다.
  useEffect(() => {
    requestApi<ResearcherProfile>("/researcher/profile")
      .then((data) => {
        setProfile(data);
        // 전에 저장한 값이 있으면 채워 둡니다. (다시 들어온 경우)
        setDepartment(data.department ?? "");
        setPosition(data.position);
      })
      .catch((error) => {
        // 인증을 안 했거나(404) 로그인이 풀렸으면(401) 소속 인증 화면으로 돌려보냅니다.
        if (error instanceof ApiError) {
          router.replace("/signup/researcher");
        }
      });
  }, [router]);

  // [가입 완료]: 학과·직위를 저장하면 백엔드가 가입을 끝냅니다(signup_step = 'done').
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const data = await requestApi<{ next: string }>("/researcher/profile", {
        method: "POST",
        body: JSON.stringify({ department, position }),
      });
      router.push(data.next);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <SignupSteps steps={["회원 유형", "소속 인증", "기본 정보"]} current={3} />

      <div className="mt-5 rounded-[20px] border border-line bg-card p-10 shadow-card">
        <span className="inline-block rounded bg-researcher-soft px-2 py-0.5 text-xs font-semibold text-researcher">연구회원</span>
        <h1 className="mt-3 text-[22px] font-bold">거의 다 됐어요!</h1>
        <p className="mt-1.5 text-sm text-muted">프로필에 보여줄 정보를 알려 주세요</p>

        {/* 기관명: 소속 인증에서 정해진 값이라 여기서는 수정할 수 없습니다. */}
        <div className="mt-6 rounded-[10px] border border-line bg-page px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{profile ? profile.institution_name ?? "기관명 미입력" : "불러오는 중…"}</span>
            {profile?.is_verified && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">소속 인증 완료</span>
            )}
          </div>
          <p className="mt-1 text-xs text-faint">
            {profile?.institution_source === "manual"
              ? "직접 입력한 기관명이에요. 운영팀이 확인해요"
              : "이메일에서 확인한 기관명이라 수정할 수 없어요"}
          </p>
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
            const selected = item.value === position;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                // 이미 고른 칩을 다시 누르면 선택을 풉니다. (선택 항목이라 비워 둘 수 있어야 함)
                onClick={() => setPosition(selected ? null : item.value)}
                className={`h-9 rounded-full border px-4 text-sm transition ${
                  selected ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-card text-muted hover:border-brand/40"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {saveError && <p className="mt-6 text-[13px] text-danger">{saveError}</p>}
        <button
          type="submit"
          disabled={!profile || saving}
          className="mt-8 h-[52px] w-full rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
        >
          {saving ? "저장하는 중…" : "가입 완료"}
        </button>
      </div>
    </form>
  );
}