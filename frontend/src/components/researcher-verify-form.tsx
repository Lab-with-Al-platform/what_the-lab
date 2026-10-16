"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { ApiError, requestApi } from "@/lib/api";

const CODE_LENGTH = 6;

// email: 이메일 입력 → code: 인증번호 입력 → name: (목록에 없던 기관만) 기관명 입력
type Step = "email" | "code" | "name";

type LookupResponse = { institution_name: string | null; manual_allowed: boolean };
type SendCodeResponse = { institution_name: string | null; expires_in: number; dev_code?: string };
type NextResponse = { institution_name: string | null; next: string };

// 실패 이유를 화면 문구로 바꿉니다. 백엔드 문구가 있으면 그대로 씁니다.
function toMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요";
}

function formatTime(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ResearcherVerifyForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState<string | null>(null); // 목록에서 찾은 기관명
  const [emailChecked, setEmailChecked] = useState(false); // 인증 가능한 기관 이메일로 확인됐는지
  const [emailMessage, setEmailMessage] = useState<string | null>(null); // 이메일 아래 에러 문구
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null); // 개발 중에만 오는 인증번호
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState(""); // name 단계에서 직접 입력하는 기관명
  const [nameError, setNameError] = useState<string | null>(null);

  const expired = step === "code" && secondsLeft === 0;
  const canVerify = step === "code" && code.length === CODE_LENGTH && !expired;

  useEffect(() => {
    if (step !== "code" || secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, secondsLeft]);

  // 이메일을 고치면 이전 확인 결과는 더 이상 맞지 않으므로 지웁니다.
  function changeEmailText(value: string) {
    setEmail(value);
    setInstitution(null);
    setEmailChecked(false);
    setEmailMessage(null);
  }

  // 이메일 칸에서 커서가 나가면(blur) 인증할 수 있는 기관 이메일인지 확인합니다.
  async function checkEmail() {
    if (!email.includes("@")) {
      return;
    }
    try {
      const data = await requestApi<LookupResponse>(`/verification/institution?email=${encodeURIComponent(email)}`);
      setInstitution(data.institution_name);
      setEmailChecked(true);
    } catch (error) {
      setEmailMessage(toMessage(error));
    }
  }

  // [인증번호 받기]와 [다시 보내기]가 같이 씁니다. 부를 때마다 새 번호가 옵니다.
  async function sendCode() {
    try {
      const data = await requestApi<SendCodeResponse>("/verification/email/send", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDevCode(data.dev_code ?? null);
      setStep("code");
      setCode("");
      setCodeError(null);
      setSecondsLeft(data.expires_in);
    } catch (error) {
      setEmailMessage(toMessage(error));
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setDevCode(null);
  }

  async function verify() {
    try {
      const data = await requestApi<NextResponse>("/verification/email/confirm", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      if (data.institution_name) {
        router.push(data.next);
      } else {
        setStep("name"); // 목록에 없던 기관: 인증은 끝났고 기관명만 받습니다.
      }
    } catch (error) {
      setCodeError(toMessage(error));
    }
  }

  async function saveInstitutionName() {
    try {
      const data = await requestApi<NextResponse>("/verification/institution-name", {
        method: "POST",
        body: JSON.stringify({ institution_name: institutionName }),
      });
      router.push(data.next);
    } catch (error) {
      setNameError(toMessage(error));
    }
  }

  return (
    <>
      <SignupSteps steps={["회원 유형", "소속 인증", "기본 정보"]} current={2} />

      <div className="mt-5 rounded-[20px] border border-line bg-card p-10 shadow-card">
        <span className="inline-block rounded bg-researcher-soft px-2 py-0.5 text-xs font-semibold text-researcher">연구회원</span>

        {step === "name" ? (
          <InstitutionNameStep
            value={institutionName}
            onChange={(value) => {
              setInstitutionName(value);
              setNameError(null);
            }}
            error={nameError}
            onSubmit={saveInstitutionName}
          />
        ) : (
          <>
            <h1 className="mt-3 text-[22px] font-bold">소속을 인증해 주세요</h1>
            <p className="mt-1.5 text-sm text-muted">대학 또는 연구기관 이메일로 인증번호를 보내 드려요</p>

            {/* 이메일 */}
            <FieldLabel htmlFor="email" text="대학·연구기관 이메일" />
            <div className="mt-2 flex gap-2">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => changeEmailText(event.target.value)}
                onBlur={checkEmail}
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
                  disabled={!emailChecked}
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
            <EmailStatus checked={emailChecked} institution={institution} message={emailMessage} sent={step === "code"} />
            {step === "email" && <p className="mt-1.5 text-xs text-muted">gmail, naver 같은 개인 메일은 사용할 수 없어요</p>}

            {/* 인증번호: 보낸 뒤에만 보입니다. */}
            {step === "code" && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="code" text="인증번호 6자리" inline />
                  <span className="text-[13px] text-danger tabular-nums">{formatTime(secondsLeft)}</span>
                </div>
                {/* 개발 중 임시: 메일 대신 화면에 인증번호를 보여 줍니다. 배포 환경에서는 dev_code가 오지 않습니다. */}
                {devCode && (
                  <p className="mt-2 rounded-[10px] bg-page px-3.5 py-2.5 text-[13px] text-muted">
                    인증번호 <span className="ml-1 font-semibold tracking-[0.2em] text-ink tabular-nums">{devCode}</span>
                    <span className="ml-2 text-xs text-faint">(메일 발송 전 임시 표시)</span>
                  </p>
                )}
                <CodeBoxes code={code} onChange={setCode} />
                {codeError && <p className="mt-2 text-[13px] text-danger">{codeError}</p>}
                <div className="mt-2.5 flex items-center justify-between text-[13px]">
                  <span className={expired ? "text-danger" : "text-faint"}>
                    {expired ? "인증 시간이 지났어요. 다시 보내 주세요" : "번호를 새로 받으려면 다시 보내기를 눌러 주세요"}
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
          </>
        )}
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

// 이메일 아래 상태 한 줄
function EmailStatus({
  checked,
  institution,
  message,
  sent,
}: {
  checked: boolean;
  institution: string | null;
  message: string | null;
  sent: boolean;
}) {
  if (message) {
    return <p className="mt-2.5 text-[13px] text-danger">{message}</p>;
  }
  if (!checked) {
    return null;
  }
  return (
    <p className="mt-2.5 flex items-center gap-1.5 text-[13px]">
      <span className="text-success" aria-hidden="true">✓</span>
      {institution && <span className="font-semibold text-ink">{institution}</span>}
      <span className="text-success">
        {institution ? "" : "기관 "}
        {sent ? "이메일로 인증번호를 보냈어요" : "이메일로 확인됐어요"}
      </span>
    </p>
  );
}

// 인증 완료 후, 목록에 없던 기관의 이름을 받는 단계
function InstitutionNameStep({
  value,
  onChange,
  error,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <>
      <h1 className="mt-3 text-[22px] font-bold">인증이 완료됐어요</h1>
      <p className="mt-1.5 text-sm text-muted">목록에 없는 기관이라 이름을 직접 입력해 주세요. 운영팀이 확인해요.</p>
      <FieldLabel htmlFor="institution-name" text="학교·기관 이름" />
      <input
        id="institution-name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={100}
        placeholder="예) OO대학교"
        className="mt-2 h-12 w-full rounded-[10px] border border-line px-4 text-[15px] outline-none focus:border-brand"
      />
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      <button
        type="button"
        onClick={onSubmit}
        disabled={value.trim() === ""}
        className="mt-7 h-[52px] w-full rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
      >
        다음
      </button>
    </>
  );
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