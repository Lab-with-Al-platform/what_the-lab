"use client";

import { cloneElement, useId, type ReactElement } from "react";
import { ADMIN_FIELD } from "./admin-ui";
import { InsightKeywordPicker } from "./insight-keyword-picker";
import {
  CLAIM_LABELS, TREND_CLAIM_LABELS, SCORE_LABELS, safeSourceUrl, type Claim, type Draft, type Score,
} from "@/lib/admin-insights";

export const ADMIN_INPUT = ADMIN_FIELD;

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  // 설명과 입력값이 접근성 이름에 섞이지 않도록 명시적으로 연결합니다.
  return <div className="min-w-0 text-sm font-semibold text-ink"><label className="block" htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}

export function InsightBodyEditor({ draft, existing = false, onChange }: { draft: Draft; existing?: boolean; onChange: (draft: Draft) => void }) {
  function changeClaim(field: Claim["field"], update: Partial<Claim>) {
    const previous = draft.claims.find((claim) => claim.field === field) ?? {
      field, text: "", locator: "", verification: "needs_review", evidence_level: "unavailable",
    };
    const claims = draft.claims.filter((claim) => claim.field !== field);
    onChange({ ...draft, claims: [...claims, { ...previous, ...update }] });
  }
  return <div className="space-y-6">
    <Field label="원고 유형"><select aria-label="원고 유형" disabled={existing} className={ADMIN_INPUT} value={draft.kind ?? "case"} onChange={(e) => onChange({ ...draft, kind: e.target.value as Draft["kind"] })}><option value="case">협업사례</option><option value="trend">AI 트렌드 · 쉬운 기술 해설</option></select></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="게시 제목"><input className={ADMIN_INPUT} maxLength={180} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} /></Field>
      <Field label="글 주소 · 영문 소문자·숫자·하이픈"><input className={ADMIN_INPUT} maxLength={100} value={draft.slug} onChange={(e) => onChange({ ...draft, slug: e.target.value })} /></Field>
    </div>
    <Field label="요약"><textarea rows={3} className={ADMIN_INPUT} maxLength={600} value={draft.summary} onChange={(e) => onChange({ ...draft, summary: e.target.value })} /></Field>
    <Field label="분류 키워드 · 쉼표로 구분"><input className={ADMIN_INPUT} value={(draft.classification_tags ?? []).join(",")} onChange={(e) => onChange({ ...draft, classification_tags: e.target.value.split(",") })} /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="연구 분야"><input className={ADMIN_INPUT} maxLength={100} value={draft.research_field} onChange={(e) => onChange({ ...draft, research_field: e.target.value })} /></Field>
      {draft.kind !== "trend" ? <Field label="사례 분류"><select className={ADMIN_INPUT} value={draft.case_type} onChange={(e) => onChange({ ...draft, case_type: e.target.value as Draft["case_type"] })}><option value="research">연구사례</option><option value="practical">실용 사례</option></select></Field> : null}
    </div>
    <div className="rounded-button bg-brand-soft p-4 text-sm leading-6 text-muted">{draft.kind === "trend" ? "쉬운 설명·용어·한계를 작성하는 수집 단계입니다. 전용 게시 검증 연결 전에는 승인·게시할 수 없습니다." : "초안에는 주장 한 항목 이상이 필요합니다. 승인하려면 아래 8개 항목 모두에 검토한 근거와 위치를 작성해야 합니다."} 원문 결과와 해석·적용 제안을 문장에서도 구분하세요.</div>
    {(Object.entries(draft.kind === "trend" ? TREND_CLAIM_LABELS : CLAIM_LABELS) as [Claim["field"], string][]).map(([field, label], index) => {
      const claim = draft.claims.find((item) => item.field === field);
      return <section key={field} className="rounded-card border border-line p-4 sm:p-5">
        <h3 className="mb-4 font-semibold text-ink"><span className="mr-2 text-brand">{String(index + 1).padStart(2, "0")}</span>{label}</h3>
        <Field label={`${label} · 본문`}><textarea className={ADMIN_INPUT} rows={4} maxLength={1000} value={claim?.text ?? ""} onChange={(e) => changeClaim(field, { text: e.target.value })} /></Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`${label} · 근거 종류`}><select className={ADMIN_INPUT} value={claim?.evidence_level ?? "unavailable"} onChange={(e) => changeClaim(field, { evidence_level: e.target.value as Claim["evidence_level"] })}>
            <option value="unavailable">아직 근거 없음</option><option value="abstract">초록</option><option value="official">공식 기관·연구팀 자료</option><option value="fulltext">허용된 논문 원문</option>
          </select></Field>
          <Field label={`${label} · 검토 상태`}><select className={ADMIN_INPUT} value={claim?.verification ?? "needs_review"} onChange={(e) => changeClaim(field, { verification: e.target.value as Claim["verification"] })}>
            <option value="needs_review">검토 필요</option><option value="verified">직접 근거 확인 완료</option><option value="unsupported">근거로 뒷받침되지 않음</option>
          </select></Field>
        </div>
        <div className="mt-4"><Field label={`${label} · 원문 위치`}><input className={ADMIN_INPUT} maxLength={300} placeholder="예: Methods의 평가 절차 / Table 2" value={claim?.locator ?? ""} onChange={(e) => changeClaim(field, { locator: e.target.value })} /></Field></div>
      </section>;
    })}
    <section className="space-y-3 rounded-card border border-line p-4">
      <h3 className="font-semibold">용어 풀이</h3>
      {(draft.glossary ?? []).map((term, index) => <div key={index} className="grid gap-2 sm:grid-cols-[150px_1fr]">
        <Field label="용어"><input className={ADMIN_INPUT} maxLength={100} value={term.label} onChange={(e) => onChange({ ...draft, glossary: draft.glossary?.map((item, i) => i === index ? { ...item, label: e.target.value } : item) })} /></Field>
        <Field label="쉬운 설명"><textarea className={ADMIN_INPUT} maxLength={1000} value={term.definition} onChange={(e) => onChange({ ...draft, glossary: draft.glossary?.map((item, i) => i === index ? { ...item, definition: e.target.value } : item) })} /></Field>
        <button type="button" className="min-h-11 text-sm text-muted" onClick={() => onChange({ ...draft, glossary: draft.glossary?.filter((_, i) => i !== index) })}>이 용어 삭제</button>
      </div>)}
      <button type="button" disabled={(draft.glossary?.length ?? 0) >= 10} className="min-h-11 text-sm font-semibold text-brand disabled:opacity-40" onClick={() => onChange({ ...draft, glossary: [...(draft.glossary ?? []), { label: "", definition: "" }] })}>용어 추가 · 최대 10개</button>
    </section>
  </div>;
}

