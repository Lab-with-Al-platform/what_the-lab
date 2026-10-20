import type { ReactNode } from "react";
import type { InsightParagraph, InsightParagraphKind, InsightTerm } from "@/lib/insights";

const NOTE_LABELS: Record<Exclude<InsightParagraphKind, "body">, string> = {
  interpretation: "연구자에게 주는 의미",
  application: "내 연구에 적용한다면",
  caution: "주의할 점 · 적용의 경계",
};

/** 색만 보지 않아도 원문과 편집자 의견을 구분할 수 있게 라벨을 함께 표시합니다. */
export function ArticleParagraph({
  paragraph,
  children,
}: {
  paragraph: string | InsightParagraph;
  children: ReactNode;
}) {
  if (typeof paragraph === "string" || paragraph.kind === "body") {
    return <p className="article-body-paragraph mt-3 text-pretty text-muted">{children}</p>;
  }

  return (
    <aside className={`article-note article-note--${paragraph.kind}`} aria-label={NOTE_LABELS[paragraph.kind]}>
      <p className="article-note__label">{NOTE_LABELS[paragraph.kind]}</p>
      <p className="article-note__credit">LabBridge 편집자 노트 · 원문의 직접 결론과 구분해 읽어주세요.</p>
      <p className="article-body-paragraph mt-2 text-pretty text-ink">{children}</p>
    </aside>
  );
}

/** 기본 HTML details를 쓰면 추가 라이브러리 없이 터치·Enter·Space로 펼칠 수 있습니다. */
export function ArticleGlossary({ terms }: { terms: InsightTerm[] }) {
  if (terms.length === 0) return null;

  return (
    <div className="article-glossary mt-4" aria-label="이 부분의 용어 풀이">
      <p className="mb-1 text-xs font-semibold text-muted">용어 풀이 · 눌러서 확인하세요</p>
      {terms.map((term) => (
        <details key={term.id} className="article-glossary__item">
          <summary className="article-glossary__trigger">{term.label}</summary>
          <div className="article-glossary__definition">
            <p>{term.definition}</p>
            {term.example ? <p className="mt-2"><span className="font-semibold text-ink">예를 들면 </span>{term.example}</p> : null}
            {term.caution ? <p className="mt-2"><span className="font-semibold text-ink">주의 </span>{term.caution}</p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
