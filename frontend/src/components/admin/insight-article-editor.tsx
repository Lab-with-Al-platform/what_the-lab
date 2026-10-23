"use client";

import type { InsightArticle, InsightParagraph } from "@/lib/insights";
import { ADMIN_INPUT } from "./insight-editor";

/** 공개 원고의 편집자 노트 유형과 긴 본문을 줄이거나 일반 문단으로 바꾸지 않습니다. */
export function InsightArticleEditor({ article, onChange }: { article: InsightArticle; onChange: (article: InsightArticle) => void }) {
  function paragraph(sectionIndex: number, index: number, update: Partial<InsightParagraph>) {
    onChange({ ...article, sections: article.sections.map((section, s) => s !== sectionIndex ? section : {
      ...section, paragraphs: section.paragraphs.map((value, p) => {
        if (p !== index) return value;
        const current = typeof value === "string" ? { kind: "body" as const, text: value } : value;
        return { ...current, ...update };
      }),
    }) });
  }
  function addTerm() {
    const terms = article.glossary ?? [];
    let number = terms.length + 1;
    // 기존 용어의 연결 ID는 바꾸지 않고, 겹치지 않는 새 ID를 만듭니다.
    while (terms.some((term) => term.id === `editorial-term-${number}`)) number += 1;
    onChange({ ...article, glossary: [...terms, { id: `editorial-term-${number}`, label: "새 용어", definition: "본문에서 사용하는 뜻을 쉽게 풀어 써 주세요." }] });
  }
  return <div className="space-y-5">
    <p className="rounded-card bg-brand-soft p-4 text-sm leading-7">게시용 전체 본문을 편집합니다. 저장은 게시가 아니며, 기존 공개본이 있다면 그대로 유지됩니다. 출처 대조용 근거 메모와 이미지·권리 설명은 별도로 보존합니다.</p>
    <label className="block text-sm font-semibold">게시 제목<input className={ADMIN_INPUT} maxLength={180} value={article.title} onChange={(e) => onChange({ ...article, title: e.target.value })} /></label>
    <label className="block text-sm font-semibold">요약<textarea className={ADMIN_INPUT} maxLength={600} rows={4} value={article.summary} onChange={(e) => onChange({ ...article, summary: e.target.value })} /></label>
    <label className="block text-sm font-semibold">연구 분야<input className={ADMIN_INPUT} maxLength={100} value={article.field} onChange={(e) => onChange({ ...article, field: e.target.value })} /></label>
    <label className="block text-sm font-semibold">분류 키워드 · 쉼표로 구분<input className={ADMIN_INPUT} value={article.tags.join(",")} onChange={(e) => onChange({ ...article, tags: e.target.value.split(",") })} /></label>
    {article.sections.map((section, sectionIndex) => <section key={section.id} className="space-y-3 rounded-card border border-line p-4">
      <label className="block text-sm font-semibold">섹션 {sectionIndex + 1} 제목<input className={ADMIN_INPUT} value={section.title} onChange={(e) => onChange({ ...article, sections: article.sections.map((item, i) => i === sectionIndex ? { ...item, title: e.target.value, toc: e.target.value } : item) })} /></label>
      {section.paragraphs.map((value, index) => <div key={index} className="space-y-2">
        <select aria-label={`섹션 ${sectionIndex + 1} 문단 ${index + 1} 분류`} className={ADMIN_INPUT} value={typeof value === "string" ? "body" : value.kind} onChange={(e) => paragraph(sectionIndex, index, { kind: e.target.value as InsightParagraph["kind"] })}>
          <option value="body">원문 설명</option><option value="interpretation">연구자에게 주는 의미</option><option value="application">내 연구에 적용한다면</option><option value="caution">주의할 점 · 적용의 경계</option>
        </select>
        <label className="block text-xs font-semibold">섹션 {sectionIndex + 1} 문단 {index + 1}<textarea className={ADMIN_INPUT} rows={5} maxLength={20000} value={typeof value === "string" ? value : value.text} onChange={(e) => paragraph(sectionIndex, index, { text: e.target.value })} /></label>
      </div>)}
      <button type="button" className="rounded-control border border-line px-3 py-2 text-xs" onClick={() => onChange({ ...article, sections: article.sections.map((item, i) => i === sectionIndex ? { ...item, paragraphs: [...item.paragraphs, { kind: "body", text: "" }] } : item) })}>문단 추가</button>
      {section.steps?.length ? <p className="text-xs text-muted">기존 단계 설명 {section.steps.length}개는 그대로 보존됩니다.</p> : null}
    </section>)}
    {article.glossary?.map((term, index) => <div key={term.id} className="space-y-2"><label className="block text-sm font-semibold">용어 이름<input className={ADMIN_INPUT} maxLength={200} value={term.label} onChange={(e) => onChange({ ...article, glossary: article.glossary?.map((item, i) => i === index ? { ...item, label: e.target.value } : item) })} /></label><label className="block text-sm font-semibold">쉬운 풀이<textarea className={ADMIN_INPUT} rows={3} value={term.definition} onChange={(e) => onChange({ ...article, glossary: article.glossary?.map((item, i) => i === index ? { ...item, definition: e.target.value } : item) })} /></label></div>)}
    <button type="button" className="rounded-control border border-line px-3 py-2 text-xs" disabled={(article.glossary?.length ?? 0) >= 10} onClick={addTerm}>용어 추가</button>
  </div>;
}
