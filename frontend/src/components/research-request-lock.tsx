"use client";

import { useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import type { Research } from "@/lib/my-research";

/**
 * 진행 중인 요청이 있는 연구의 수정·삭제 잠금 안내.
 * 요청을 받은 전문가가 본 내용과 실제 연구가 달라지지 않게, 요청을 모두 닫아야 수정할 수 있어요.
 * [요청 모두 취소하고 수정하기]를 누르면 요청을 닫고(답 기다리는 요청 = 취소, 수락된 요청 = 거절)
 * 최신 연구 목록을 onUnlocked로 넘겨요.
 */
export function ResearchRequestLock({ research, onUnlocked }: { research: Research; onUnlocked: (list: Research[]) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (research.open_request_count === 0) return null;

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      await requestApi("/researcher/requests/close", { method: "POST", body: JSON.stringify({ research_id: research.research_id }) });
      onUnlocked(await requestApi<Research[]>("/researcher/researches"));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-card border border-line bg-page px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-muted">
          🔒 진행 중인 요청 <b className="text-ink">{research.open_request_count}건</b>이 있어 수정·삭제할 수 없어요. 전문가가 받은 내용과 달라지지 않게 하려는 거예요.
        </p>
        {!confirm && (
          <button type="button" onClick={() => setConfirm(true)} className="h-9 rounded-button border border-line bg-card px-3 font-semibold text-muted hover:text-ink">
            요청 모두 취소하고 수정하기
          </button>
        )}
      </div>
      {confirm && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <p className="mr-auto text-danger">
            답 기다리는 요청은 취소(같은 전문가에게 한 번 더 보낼 수 있어요), 수락된 요청은 거절돼요. 계속할까요?
          </p>
          <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="h-9 rounded-button border border-line bg-card px-3 font-semibold text-muted">
            아니요
          </button>
          <button type="button" onClick={unlock} disabled={busy} className="h-9 rounded-button bg-danger px-3 font-semibold text-white disabled:opacity-60">
            {busy ? "취소하는 중…" : "모두 취소하기"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-danger">{error}</p>}
    </div>
  );
}