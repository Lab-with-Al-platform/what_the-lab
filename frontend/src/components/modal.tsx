"use client";

import { ReactNode, useEffect, useId, useState } from "react";
import { ApiError } from "@/lib/api";

export const INPUT_CLASS =
  "h-11 w-full rounded-button border border-line bg-card px-4 text-sm outline-none placeholder:text-faint focus:border-brand";

type ModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
};

/** 작성 폼을 띄우는 창. Esc·바깥 클릭으로 닫히고, 모바일에서는 화면 전체를 씁니다. */
export function Modal({ title, description, onClose, children, footer }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // 창이 떠 있는 동안 뒤 화면이 스크롤되지 않게
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full flex-col bg-card sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-card sm:shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-8">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-button text-xl text-muted hover:bg-page">
            <span className="sr-only">닫기</span>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">{children}</div>
        <div className="border-t border-line px-5 py-4 sm:px-8">{footer}</div>
      </div>
    </div>
  );
}

/** 저장 버튼 상태 도우미. run(저장함수)을 부르면 저장 중 표시와 에러 문구를 알아서 관리해요. */
export function useSaving() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function run(save: () => Promise<void>) {
    setSaving(true);
    setError("");
    try {
      await save();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setSaving(false);
    }
  }

  return { saving, error, run };
}

type ModalActionsProps = {
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  error: string;
  saveLabel?: string;
  onDelete?: () => void; // 있으면 왼쪽에 [삭제] 버튼이 생겨요 (수정할 때만)
};

/** 창 아래 버튼 줄. 삭제는 한 번 더 확인한 뒤 실행합니다. */
export function ModalActions({ onCancel, onSave, canSave, saving, error, saveLabel = "저장하기", onDelete }: ModalActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-[13px] text-danger">
          {error}
        </p>
      )}
      {confirmDelete ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-sm font-semibold text-danger">정말 삭제할까요? 되돌릴 수 없어요.</p>
          <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
            아니요
          </button>
          <button type="button" onClick={onDelete} disabled={saving} className="h-11 rounded-button bg-danger px-5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "삭제하는 중…" : "삭제하기"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          {onDelete && (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving} className="mr-auto h-11 rounded-button px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
              삭제
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={saving} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
          >
            {saving ? "저장하는 중…" : saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}

type ChipProps = {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

/** 고르는 칩. 고르면 보라색으로 바뀌어요. */
export function Chip({ selected, disabled, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled && !selected}
      onClick={onClick}
      className={`h-9 rounded-full border px-4 text-sm transition disabled:opacity-40 ${
        selected ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-card text-ink hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}

type FieldTitleProps = {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  extra?: ReactNode; // 오른쪽 끝 작은 글씨 (예: 3 / 5개)
  htmlFor?: string;
};

/** 입력 칸 제목. 필수면 *, 선택이면 (선택)을 붙여요. */
export function FieldTitle({ children, required, optional, extra, htmlFor }: FieldTitleProps) {
  return (
    <div className="mb-2 flex items-center gap-1 text-sm font-semibold">
      <label htmlFor={htmlFor}>{children}</label>
      {required && <span className="text-danger">*</span>}
      {optional && <span className="font-normal text-faint">(선택)</span>}
      {extra && <span className="ml-auto text-xs font-normal text-faint">{extra}</span>}
    </div>
  );
}

/** 목록에 있으면 빼고, 없으면 넣습니다. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}