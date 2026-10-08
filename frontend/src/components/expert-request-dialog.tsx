"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import type { ExpertProfile } from "@/lib/experts";

interface ExpertRequestDialogProps {
  expert: ExpertProfile;
  onClose: () => void;
}

/**
 * 시안의 협업 요청 창입니다.
 * 입력한 내용은 화면에만 남고, 로그인과 저장이 없어 서버로 보내지 않습니다.
 */
export function ExpertRequestDialog({ expert, onClose }: ExpertRequestDialogProps) {
  const titleId = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [task, setTask] = useState(expert.tasks[0] ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(2);
  }

  const period = start && end ? `${start} – ${end}` : "기간을 적지 않음";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-card p-5 shadow-card md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">
            {expert.name} 님에게 협업 요청
          </h2>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-button text-muted hover:bg-page" onClick={onClose}>
            <span className="sr-only">닫기</span>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="mt-1 text-xs text-faint">{step === 1 ? "1. 입력" : "2. 확인"} · 이 창의 내용은 저장되지 않습니다.</p>

        {step === 1 ? (
          <form className="mt-5" onSubmit={onNext}>
            <fieldset>
              <legend className="text-sm font-semibold">어떤 연구로 요청할까요?</legend>
              <div className="mt-2 space-y-2">
                {expert.tasks.map((item) => (
                  <label key={item} className={`block cursor-pointer rounded-card border p-3 ${task === item ? "border-brand bg-brand-soft" : "border-line"}`}>
                    <input className="sr-only" type="radio" name="task" value={item} checked={task === item} onChange={() => setTask(item)} />
                    <span className="text-sm font-medium">{item}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                시작
                <input className="mt-1 h-11 w-full rounded-button border border-line px-3 text-sm font-normal" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              </label>
              <label className="text-sm font-semibold">
                종료
                <input className="mt-1 h-11 w-full rounded-button border border-line px-3 text-sm font-normal" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
              </label>
            </div>
            <p className="mt-2 text-xs text-faint">{expert.status}. 기간은 비워 두어도 다음으로 갈 수 있습니다.</p>
            <label className="mt-4 block text-sm font-semibold">
              메시지
              <textarea
                className="mt-1 w-full rounded-button border border-line px-3 py-2 text-sm font-normal"
                rows={4}
                maxLength={300}
                value={message}
                placeholder="연구 목표, 데이터 종류, 기대하는 역할을 적어 보세요."
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <p className="text-right text-xs text-faint">{message.length} / 300</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="h-11 rounded-button px-4 text-sm font-semibold text-muted" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">
                다음 →
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5">
            <h3 className="text-sm font-bold">내가 입력한 것</h3>
            <dl className="mt-2 divide-y divide-line text-sm">
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 py-2">
                <dt className="text-muted">연구</dt>
                <dd>{task}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 py-2">
                <dt className="text-muted">희망 기간</dt>
                <dd>{period}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 py-2">
                <dt className="text-muted">메시지</dt>
                <dd className="whitespace-pre-wrap">{message.trim() || "메시지를 적지 않았습니다."}</dd>
              </div>
            </dl>
            <h3 className="mt-4 text-sm font-bold">{expert.name} 님의 협업 조건</h3>
            <dl className="mt-2 rounded-card bg-brand-soft p-3 text-sm">
              {expert.conditions.slice(0, 3).map((condition) => (
                <div key={condition.label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 py-1">
                  <dt className="text-muted">{condition.label}</dt>
                  <dd>{condition.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-6 text-muted">로그인과 요청 저장이 연결되기 전에는 이 내용을 보내지 않습니다. 연락처도 공개되지 않습니다.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="h-11 rounded-button px-4 text-sm font-semibold text-muted" onClick={() => setStep(1)}>
                이전
              </button>
              <button type="button" className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover" onClick={onClose}>
                확인하고 닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
