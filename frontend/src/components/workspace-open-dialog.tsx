"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatPeriod } from "@/lib/collab-requests";
import { Collaboration } from "@/lib/workspace";
import { Modal } from "@/components/modal";

/** 앱 안 브라우저(디스코드·카카오톡 등)에서는 구글이 로그인을 막아요. */
function isInAppBrowser(): boolean {
  return /Discord|KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
}

/** [협업 공간 열기] 창. 처음 한 번만 나와요. 구글 계정을 연결하거나, 구글 없이 열 수 있어요. */
export function OpenCollabDialog({
  collab,
  myNickname,
  onClose,
  onOpen,
}: {
  collab: Collaboration;
  myNickname: string;
  onClose: () => void;
  onOpen: (withGoogle: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setInApp(isInAppBrowser()), []);

  async function open(withGoogle: boolean) {
    setBusy(true);
    setError("");
    try {
      await onOpen(withGoogle);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <Modal
      title="협업 공간 열기"
      description={collab.research.title}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          {error && <p className="text-[13px] text-danger">{error}</p>}
          {inApp ? (
            <button type="button" onClick={copyAddress} className="h-12 w-full rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover">
              {copied ? "주소를 복사했어요. 크롬이나 사파리에 붙여 넣어 주세요" : "주소 복사하기"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => open(true)}
              disabled={busy}
              className="h-12 w-full rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {busy ? "여는 중…" : "구글 계정으로 열기"}
            </button>
          )}
          <button type="button" onClick={() => open(false)} disabled={busy} className="w-full text-center text-[13px] text-muted underline disabled:opacity-60">
            구글 없이 열기 (이 사이트에서만 일정 보기)
          </button>
        </div>
      }
    >
      <p className="text-xs font-semibold text-faint">
        {collab.status === "waiting" ? "시작 전" : "진행 중"} · {formatPeriod(collab.start_date, collab.end_date)}
      </p>
      <p className="mt-3 rounded-button bg-page px-4 py-3 text-sm">
        <b>{myNickname}</b> 님과 <b>{collab.partner.nickname}</b> 님만 볼 수 있는 공간이에요.
      </p>

      <p className="mt-5 text-sm text-muted">일정은 구글 캘린더로 함께 관리해요.</p>
      <ol className="mt-3 space-y-3">
        <Step n={1} title="구글 계정 고르기" hint="크롬에 로그인돼 있으면 계정만 누르면 돼요 · 처음 한 번만" />
        <Step n={2} title="내 구글 캘린더에 추가 (선택)" hint="폰 구글 캘린더에도 이 협업 일정이 뜨고 알림이 와요" />
      </ol>

      {inApp && (
        <p className="mt-5 rounded-button bg-danger-soft px-4 py-3 text-[13px] text-danger">
          디스코드·카카오톡 앱 안에서는 구글 로그인이 막혀 있어요. 주소를 복사해서 크롬이나 사파리에서 열어 주세요.
        </p>
      )}
      <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-faint">구글 이메일은 저장하지 않아요. 캘린더 공유에만 한 번 쓰고 버려요.</p>
    </Modal>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{n}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-faint">{hint}</p>
      </div>
    </li>
  );
}