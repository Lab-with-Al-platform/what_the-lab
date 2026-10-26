"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import { ADMIN_INSIGHTS_PATH, STATUS_LABELS, draftArticle, draftForSave, emptyDraft, publicationKey, scheduleToIso,
  type Candidate, type CandidateDetail, type Draft, type WorkspaceItem } from "@/lib/admin-insights";
import type { InsightArticle } from "@/lib/insights";
import { ADMIN_INPUT, InsightBodyEditor, InsightEvidenceEditor } from "./insight-editor";
import { InsightArticleEditor } from "./insight-article-editor";
import { InsightLivePreview } from "./insight-live-preview";
import { InsightConfirmDialog, type ConfirmAction } from "./insight-confirm-dialog";
import { EMPTY_REVIEW, InsightReview, InsightReviewHistory } from "./insight-review";
import { ADMIN_BUTTON } from "./admin-ui";

const TABS = ["본문·수정", "출처·근거", "승인·게시", "판본·이력"];
const BUTTON = ADMIN_BUTTON;
type RevisionContent = Draft & { article?: InsightArticle; draft?: Draft };

export function InsightEditorDialog({ item, onClose, onChanged }: {
  item: WorkspaceItem | null; onClose: () => void; onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const ticket = useRef(0);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(item ? null : emptyDraft());
  const [article, setArticle] = useState<InsightArticle | null>(null);
  const [publicArticle, setPublicArticle] = useState<InsightArticle | null>(null);
  const [saved, setSaved] = useState(item ? "" : JSON.stringify({ draft: emptyDraft(), article: null }));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(item ? "조회" : "");
  const [tab, setTab] = useState(0);
  const [mobilePanel, setMobilePanel] = useState("editor");
  const [previewChoice, setPreviewChoice] = useState("editing");
  const [review, setReview] = useState({ ...EMPTY_REVIEW });
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const dirty = !!draft && JSON.stringify({ draft, article }) !== saved;
  const readOnly = detail?.status === "published";
  const invalidateRequests = useCallback(() => { ticket.current += 1; }, []);

  const load = useCallback(async (id: string) => {
    const request = ++ticket.current;
    const response = await requestApi<CandidateDetail>(`${ADMIN_INSIGHTS_PATH}/${id}`);
    if (request !== ticket.current) return;
    const current = response.revisions.find((revision) => revision.number === response.current_revision)?.content as RevisionContent | undefined;
    const nextArticle = response.legacy_article ?? response.article ?? null;
    const nextDraft = response.legacy_article ? null : response.review_draft ?? current?.draft ?? current ?? null;
    setDetail(response); setDraft(nextDraft); setArticle(nextArticle);
    setSaved(JSON.stringify({ draft: nextDraft, article: nextArticle }));
    setReview({ ...EMPTY_REVIEW }); setPreviewChoice("editing");
    if (response.publication_id) {
      const publication = await requestApi<{ article: InsightArticle }>(`/admin/insights/publications/${response.publication_id}`);
      if (request === ticket.current) setPublicArticle(publication.article);
    }
  }, []);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal(); closeButton.current?.focus();
    if (item) {
      load(item.id).catch((problem) => setError(problem.message)).finally(() => setBusy(""));
    }
    return () => { invalidateRequests(); element?.close(); };
  }, [item, load, invalidateRequests]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function close() {
    if (busy || (dirty && !window.confirm("저장하지 않은 수정이 있습니다. 버리고 닫을까요?"))) return;
    onClose();
  }

  function changeDraft(next: Draft) {
    setDraft(next);
    if (article) setArticle({ ...article, title: next.title, summary: next.summary, field: next.research_field, tags: next.classification_tags ?? article.tags });
  }

  function changeArticle(next: InsightArticle) {
    setArticle(next);
    if (draft) setDraft({ ...draft, title: next.title, summary: next.summary, research_field: next.field, classification_tags: next.tags });
  }

  async function startCorrection() {
    const publicationId = detail?.publication_id ?? item?.publication_id;
    if (!publicationId || !detail || busy || !review.reason.trim()) return;
    setBusy("수정 초안 만들기"); setError("");
    try {
      const value = await requestApi<Candidate>(`/admin/insights/publications/${publicationId}/correction`, {
        method: "POST", body: JSON.stringify({ expected_version: detail.version, reason: review.reason }),
      });
      await load(value.id); onChanged();
      setNotice("공개본을 유지한 채 별도 수정 초안을 만들었습니다. 다시 검토·승인해야 합니다.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "요청에 실패했습니다."); }
    finally { setBusy(""); }
  }

  async function startArticle() {
    if (!detail || busy || dirty) return;
    setBusy("게시용 원고 만들기"); setError("");
    try {
      const value = await requestApi<Candidate>(`${ADMIN_INSIGHTS_PATH}/${detail.id}/article-draft`, {
        method: "POST", body: JSON.stringify({ expected_version: detail.version, reason: review.reason.trim() || "수집 메모를 보존하고 별도 게시용 원고 작성 시작" }),
      });
      await load(value.id); onChanged();
      setNotice("수집 메모를 이전 판본에 보존하고 편집용 틀을 만들었습니다. 자동 집필이 아니므로 설명·예시·한계를 직접 보완하세요.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "원고를 만들지 못했습니다."); }
    finally { setBusy(""); }
  }

  async function save() {
    if (!draft || busy) return;
    if (detail && !review.reason.trim()) { setError("수정 이유를 적어 주세요."); return; }
    setBusy("저장"); setError(""); setNotice("");
    try {
      const content = draftForSave(draft);
      const path = !detail ? ADMIN_INSIGHTS_PATH : `${ADMIN_INSIGHTS_PATH}/${detail.id}/${article ? "article-revisions" : "revisions"}`;
      const value = await requestApi<Candidate>(path, { method: "POST", body: JSON.stringify(detail ? {
        expected_version: detail.version, draft: content, reason: review.reason, ...(article ? { article: { ...article, tags: article.tags.map((tag) => tag.trim()).filter(Boolean) } } : {}),
      } : content) });
      await load(value.id); onChanged(); setNotice("비공개 초안을 저장했습니다. 공개본은 변경하지 않았습니다.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "저장하지 못했습니다."); }
    finally { setBusy(""); }
  }

  async function perform(action: "submit" | "approve" | "publish", scheduledFor: string | null = null) {
    if (!detail || dirty || busy || !review.reason.trim()) return;
    const selected = detail;
    setBusy(action); setError("");
    try {
      await requestApi(`${ADMIN_INSIGHTS_PATH}/${selected.id}/${action}`, { method: "POST", body: JSON.stringify({
        expected_version: selected.version, reason: review.reason,
        ...(action === "approve" ? { editorial_checked: review.editorial, rights_checked: review.rights, reading_checks: review.reading, scheduled_for: scheduledFor } : {}),
        ...(action === "publish" ? { idempotency_key: publicationKey(selected) } : {}),
      }) });
      await load(selected.id); onChanged();
      if (action === "publish" && article) setPublicArticle(article);
      setNotice(action === "submit" ? "검토 대기로 전환했습니다." : action === "approve" ? "저장된 판본을 승인했습니다. 공개본은 아직 유지됩니다." : "공개 API 스냅샷에 반영했습니다. 일반 사이트는 아직 정적 원고를 사용합니다.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "처리하지 못했습니다.");
      // 쓰기 응답이 끊겨도 자동 재전송하지 않습니다. 먼저 서버의 현재 상태를 확인합니다.
      if (!(problem instanceof ApiError && [401, 403].includes(problem.status ?? 0))) {
        try { await load(selected.id); onChanged(); setNotice("서버 상태를 재조회했습니다. 자동 재전송하지 않았습니다."); }
        catch { setNotice("결과를 확인하지 못했습니다. 닫기 전 서버 최신본을 확인하세요."); }
      }
    } finally { setBusy(""); setConfirmation(null); }
  }

  function actionRequested(action: "submit" | "approve" | "publish") {
    if (action === "submit") { void perform(action); return; }
    try { setConfirmation({ action, scheduledFor: action === "approve" ? scheduleToIso(review.schedule) : null }); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "예약 시각을 확인하세요."); }
  }

  const currentPreview = useMemo(() => article ?? (draft ? draftArticle(draft) : null), [article, draft]);
  const oldRevision = detail?.revisions.find((revision) => String(revision.number) === previewChoice)?.content as RevisionContent | undefined;
  const preview = previewChoice === "public" ? publicArticle ?? currentPreview : oldRevision ? oldRevision.article ?? draftArticle(oldRevision.draft ?? oldRevision) : currentPreview;

  return <dialog ref={dialog} aria-labelledby="insight-editor-title" onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); close(); }} className="m-auto h-[94dvh] max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-[1600px] overflow-hidden rounded-card border border-line bg-white p-0 text-ink shadow-card backdrop:bg-ink/40 sm:w-[calc(100%_-_2rem)]">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="min-w-0"><h2 id="insight-editor-title" className="truncate text-lg font-bold">{item ? "원고 편집·미리보기" : "후보 직접 등록"}</h2><p className="mt-1 text-xs text-muted">{detail ? `${STATUS_LABELS[detail.status]} · 판본 ${detail.current_revision}` : "비공개 초안"} · {busy || (dirty ? "저장하지 않은 수정 있음" : "저장된 내용")}</p></div>
        <div className="flex items-center gap-2">{detail?.publication_id ? <a className={BUTTON} href={`/admin/insights/statistics/${detail.publication_id}?from=published`} onClick={(event) => { if (dirty && !window.confirm("저장하지 않은 수정을 버리고 통계로 이동할까요?")) event.preventDefault(); }}>통계 보기</a> : null}<button ref={closeButton} className={BUTTON} disabled={!!busy} onClick={close}>닫기</button></div>
      </header>
      <div className="flex shrink-0 gap-2 border-b border-line p-2 lg:hidden">{[["editor", "편집"], ["preview", "미리보기"]].map(([key, label]) => <button key={key} className={`${BUTTON} flex-1 ${mobilePanel === key ? "bg-brand-soft text-brand" : ""}`} aria-pressed={mobilePanel === key} onClick={() => setMobilePanel(key)}>{label}</button>)}</div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section aria-label="원고 편집" className={`min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 lg:block lg:border-r lg:border-line ${mobilePanel === "editor" ? "block" : "hidden"}`}>
          {error ? <p role="alert" className="mb-4 whitespace-pre-wrap rounded-card bg-danger-soft p-4 text-sm leading-6">{error}</p> : null}
          {notice ? <p role="status" className="mb-4 rounded-card bg-brand-soft p-4 text-sm leading-7">{notice}</p> : null}
          {draft && !readOnly ? <section className="mb-4 rounded-card border border-line bg-page p-4 text-xs leading-6"><h3 className="font-semibold text-ink">{article ? "게시용 원고 · 출처 검토와 최종 승인은 별도" : "수집 메모 · 게시용 원고가 아닙니다"}</h3>{!article ? <><p>근거 메모를 바탕으로 별도 본문을 작성해야 승인할 수 있습니다. 먼저 저장한 뒤 원고 틀을 만드세요.</p><button type="button" className={`${BUTTON} mt-2 bg-white`} disabled={!!busy || dirty || !detail} onClick={() => void startArticle()}>게시용 원고 만들기</button></> : <p>본문 검토 후 삽화를 준비하고 캡션·권리 표시까지 확인합니다. 그림 없이 게시하는 선택도 가능합니다.</p>}{detail?.editorial_check?.issues.length ? <ul className="mt-2 list-inside list-disc text-muted">{detail.editorial_check.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</section> : null}
          <div role="tablist" aria-label="원고 편집 항목" className="mb-5 grid grid-cols-2 gap-2 xl:grid-cols-4">{TABS.map((label, index) => <button key={label} type="button" role="tab" aria-selected={tab === index} aria-controls={`editor-panel-${index}`} id={`editor-tab-${index}`} tabIndex={tab === index ? 0 : -1} className={`${BUTTON} px-2 ${tab === index ? "bg-brand-soft text-brand" : ""}`} onClick={() => setTab(index)} onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 3 : (index + (event.key === "ArrowRight" ? 1 : 3)) % 4;
            setTab(next); document.getElementById(`editor-tab-${next}`)?.focus();
          }}>{label}</button>)}</div>
          <div role="tabpanel" id={`editor-panel-${tab}`} aria-labelledby={`editor-tab-${tab}`}>
            {readOnly && tab === 3 ? <InsightReviewHistory candidate={detail} /> : <>
            {!draft && !article ? <p>원고를 불러오고 있습니다…</p> : readOnly ? <div className="space-y-4"><p className="rounded-card bg-brand-soft p-4 text-sm leading-7">공개본은 읽기 전용입니다. 오른쪽에서 현재 원고를 확인하고, 편집하려면 수정 초안을 만드세요. 초안 작성·저장·검토 중에도 공개본은 유지됩니다.</p><h3 className="text-lg font-semibold">{article?.title ?? draft?.title}</h3><label className="block text-sm font-semibold">수정 시작 이유<textarea className={ADMIN_INPUT} value={review.reason} onChange={(e) => setReview({ ...review, reason: e.target.value })} maxLength={1000} /></label><button className={`${BUTTON} bg-brand text-white`} disabled={!!busy || !review.reason.trim()} onClick={() => void startCorrection()}>수정 초안 만들기</button></div> : draft ? <fieldset disabled={!!busy} className="min-w-0">
              {tab === 0 ? article ? <InsightArticleEditor article={article} onChange={changeArticle} /> : <InsightBodyEditor draft={draft} existing={!!detail} onChange={changeDraft} /> : tab === 1 ? <div className="space-y-8">{article ? <InsightBodyEditor draft={draft} existing onChange={changeDraft} /> : null}<InsightEvidenceEditor draft={draft} existing={!!detail} onChange={changeDraft} /></div> : tab === 2 ? <InsightReview candidate={detail} draft={draft} dirty={dirty} options={review} busy={!!busy} onChange={setReview} onAction={actionRequested} /> : <InsightReviewHistory candidate={detail} />}
            </fieldset> : null}
            </>}
          </div>
          {draft && !readOnly && tab !== 2 ? <label className="mt-5 block text-sm font-semibold">수정 이유<textarea className={ADMIN_INPUT} value={review.reason} onChange={(e) => setReview({ ...review, reason: e.target.value })} rows={2} maxLength={1000} /></label> : null}
        </section>
        <section aria-label="사이트 미리보기" className={`min-h-0 min-w-0 flex-col bg-page lg:flex ${mobilePanel === "preview" ? "flex" : "hidden"}`}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 text-xs"><span className="font-semibold">실제 기사 본문 미리보기</span><select aria-label="미리보기 판본" className="min-h-11 max-w-full rounded-button border border-line bg-white px-2" value={previewChoice} onChange={(e) => setPreviewChoice(e.target.value)}><option value="editing">{readOnly ? "현재 원고" : "편집 중인 초안"}</option>{publicArticle ? <option value="public">현재 공개본</option> : null}{detail?.revisions.map((revision) => <option key={revision.number} value={revision.number}>저장된 판본 {revision.number}</option>)}</select></div>
          {preview ? <InsightLivePreview article={preview} hideCover={draft?.image_policy === "no_image" && !preview.coverSrc} /> : <p className="p-6 text-sm text-muted">미리보기를 준비하고 있습니다…</p>}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 text-xs sm:px-6"><p className="max-w-xl leading-6 text-muted">저장은 게시가 아닙니다. 공개본 교체는 재승인 후 명시적 게시 때만 합니다. 일반 사이트의 DB 원고 연동은 아직 별도 단계입니다.</p><div className="flex gap-2"><button className={BUTTON} disabled={!!busy || !detail} onClick={() => { if (!dirty || window.confirm("저장하지 않은 수정을 버리고 서버 최신본을 조회할까요?")) { setBusy("조회"); setError(""); setNotice(""); load(detail!.id).catch((problem) => setError(problem.message)).finally(() => setBusy("")); } }}>서버 최신본 조회</button>{draft && !readOnly ? <button className={`${BUTTON} bg-brand text-white`} disabled={!!busy || (!!detail && !dirty)} onClick={() => void save()}>초안 저장</button> : null}</div></footer>
    </div>
    {confirmation && detail && draft ? <InsightConfirmDialog action={confirmation} candidate={detail} draft={draft} busy={!!busy} onCancel={() => setConfirmation(null)} onConfirm={() => void perform(confirmation.action, confirmation.scheduledFor)} /> : null}
  </dialog>;
}
