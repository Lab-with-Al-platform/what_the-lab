"use client";

import { CLAIM_LABELS, TREND_CLAIM_LABELS, READING_CHECK_LABELS, formatAdminTime, safeSourceUrl, type CandidateDetail, type Draft } from "@/lib/admin-insights";
import { API_BASE_URL } from "@/lib/api";
import { ADMIN_INPUT } from "./insight-editor";
import { ADMIN_BUTTON } from "./admin-ui";

export type ReviewOptions = { reason: string; editorial: boolean; rights: boolean; schedule: string; reading: Record<keyof typeof READING_CHECK_LABELS, boolean> };
export const EMPTY_REVIEW: ReviewOptions = { reason: "", editorial: false, rights: false, schedule: "", reading: { clear_question: false, input_output: false, plain_language: false, concrete_example: false, limitations: false, source_separation: false } };

export function InsightReview({ candidate, draft, dirty, options, busy, onChange, onAction }: {
  candidate: CandidateDetail | null; draft: Draft; dirty: boolean; options: ReviewOptions; busy: boolean;
  onChange: (value: ReviewOptions) => void; onAction: (action: "submit" | "approve" | "publish") => void;
}) {
  const ready = candidate?.approval_check.ready === true && !dirty;
  const future = candidate?.scheduled_for && new Date(candidate.scheduled_for).getTime() > Date.now();
  const source = safeSourceUrl(draft.source.url);
  const label = !candidate || dirty ? "먼저 저장해 주세요" : candidate.approval_check.message;
  return <div className="space-y-6">
    <section className={`rounded-card border p-4 text-sm leading-6 ${ready ? "border-success/30 bg-success-soft text-ink" : "border-line bg-page text-muted"}`}>
      <h3 className="font-semibold">저장된 판본의 승인 전 검사</h3><p className="mt-1">{label}</p>
      <p className="mt-2 text-xs">조건 통과는 자동 승인이 아닙니다. 편집·권리 확인과 관리자 판단이 별도로 필요합니다.</p>
    </section>
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">출처 대조용 근거 메모</h3>
      <p className="text-xs leading-6 text-muted">게시용 전체 본문은 오른쪽 미리보기에서 확인합니다. 아래 메모만으로 최종 원고를 대신하지 않습니다.</p>
      <div className="rounded-card border border-line p-4 sm:p-5 [overflow-wrap:anywhere]">
        <p className="text-xs font-semibold text-brand">{draft.research_field || "연구 분야 미입력"}</p>
        <h4 className="mt-2 text-xl font-bold leading-snug">{draft.title || "제목 미입력"}</h4>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{draft.summary}</p>
        {Object.entries(draft.kind === "trend" ? TREND_CLAIM_LABELS : CLAIM_LABELS).map(([field, title]) => {
          const claim = draft.claims.find((item) => item.field === field);
          return <div key={field} className="mt-5 border-t border-line pt-4"><h5 className="text-sm font-semibold">{title}</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">{claim?.text || "내용 미입력"}</p><p className="mt-2 text-xs text-faint">근거 위치: {claim?.locator || "미입력"}</p></div>;
        })}
        {draft.glossary?.length ? <div className="mt-5 border-t border-line pt-4"><h5 className="font-semibold">용어 풀이</h5>{draft.glossary.map((term, index) => <p className="mt-2 text-sm leading-7" key={index}><strong>{term.label}</strong> · {term.definition}</p>)}</div> : null}
        {source ? <a href={source} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">원 출처 확인 ↗</a> : null}
      </div>
    </section>
    {candidate?.status === "published" ? <div className="rounded-card bg-brand-soft p-4 text-sm leading-6">
      이 판본은 게시되었습니다. 게시 후 정정은 별도 절차이며 이 화면에서 덮어쓰지 않습니다.
      <a className="mt-2 block font-semibold text-brand underline" href={`${API_BASE_URL}/insights/${encodeURIComponent(draft.slug)}`} target="_blank" rel="noreferrer">공개 API 스냅샷 보기 ↗</a>
      <p className="mt-2 text-xs text-muted">일반 사례·트렌드 페이지에 자동으로 나타나는 연동은 아직 별도 단계입니다.</p>
    </div> : <section className="space-y-4 border-t border-line pt-6">
      <h3 className="text-lg font-semibold">검토와 게시</h3>
      <fieldset className="space-y-2 rounded-card border border-line p-4"><legend className="px-1 text-sm font-semibold">독자 관점의 원고 검수 · 6항목</legend>
        <p className="text-xs leading-6 text-muted">글자 수가 아닌 실제 설명을 읽고 확인하세요. 체크는 최종 승인할 판본에만 적용되며 저장·재조회 시 초기화됩니다.</p>
        {Object.entries(READING_CHECK_LABELS).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 text-sm leading-6"><input type="checkbox" checked={options.reading[key as keyof typeof READING_CHECK_LABELS]} onChange={(event) => onChange({ ...options, reading: { ...options.reading, [key]: event.target.checked } })} />{label}</label>)}
      </fieldset>
      <label className="block text-sm font-semibold">작업 이유 · 필수<textarea aria-label="작업 이유 · 필수" className={ADMIN_INPUT} rows={3} maxLength={1000} value={options.reason} onChange={(e) => onChange({ ...options, reason: e.target.value })} /></label>
      <label className="flex min-h-11 items-start gap-3 py-2 text-sm leading-6"><input className="mt-1" type="checkbox" checked={options.editorial} onChange={(e) => onChange({ ...options, editorial: e.target.checked })} />원문 결과와 해석을 구분하고 연구자에게 도움이 되는 내용인지 직접 검토했습니다</label>
      <label className="flex min-h-11 items-start gap-3 py-2 text-sm leading-6"><input className="mt-1" type="checkbox" checked={options.rights} onChange={(e) => onChange({ ...options, rights: e.target.checked })} />출처·인용·이미지 이용 권리를 직접 확인했습니다</label>
      <label className="block text-sm font-semibold">승인 시 게시 가능 시각 · 한국 시간, 선택<input className={ADMIN_INPUT} type="datetime-local" value={options.schedule} onChange={(e) => onChange({ ...options, schedule: e.target.value })} disabled={candidate?.status === "approved"} /></label>
      <p className="text-xs leading-5 text-muted">현재 예약: {formatAdminTime(candidate?.scheduled_for ?? null)}. 시각이 지나면 새로고침 후 수동 게시합니다. 예약 worker는 아직 없습니다.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || dirty || candidate?.status !== "draft" || !options.reason.trim()} onClick={() => onAction("submit")} className={ADMIN_BUTTON}>검토 요청</button>
        <button type="button" disabled={busy || !ready || candidate?.status !== "pending_review" || !options.editorial || !options.rights || !Object.values(options.reading).every(Boolean) || !options.reason.trim()} onClick={() => onAction("approve")} className={`${ADMIN_BUTTON} bg-brand text-white hover:bg-brand-hover`}>승인하기</button>
        <button type="button" disabled={busy || dirty || candidate?.status !== "approved" || !!future || !options.reason.trim()} onClick={() => onAction("publish")} className={`${ADMIN_BUTTON} bg-ink text-white`}>게시하기</button>
      </div>
      {dirty ? <p className="text-sm text-brand">저장하지 않은 수정이 있어 승인·게시를 잠갔습니다. 저장하면 기존 승인은 무효화됩니다.</p> : null}
    </section>}
  </div>;
}

const ACTION_LABELS: Record<string, string> = { created: "후보 등록", imported: "후보 반입", article_drafted: "수집 메모 보존 · 게시용 원고 작성", revised: "판본 수정", submitted: "검토 요청", approved: "승인", published: "게시", correction_started: "공개본 유지 · 수정 초안 생성", correction_published: "재승인한 수정본을 공개 API에 반영", legacy_imported: "기존 원고 보존 이관" };
export function InsightReviewHistory({ candidate }: { candidate: CandidateDetail | null }) {
  return <section className="space-y-4"><h3 className="text-lg font-semibold">검토 이력</h3>
    {!candidate ? <p className="text-sm text-muted">후보를 저장하면 이력이 기록됩니다.</p> : <ol className="space-y-3">{candidate.events.map((event, index) => <li key={index} className="rounded-card border border-line p-4 text-sm [overflow-wrap:anywhere]">
      <p className="font-semibold">{ACTION_LABELS[event.action] ?? event.action} · 판본 {event.revision}</p>
      <p className="mt-1 text-xs text-muted">{formatAdminTime(event.created_at)} · {event.actor_discord_id.startsWith("system:") ? "시스템 이관·수집 작업" : `Discord ID ${event.actor_discord_id}`}</p>
      <p className="mt-3 whitespace-pre-wrap leading-6">{event.reason}</p>
    </li>)}</ol>}
  </section>;
}
