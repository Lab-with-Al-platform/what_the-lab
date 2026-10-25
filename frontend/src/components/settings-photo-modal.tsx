"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, useSaving } from "@/components/modal";
import { requestApi } from "@/lib/api";
import { photoOrDefault } from "@/lib/collab-requests";
import { announceMeChanged, PHOTO_LIMIT_MB, PHOTO_TYPES } from "@/lib/profile-settings";

type Props = {
  current: string | null; // 지금 사진 주소 (없으면 기본 이미지)
  role: "researcher" | "expert"; // 기본 이미지를 고를 때 써요
  onClose: () => void;
  onSaved: (photo: string) => void; // 저장된 새 사진 주소
};

/** 프로필 사진 바꾸기 창. 고른 사진은 가운데를 기준으로 정사각형으로 잘려 저장돼요. */
export function SettingsPhotoModal({ current, role, onClose, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // 고른 파일 미리보기 주소
  const [pickError, setPickError] = useState("");
  const saving = useSaving();

  // 미리보기 주소는 다 쓰면 풀어 줘요 (메모리 정리)
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(selected: File | undefined) {
    if (!selected) return;
    if (!PHOTO_TYPES.includes(selected.type)) return setPickError("JPG·PNG·WEBP 사진만 올릴 수 있어요");
    if (selected.size > PHOTO_LIMIT_MB * 1024 * 1024) return setPickError(`${PHOTO_LIMIT_MB}MB 이하 사진만 올릴 수 있어요`);
    setPickError("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function finish(photo: string) {
    onSaved(photo);
    announceMeChanged(); // 헤더 프로필 사진도 바로 바뀌게
    onClose();
  }

  const upload = () =>
    saving.run(async () => {
      if (!file) return;
      // 파일을 그대로 보내요 (연구 PDF 올리기와 같은 방식)
      const data = await requestApi<{ user_photo: string }>("/me/photo", { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      finish(data.user_photo);
    });

  return (
    <Modal
      title="프로필 사진 바꾸기"
      description="협업 상대에게 보이는 사진이에요. 얼굴이 잘 보이는 사진을 추천해요."
      onClose={onClose}
      footer={
        <div>
          {(saving.error || pickError) && (
            <p role="alert" className="mb-3 text-[13px] text-danger">
              {saving.error || pickError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving.saving} className="h-11 rounded-button border border-line px-5 text-sm font-semibold text-muted hover:bg-page">
              취소
            </button>
            <button
              type="button"
              onClick={upload}
              disabled={!file || saving.saving}
              className="h-11 rounded-button bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
            >
              {saving.saving ? "저장하는 중…" : "저장하기"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- 고른 파일 미리보기(blob) 또는 지금 사진 */}
        <img src={preview ?? photoOrDefault(current, role)} alt="" width={160} height={160} className="h-40 w-40 rounded-full border border-line bg-page object-cover" />
        <p className="mt-3 text-[13px] text-faint">{file ? "가운데를 기준으로 동그랗게 보여요" : "지금 쓰고 있는 사진이에요"}</p>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = ""; // 같은 파일을 다시 골라도 바뀌게
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 h-11 rounded-button border border-line px-5 text-sm font-semibold hover:bg-page">
          {file ? "다른 사진 고르기" : "사진 고르기"}
        </button>
        <p className="mt-4 text-xs text-faint">JPG·PNG·WEBP, {PHOTO_LIMIT_MB}MB 이하 · 400×400 정사각형으로 저장돼요</p>
      </div>
    </Modal>
  );
}