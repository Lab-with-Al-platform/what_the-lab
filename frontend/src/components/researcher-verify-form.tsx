"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { findInstitution, getEmailDomain, isPersonalEmail } from "@/lib/email-domain";
const CODE_LENGTH = 6;
const CODE_VALID_SECONDS = 5 * 60;

type Step = "email" | "code";

function formatTime(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ResearcherVerifyForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const institution = findInstitution(email);
  const expired = step === "code" && secondsLeft === 0;
  const canVerify = step === "code" && code.length === CODE_LENGTH && !expired;

  useEffect(() => {
    if (step !== "code" || secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, secondsLeft]);

  function sendCode() {
    // TODO: 백엔드가 생기면 여기서 인증번호 메일을 보냅니다.
    setStep("code");
    setCode("");
    setSecondsLeft(CODE_VALID_SECONDS);
  }

  function changeEmail() {
    setStep("email");
    setCode("");
  }

  function verify() {
    // TODO: 백엔드가 생기면 여기서 인증번호가 맞는지 확인합니다.
    router.push("/signup/researcher/info");
  }

  return (
    <>
      <SignupSteps steps={["회원 유형", "소속 인증", "기본 정보"]} current={2} />

      <div className="mt-5 rounded-[20px] border border-line bg-card p-10 shadow-card">
        <span className="inline-block rounded bg-researcher-soft px-2 py-0.5 text-xs font-semibold text-researcher">연구회원</span>
        <h1 className="mt-3 text-[22px] font-bold">소속을 인증해 주세요</h1>
        <p className="mt-1.5 text-sm text-muted">대학 또는 연구기관 이메일로 인증번호를 보내 드려요</p>

        {/* 이메일 */}
        <FieldLabel htmlFor="email" text="대학·연구기관 이메일" />
        <div className="mt-2 flex gap-2">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={step === "code"}
            placeholder="name@university.ac.kr"
            className={`h-12 min-w-0 flex-1 rounded-[10px] border px-4 text-[15px] outline-none ${
              step === "code" ? "border-line bg-page text-muted" : "border-line focus:border-brand"
            }`}
          />
          {step === "email" ? (
            <button
              type="button"
              onClick={sendCode}
              disabled={!institution}
              className="h-12 shrink-0 rounded-[10px] bg-brand px-4 text-sm font-semibold text-white disabled:bg-line disabled:text-faint"
            >
              인증번호 받기
            </button>
          ) : (
            <button type="button" onClick={changeEmail} className="h-12 shrink-0 rounded-[10px] border border-line px-4 text-sm text-muted">
              이메일 변경
            </button>
          )}
        </div>
        <EmailStatus email={email} institution={institution} sent={step === "code"} />
        {step === "email" && <p className="mt-1.5 text-xs text-muted">gmail, naver 같은 개인 메일은 사용할 수 없어요</p>}

        {/* 인증번호: 보낸 뒤에만 보입니다. */}
        {step === "code" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="code" text="인증번호 6자리" inline />
              <span className="text-[13px] text-danger tabular-nums">{formatTime(secondsLeft)}</span>
            </div>
            <CodeBoxes code={code} onChange={setCode} />
            <div className="mt-2.5 flex items-center justify-between text-[13px]">
              <span className={expired ? "text-danger" : "text-faint"}>
                {expired ? "인증 시간이 지났어요. 다시 보내 주세요" : "메일이 안 왔나요? 스팸함도 확인해 주세요"}
              </span>
              <button type="button" onClick={sendCode} className="font-semibold text-brand">
                다시 보내기
              </button>
            </div>
          </div>
        )}

        {/* 개인정보 안내: 이메일 단계에만 보입니다. */}
        {step === "email" && (
          <p className="mt-4 flex gap-2 rounded-[10px] bg-page px-3.5 py-3 text-xs text-muted">
            <span aria-hidden="true">ⓘ</span>
            이메일은 인증에만 쓰고, 인증이 끝나면 바로 삭제해요. 남는 건 기관명뿐이에요.
          </p>
        )}

        <button
          type="button"
          onClick={verify}
          disabled={!canVerify}
          className="mt-7 h-[52px] w-full rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
        >
          인증하기
        </button>

        <p className="mt-5 border-t border-line pt-5 text-center text-[13px] text-muted">
          기관 이메일이 없나요?{" "}
          <Link href="/signup/researcher/certificate" className="font-semibold text-brand">
            증명서로 인증하기
          </Link>
        </p>
      </div>
    </>
  );
}

// 항목 이름 + 빨간 별표
function FieldLabel({ htmlFor, text, inline = false }: { htmlFor: string; text: string; inline?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={`${inline ? "" : "mt-6 "}block text-[13px] font-semibold`}>
      {text} <span className="text-danger">*</span>
    </label>
  );
}

// 이메일 아래 상태 한 줄: "✓ 서울대학교 이메일로 확인됐어요"
function EmailStatus({ email, institution, sent }: { email: string; institution: string | null; sent: boolean }) {
  if (institution) {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 text-[13px]">
        <span className="text-success" aria-hidden="true">✓</span>
        <span className="font-semibold text-ink">{institution}</span>
        <span className="text-success">{sent ? "이메일로 인증번호를 보냈어요" : "이메일로 확인됐어요"}</span>
      </p>
    );
  }
  if (isPersonalEmail(email)) {
    return <p className="mt-2.5 text-[13px] text-danger">개인 메일로는 인증할 수 없어요</p>;
  }
  if (getEmailDomain(email).includes(".")) {
    return <p className="mt-2.5 text-[13px] text-faint">등록된 기관을 찾지 못했어요. 아래 증명서로 인증해 주세요</p>;
  }
  return null;
}

// 인증번호 칸 6개. 실제 입력은 위에 투명하게 덮인 입력창 하나가 받습니다.
function CodeBoxes({ code, onChange }: { code: string; onChange: (value: string) => void }) {
  return (
    <div className="relative mt-2">
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const digit = code[index] ?? "";
          const isNext = index === code.length; // 다음에 입력될 칸
          return (
            <span
              key={index}
              className={`grid h-[60px] w-14 place-items-center rounded-[10px] border text-2xl font-semibold ${
                digit ? "border-brand/40" : isNext ? "border-brand" : "border-line"
              }`}
            >
              {digit}
            </span>
          );
        })}
      </div>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  );
}