export function InsightEvidenceEditor({ draft, existing, onChange }: { draft: Draft; existing: boolean; onChange: (draft: Draft) => void }) {
  function source(update: Partial<Draft["source"]>) { onChange({ ...draft, source: { ...draft.source, ...update } }); }
  function score(criterion: Score["criterion"], update: Partial<Score>) {
    const previous = draft.scores.find((item) => item.criterion === criterion) ?? { criterion, value: 0, rationale: "" };
    onChange({ ...draft, scores: [...draft.scores.filter((item) => item.criterion !== criterion), { ...previous, ...update }] });
  }
  const url = safeSourceUrl(draft.source.url);
  return <div className="space-y-6">
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">출처와 접근 수준</h3>
      <Field label="원 출처 제목"><input className={ADMIN_INPUT} maxLength={500} value={draft.source.title} onChange={(e) => source({ title: e.target.value })} /></Field>
      <Field label="원 출처 URL · HTTPS"><input className={ADMIN_INPUT} type="url" disabled={existing} value={draft.source.url} onChange={(e) => source({ url: e.target.value })} /></Field>
      {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">원문 새 창에서 확인 ↗</a> : null}
      <Field label="DOI · 없으면 비워 두기"><input className={ADMIN_INPUT} disabled={existing} value={draft.source.doi ?? ""} onChange={(e) => source({ doi: e.target.value || null })} /></Field>
      {existing ? <p className="text-xs leading-5 text-muted">DOI와 출처 URL은 기존 후보의 식별자라 수정하지 않습니다. 다른 출처는 새 후보로 등록하세요.</p> : null}
      <Field label="원문 접근 수준"><select className={ADMIN_INPUT} value={draft.source.access_level} onChange={(e) => source({ access_level: e.target.value as Draft["source"]["access_level"] })}>
        <option value="unknown">아직 확인하지 않음</option><option value="metadata_only">서지·초록만 확인 가능</option><option value="restricted">접근 제한</option><option value="open_authorized">허용된 원문 접근 확인</option>
      </select></Field>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.source.bibliography_checked} onChange={(e) => source({ bibliography_checked: e.target.checked })} /> DOI·제목·원 출처의 서지 일치를 직접 확인했습니다</label>
    </section>
    {draft.kind === "trend" ? <p className="rounded-card bg-brand-soft p-4 text-sm leading-7">트렌드는 쉬운 설명·용어 풀이·원문과 해석의 구분을 검토하는 수집 단계입니다. 사례용 12점 평가를 억지로 적용하지 않으며, 전용 게시 검증 연결 전에는 승인·게시가 차단됩니다.</p> : <section className="space-y-4 border-t border-line pt-6">
      <h3 className="text-lg font-semibold">사례 적합성 평가 · 12점</h3>
      <p className="text-sm leading-6 text-muted">9점 이상은 검토 기준이지 논문의 우수성 인증이 아닙니다. 7개 평가에 판단 이유를 남겨 주세요.</p>
      {(Object.entries(SCORE_LABELS) as [Score["criterion"], string][]).map(([criterion, label]) => {
        const current = draft.scores.find((item) => item.criterion === criterion);
        const maximum = ["input_data", "limitations"].includes(criterion) ? 1 : 2;
        return <div key={criterion} className="grid gap-3 rounded-card border border-line p-4 sm:grid-cols-[100px_1fr]">
          <Field label={`${label} · 점수`}><select className={ADMIN_INPUT} value={current?.value ?? 0} onChange={(e) => score(criterion, { value: Number(e.target.value) })}>
            {Array.from({ length: maximum + 1 }, (_, value) => <option key={value} value={value}>{value} / {maximum}</option>)}
          </select></Field>
          <Field label={`${label} · 판단 이유`}><textarea className={ADMIN_INPUT} maxLength={1000} rows={2} value={current?.rationale ?? ""} onChange={(e) => score(criterion, { rationale: e.target.value })} /></Field>
        </div>;
      })}
    </section>}
    <section className="space-y-4 border-t border-line pt-6">
      <h3 className="text-lg font-semibold">키워드와 이미지</h3>
      <InsightKeywordPicker value={draft.keyword_ids} onChange={(keyword_ids) => onChange({ ...draft, keyword_ids })} />
      <p className="text-xs leading-5 text-muted">키워드를 비워 두면 일반 전문가 탐색으로 연결합니다. 고른 CAP ID가 운영 승인 상태인지 승인할 때 서버가 다시 확인합니다.</p>
      <Field label="이미지 정책"><select className={ADMIN_INPUT} value={draft.image_policy} onChange={(e) => onChange({ ...draft, image_policy: e.target.value as Draft["image_policy"] })}>
        <option value="no_image">이미지 사용 안 함</option><option value="rights_checked">이미지 권리 확인 완료</option>
      </select></Field>
      <p className="text-xs leading-5 text-muted">이 화면은 이미지 업로드·수집을 하지 않습니다. 정책 선택만으로 이미지가 추가되지는 않습니다.</p>
    </section>
  </div>;
}
