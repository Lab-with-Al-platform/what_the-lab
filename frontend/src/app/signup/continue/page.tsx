import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "이어서 가입하기" };

type StepStatus = "done" | "current" | "todo";

type ResumeStep = {
  label: string;
  detail?: string;
  status: StepStatus;
};

// TODO: 백엔드가 생기면 "이 사람이 어디까지 했는지"를 서버에서 받아 채웁니다.
// 지금은 연구회원을 고르고 소속 인증에서 멈춘 예시입니다.
const RESUME = {
  nickname: "minseo_c",
  roleLabel: "연구회원",
  continueHref: "/signup/researcher",
  continueLabel: "소속 인증 이어서 하기",
  steps: [
    { label: "디스코드 로그인", status: "done" },
    { label: "회원 유형 선택", detail: "연구회원", status: "done" },
    { label: "소속 인증", detail: "대학·연구기관 이메일", status: "current" },
    { label: "기본 정보", status: "todo" },
  ] satisfies ResumeStep[],
};

export default function SignupContinuePage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 md:px-6">
      <div className="rounded-card border border-line bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">다시 오셨네요, {RESUME.nickname} 님</h1>
        <p className="mt-2 text-sm text-muted">가입이 아직 끝나지 않았어요. 멈춘 곳부터 이어서 할게요.</p>

        <ol className="mt-8 space-y-3">
          {RESUME.steps.map((step, index) => (
            <StepRow key={step.label} step={step} number={index + 1} />
          ))}
        </ol>

        <Link
          href={RESUME.continueHref}
          className="mt-8 flex h-12 items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover"
        >
          {RESUME.continueLabel}
        </Link>

        <p className="mt-4 text-center text-xs text-muted">
          {RESUME.roleLabel}이 아닌가요?{" "}
          <Link href="/signup" className="font-semibold text-brand">
            회원 유형 다시 고르기
          </Link>
        </p>
      </div>
    </section>
  );
}

// 단계 한 줄. 상태(완료 / 여기부터 / 아직)에 따라 모양이 바뀝니다.
function StepRow({ step, number }: { step: ResumeStep; number: number }) {
  const isDone = step.status === "done";
  const isCurrent = step.status === "current";

  return (
    <li
      className={`flex items-center gap-3 rounded-button border px-4 py-3 ${
        isCurrent ? "border-brand bg-brand-soft" : "border-line"
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
          isDone ? "bg-expert-soft text-expert" : isCurrent ? "bg-brand text-white" : "bg-line text-faint"
        }`}
      >
        {isDone ? "✓" : number}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${step.status === "todo" ? "text-faint" : "text-ink"}`}>{step.label}</p>
        {step.detail && <p className="text-xs text-muted">{step.detail}</p>}
      </div>
      {isDone && <span className="ml-auto text-xs font-semibold text-expert">완료</span>}
      {isCurrent && <span className="ml-auto text-xs font-semibold text-brand">여기부터</span>}
    </li>
  );
}