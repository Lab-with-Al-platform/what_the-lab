"use client";

import { useEffect, useState } from "react";
import { INPUT_CLASS, Modal } from "@/components/modal";
import { ApiError, requestApi } from "@/lib/api";

const CODE_LENGTH = 6;

// email: 새 기관 이메일 → code: 인증번호 → name: (목록에 없던 기관만) 기관명 입력
type Step = "email" | "code" | "name";

type LookupResponse = { institution_name: string | null; manual_allowed: boolean };
type SendResponse = { institution_name: string | null; expires_in: number; dev_code?: string };
type ConfirmResponse = { institution_name: string | null; needs_name: boolean };

type Props = {
  currentInstitution: string; // 지금 인증된 기관 (인증을 마치기 전까지 그대로 유지돼요)
  onClose: () => void;
  onChanged: () => void; // 바뀐 뒤 화면을 다시 불러와요
};

const toMessage = (caught: unknown) => (caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");

function formatTime(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 소속 기관 바꾸기 창. 새 기관 이메일로 다시 인증해야 바뀌어요. */
export function SettingsInstitutionModal({ currentInstitution, onClose, onChanged }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<string | null>(null); // 이메일로 찾은 기관명
  const [checked, setChecked] = useState(false); // 인증 가능한 기관 이메일인지 확인됐는지
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null); // 개발 중에만 오는 인증번호
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null); // 바뀐 기관명 (완료 화면)

  const expired = step === "code" && secondsLeft === 0;

  useEffect(() => {
    if (step !== "code" || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, secondsLeft]);

  async function call(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  // 이메일 칸에서 나가면 인증할 수 있는 기관 이메일인지 확인해요.
  const checkEmail = () =>
    email.includes("@") &&
    call(async () => {
      const data = await requestApi<LookupResponse>(`/verification/institution?email=${encodeURIComponent(email)}`);
      setFound(data.institution_name);
      setChecked(true);
    });

  // [인증번호 받기]와 [다시 보내기]가 같이 써요.
  const sendCode = () =>
    call(async () => {
      const data = await requestApi<SendResponse>("/verification/change/send", { method: "POST", body: JSON.stringify({ email }) });
      setFound(data.institution_name);
      setDevCode(data.dev_code ?? null);
      setCode("");
      setSecondsLeft(data.expires_in);
      setStep("code");
    });

  const confirm = () =>
    call(async () => {
      const data = await requestApi<ConfirmResponse>("/verification/change/confirm", { method: "POST", body: JSON.stringify({ code }) });
      if (data.needs_name) {
        setStep("name"); // 목록에 없던 기관: 인증은 끝났고 이름만 받아요
      } else {
        setDone(data.institution_name);
        onChanged();
      }
    });

  const saveName = () =>
    call(async () => {
      await requestApi("/verification/change/name", { method: "POST", body: JSON.stringify({ institution_name: name.trim() }) });
      setDone(name.trim());
      onChanged();
    });

  const primary = done
    ? { label: "닫기", disabled: false, onClick: onClose }
    : step === "email"
      ? { label: "인증번호 받기", disabled: !checked, onClick: sendCode }
      : step === "code"
        ? { label: "인증하기", disabled: code.length !== CODE_LENGTH || expired, onClick: confirm }
        : { label: "저장하기", disabled: name.trim() === "", onClick: saveName };

  return (
    <Modal
      title="소속 기관 바꾸기"
      description="새 학교·연구기관 이메일로 다시 인증해야 바뀌어요."
      onClose={onClose}
      footer={
        <div>
          {error && (
            <p role="alert" className="mb-3 text-[13px] text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {!done && (
              <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
                취소
              </button>
            )}
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled || busy}
              className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
            >
              {busy ? "처리하는 중…" : primary.label}
            </button>
          </div>
        </div>
      }
    >
      {done ? (
        <div className="py-6 text-center">
          <p className="text-3xl text-success" aria-hidden="true">
            ✓
          </p>
          <p className="mt-2 text-lg font-bold">{done}</p>
          <p className="mt-1 text-sm text-muted">소속 기관을 바꿨어요</p>
        </div>
      ) : (
        <>
          <div className="rounded-button bg-page px-4 py-3 text-[13px] text-muted">
            지금 기관 <b className="ml-1 text-ink">{currentInstitution || "-"}</b>
            <span className="mt-0.5 block text-xs text-faint">인증을 마치기 전까지는 지금 기관이 유지돼요</span>
          </div>

          {step === "name" ? (
            <div className="mt-5">
              <p className="text-sm font-semibold">인증이 완료됐어요</p>
              <p className="mt-1 text-[13px] text-muted">목록에 없는 기관이라 이름을 직접 입력해 주세요. 운영팀이 확인해요.</p>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="예) OO대학교" className={`${INPUT_CLASS} mt-3`} />
            </div>
          ) : (
            <>
              <label htmlFor="change-email" className="mt-5 block text-[13px] font-semibold">
                새 학교·연구기관 이메일
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="change-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setChecked(false);
                    setFound(null);
                    setError("");
                  }}
                  onBlur={checkEmail}
                  readOnly={step === "code"}
                  placeholder="name@university.ac.kr"
                  className={`${INPUT_CLASS} ${step === "code" ? "bg-page text-muted" : ""}`}
                />
                {step === "code" && (
                  <button type="button" onClick={() => setStep("email")} className="h-11 shrink-0 rounded-button border border-line px-3.5 text-[13px] text-muted">
                    이메일 변경
                  </button>
                )}
              </div>
              {checked && (
                <p className="mt-2 text-[13px]">
                  <span className="text-success">✓ </span>
                  {found ? <b>{found}</b> : <span className="text-muted">목록에 없는 기관이에요. 인증 후 이름을 입력해 주세요</span>}
                </p>
              )}
              {step === "email" && <p className="mt-1.5 text-xs text-faint">gmail, naver 같은 개인 메일은 쓸 수 없어요 · 이메일은 저장하지 않아요</p>}

              {step === "code" && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="change-code" className="text-[13px] font-semibold">
                      인증번호 6자리
                    </label>
                    <span className="text-[13px] tabular-nums text-danger">{formatTime(secondsLeft)}</span>
                  </div>
                  {/* 개발 중 임시: 메일 대신 화면에 인증번호를 보여 줘요. 배포 환경에서는 오지 않아요. */}
                  {devCode && (
                    <p className="mt-2 rounded-button bg-page px-3.5 py-2.5 text-[13px] text-muted">
                      인증번호 <b className="ml-1 tracking-[0.2em] text-ink tabular-nums">{devCode}</b>
                      <span className="ml-2 text-xs text-faint">(메일 발송 전 임시 표시)</span>
                    </p>
                  )}
                  <input
                    id="change-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                    placeholder="000000"
                    className={`${INPUT_CLASS} mt-2 text-center text-lg tracking-[0.4em] tabular-nums`}
                  />
                  <div className="mt-2 flex items-center justify-between text-[13px]">
                    <span className={expired ? "text-danger" : "text-faint"}>{expired ? "인증 시간이 지났어요. 다시 보내 주세요" : "메일이 안 왔다면 다시 보내 보세요"}</span>
                    <button type="button" onClick={sendCode} disabled={busy} className="font-semibold text-brand">
                      다시 보내기
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}