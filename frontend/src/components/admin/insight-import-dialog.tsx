"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { requestApi } from "@/lib/api";
import { IMPORT_ACTION_LABELS, IMPORT_PATH, KIND_LABELS, parseImportBatch, type Draft, type ImportResult } from "@/lib/admin-insights";
import { ADMIN_BUTTON, ADMIN_FIELD } from "./admin-ui";

// 예약 작업이 만드는 candidates.json은 수십 KB 수준이라 1MB면 충분합니다.
const MAX_FILE_BYTES = 1024 * 1024;

/** 후보 묶음(JSON)을 먼저 미리 보고, 확인한 뒤에만 비공개 초안으로 저장합니다. */
export function InsightImportDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  // 미리 본 글과 저장할 글이 반드시 같도록, 미리 볼 때의 원문을 함께 기억합니다.
  const [preview, setPreview] = useState<{ text: string; drafts: Draft[]; result: ImportResult } | null>(null);
  const [saved, setSaved] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const previewIsCurrent = preview !== null && preview.text === text;
  const shown = saved ?? (previewIsCurrent ? preview.result : null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("파일이 너무 큽니다. 1MB 이하의 JSON만 가져올 수 있습니다."); return; }
    setText(await file.text()); setSaved(null); setError("");
  }

  async function send(drafts: Draft[], dryRun: boolean): Promise<ImportResult> {
    return requestApi<ImportResult>(IMPORT_PATH, { method: "POST", body: JSON.stringify({ dry_run: dryRun, drafts }) });
  }

  async function runPreview() {
    const parsed = parseImportBatch(text);
    if ("error" in parsed) { setError(parsed.error); setPreview(null); return; }
    setBusy(true); setError(""); setSaved(null);
    try { setPreview({ text, drafts: parsed.drafts, result: await send(parsed.drafts, true) }); }
    catch (problem) { setPreview(null); setError(problem instanceof Error ? problem.message : "미리 보기에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!previewIsCurrent) return;
    setBusy(true); setError("");
    try {
      // 미리 본 뒤 다른 사람이 같은 출처를 저장했을 수 있으므로, 화면에는 서버의 실제 저장 결과를 다시 보여 줍니다.
      setSaved(await send(preview.drafts, false));
      onChanged();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  const drafts = preview?.drafts ?? [];
  return <dialog ref={ref} aria-labelledby="insight-import-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-card border border-line bg-white p-6 text-ink shadow-card backdrop:bg-ink/40">
    <h2 id="insight-import-title" className="text-xl font-bold">후보 묶음 가져오기</h2>
    <p className="mt-2 text-sm leading-6 text-muted">예약 수집이 만든 <code>candidates.json</code>을 붙여 넣거나 파일로 선택하세요. 먼저 미리 보기로 중복을 확인한 뒤 저장합니다.</p>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label className={`${ADMIN_BUTTON} cursor-pointer bg-white`}>JSON 파일 선택<input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={readFile} /></label>
      <span className="text-xs text-muted">한 번에 최대 50건 · 1MB 이하</span>
    </div>
    <label className="mt-3 block text-sm font-semibold">JSON 내용
      <textarea className={`${ADMIN_FIELD} h-44 font-mono text-xs`} value={text} disabled={busy} spellCheck={false}
        placeholder='{"dry_run": true, "drafts": [ ... ]}' onChange={(event) => { setText(event.target.value); setSaved(null); }} />
    </label>
    {preview && !previewIsCurrent && !saved ? <p className="mt-2 text-xs text-muted">내용이 바뀌었습니다. 저장하려면 다시 미리 보기를 해 주세요.</p> : null}
    {error ? <p role="alert" className="mt-3 whitespace-pre-line rounded-card bg-danger-soft p-3 text-sm leading-6">{error}</p> : null}

    {shown ? <section className="mt-5" aria-live="polite">
      <h3 className="text-sm font-bold">{saved ? "저장 결과" : "미리 보기 결과 · 아직 저장하지 않았습니다"}</h3>
      <p className="mt-1 text-sm text-muted">
        {saved ? `생성 ${shown.created}건` : `새로 생성 ${shown.would_create}건`} · 기존 후보 유지 {shown.existing_preserved}건 · 묶음 안 중복 {shown.duplicate_in_batch}건
      </p>
      <div className="mt-3 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-page text-xs text-muted"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">유형</th><th className="px-3 py-2">제목 · 글 주소</th><th className="px-3 py-2">결과</th></tr></thead>
          <tbody>{shown.items.map((item) => {
            const draft = drafts[item.index];
            return <tr key={item.index} className="border-t border-line align-top">
              <td className="px-3 py-2 tabular-nums">{item.index + 1}</td>
              <td className="px-3 py-2">{draft?.kind ? KIND_LABELS[draft.kind] : "협업사례"}</td>
              <td className="px-3 py-2 [overflow-wrap:anywhere]"><span className="font-semibold">{draft?.title}</span><br /><span className="text-xs text-muted">{draft?.slug} · {draft?.source?.doi ?? draft?.source?.url}</span></td>
              <td className="px-3 py-2">
                <span className="whitespace-nowrap">{IMPORT_ACTION_LABELS[item.action]}</span>
                {item.duplicate_of !== null ? <span className="block text-xs text-muted">{item.duplicate_of + 1}번과 같은 출처</span> : null}
                {item.keyword_ids?.length ? <span className="block text-xs text-muted">기술 ID 제안: {item.keyword_ids.join(", ")}</span> : null}
                {item.dropped_keyword_ids?.length ? <span className="block text-xs text-danger">승인 목록에 없어 제외: {item.dropped_keyword_ids.join(", ")}</span> : null}
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section> : null}

    <p className="mt-4 text-xs leading-5 text-muted">저장된 후보는 비공개 초안입니다. 파일에 적힌 검증 표시·점수·이미지 권리는 초기화됩니다. 기술 ID는 승인된 분류체계(v4.0 CAP)에 있는 것만 제안값으로 남으니, 승인 전에 확인하고 필요할 때만 바꿔 주세요.</p>
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button type="button" className={ADMIN_BUTTON} disabled={busy} onClick={onClose}>{saved ? "닫기" : "취소"}</button>
      {!saved ? <>
        <button type="button" className={`${ADMIN_BUTTON} bg-white`} disabled={busy || !text.trim()} onClick={runPreview}>{busy && !previewIsCurrent ? "확인 중…" : "미리 보기"}</button>
        <button type="button" className={`${ADMIN_BUTTON} bg-brand text-white hover:bg-brand-hover`} disabled={busy || !previewIsCurrent || preview.result.would_create === 0} onClick={save}>
          {busy && previewIsCurrent ? "저장 중…" : `새 후보 ${previewIsCurrent ? preview.result.would_create : 0}건 저장`}
        </button>
      </> : null}
    </div>
  </dialog>;
}
