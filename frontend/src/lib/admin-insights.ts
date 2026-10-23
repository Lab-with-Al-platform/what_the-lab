/** 관리자 화면과 기존 인사이트 API가 함께 사용하는 입력 계약입니다. */
import type { InsightArticle } from "./insights";
export const CLAIM_LABELS = {
  research_problem: "연구 문제", bottleneck: "기존 방식의 병목", ai_role: "AI가 한 일",
  researcher_role: "연구자가 한 일", input_data: "입력 데이터와 준비 조건",
  validation_method: "검증 방법", outcomes: "확인된 결과", limitations: "한계와 적용 조건",
} as const;
export const SCORE_LABELS = {
  real_domain_problem: "실제 연구 문제", bottleneck_contribution: "병목 해결 기여",
  role_separation: "AI·연구자 역할 구분", validation: "결과 검증", transferability: "다른 연구에 적용 가능성",
  input_data: "입력 데이터 설명", limitations: "한계 설명",
} as const;
export const STATUS_LABELS = { draft: "초안", pending_review: "검토 대기", approved: "승인됨", published: "게시됨" } as const;
export const KIND_LABELS = { case: "협업사례", trend: "AI 트렌드" } as const;
export const READING_CHECK_LABELS = {
  clear_question: "연구 질문과 독자가 얻는 도움이 분명합니다",
  input_output: "입력 → AI 출력 → 사람의 확인을 설명했습니다",
  plain_language: "전문용어를 본문 문맥에서도 쉽게 설명했습니다",
  concrete_example: "구체적인 예시와 작은 평가 방법을 확인했습니다",
  limitations: "실패 조건과 적용 한계를 확인했습니다",
  source_separation: "원문 사실과 해석·적용 제안을 구분했습니다",
} as const;
export const TREND_CLAIM_LABELS = {
  research_problem: "이 기술이 다루는 질문", bottleneck: "기존 방식의 어려움", ai_role: "작동 원리 · 쉬운 설명",
  researcher_role: "연구자가 판단할 부분", input_data: "필요한 자료와 준비", validation_method: "어떻게 확인할까",
  outcomes: "무엇이 달라졌나", limitations: "주의할 점과 적용의 경계",
} as const;
export type CandidateStatus = keyof typeof STATUS_LABELS;
export type Claim = { field: keyof typeof CLAIM_LABELS; text: string; locator: string;
  verification: "verified" | "needs_review" | "unsupported";
  evidence_level: "fulltext" | "abstract" | "official" | "unavailable" };
export type Score = { criterion: keyof typeof SCORE_LABELS; value: number; rationale: string };
export type Draft = {
  kind?: "case" | "trend";
  glossary?: { label: string; definition: string }[];
  classification_tags?: string[];
  source: { title: string; doi: string | null; url: string;
    access_level: "open_authorized" | "metadata_only" | "restricted" | "unknown"; bibliography_checked: boolean };
  title: string; slug: string; summary: string; research_field: string; case_type: "research" | "practical";
  claims: Claim[]; scores: Score[]; keyword_ids: string[]; image_policy: "no_image" | "rights_checked";
};
export type Candidate = { id: string; kind?: "case" | "trend"; status: CandidateStatus; version: number; current_revision: number;
  approved_revision: number | null; scheduled_for: string | null };
export type CandidateListItem = Candidate & { title: string; summary: string; research_field: string; doi: string | null };
export type CandidateDetail = Candidate & {
  editorial_check?: { stage: string; ready: boolean; issues: string[]; paragraph_count: number; body_characters: number };
  publication_id?: string | null;
  article?: InsightArticle | null; legacy_article?: InsightArticle; review_draft?: Draft | null;
  revisions: { number: number; content: Draft }[];
  approval_check: { ready: boolean; message: string };
  events: { action: string; actor_discord_id: string; revision: number; reason: string; created_at: string }[];
};
export type WorkspaceItem = Candidate & { publication_id: string | null; title: string; summary: string;
  content_stage?: "collection_note" | "article_draft" | "legacy_public";
  research_field: string; keywords: string[]; is_published: boolean; has_correction: boolean;
  registered_at: string; published_at: string | null; source_title: string; doi: string | null };
export type WorkspaceResult = { items: WorkspaceItem[]; total: number; page: number;
  counts: { all: number; collected: number; published: number }; categories: string[]; keywords: string[] };
export const SOURCE_KIND_LABELS = { case: "협업사례", trend: "AI 트렌드" } as const;
export type CollectionSource = { name: string; url: string; selected: boolean; content_kinds: (keyof typeof SOURCE_KIND_LABELS)[] };
export type DiscoveryPolicy = { enabled: boolean; target_candidates: number; case_max_days: 30 | 60 | 90 | 180 | 365;
  news_max_days: 30 | 60 | 90; explanation_max_days: 30 | 90 | 365; max_source_requests: number;
  max_run_seconds: number; date_basis: "published"; historical_discovery: "separate_manual" };
export const DISCOVERY_PROFILES = [
  { id: "case_max_days", label: "협업사례", stages: [30, 60, 90, 180, 365], note: "상한보다 오래된 대표 사례는 별도 발굴" },
  { id: "news_max_days", label: "AI 트렌드 · 최신 소식", stages: [30, 60, 90], note: "상한 이후에는 부족한 채 종료 · 과거 소식을 최신으로 포장하지 않음" },
  { id: "explanation_max_days", label: "AI 트렌드 · 기술 해설", stages: [30, 90, 365], note: "더 오래된 핵심 연구는 별도 발굴 · 발표일과 해설 작성일 구분" },
] as const;

/** 화면에 예정된 탐색 순서만 표시합니다. 검색이나 수집 요청은 하지 않습니다. */
export function discoveryWindowLabels(stages: readonly number[], maximum: number, enabled: boolean, initialDays: number): string {
  const windows = enabled ? stages.filter((days) => days <= maximum) : [initialDays];
  return windows.map((days) => `${days}일`).join(" → ");
}
export type CollectionConfig = { interval_days: number; preferred_time: string; timezone: "Asia/Seoul";
  lookback_days: number; max_items: number; keywords: string[]; discovery_policy: DiscoveryPolicy;
  sources: CollectionSource[] };
export type CollectionSettings = { version: number; config: CollectionConfig; updated_at: string | null;
  execution_available: false; saved: boolean };

/** 미리보기 전용 변환입니다. 승인·DB 저장·실제 게시를 실행하지 않습니다. */
export function draftArticle(draft: Draft): InsightArticle {
  const labels = draft.kind === "trend" ? TREND_CLAIM_LABELS : CLAIM_LABELS;
  return { slug: draft.slug || "preview", kind: draft.kind ?? "case", title: draft.title || "제목 미입력",
    summary: draft.summary, field: draft.research_field, topicId: "research", topicLabel: draft.research_field,
    domains: [draft.research_field], tags: draft.classification_tags ?? [], source: draft.source.title,
    sourceUrl: safeSourceUrl(draft.source.url), doi: draft.source.doi ?? undefined,
    publishedOn: "미게시", readingMinutes: Math.max(1, Math.ceil(draft.claims.map((claim) => claim.text).join(" ").split(/\s+/).length / 200)),
    cover: "chart", sampleNotice: "미게시 초안의 미리보기입니다. 날짜·읽는 시간은 게시 확정 정보가 아닙니다.",
    highlights: (["research_problem", "ai_role", "outcomes", "limitations"] as const).flatMap((field) => {
      const claim = draft.claims.find((item) => item.field === field);
      return claim ? [{ label: `${labels[field]} · 검토 메모`, text: claim.text.slice(0, 160) }] : [];
    }), facts: [], technologies: [], relatedSlugs: [],
    glossary: draft.glossary?.map((term, index) => ({ id: `term-${index}`, ...term })),
    sections: Object.entries(labels).flatMap(([id, title]) => {
      const claim = draft.claims.find((item) => item.field === id);
      if (!claim?.text) return [];
      return [{ id, title, toc: title, paragraphs: [claim.text] }];
    }),
  };
}
export const ADMIN_INSIGHTS_PATH = "/admin/insights/candidates";

export function emptyDraft(): Draft {
  return { kind: "case", glossary: [], source: { title: "", doi: null, url: "", access_level: "unknown", bibliography_checked: false },
    title: "", slug: "", summary: "", research_field: "", case_type: "research", claims: [], scores: [],
    keyword_ids: [], image_policy: "no_image" };
}

/** 빈 주장·평가는 초안에서 제외합니다. 승인 시 필수 항목 검사는 서버가 다시 합니다. */
export function draftForSave(draft: Draft): Draft {
  return { ...draft, source: { ...draft.source, doi: draft.source.doi?.trim() || null },
    claims: draft.claims.filter((claim) => claim.text.trim()),
    scores: draft.scores.filter((score) => score.rationale.trim()),
    classification_tags: draft.classification_tags?.map((tag) => tag.trim()).filter(Boolean),
    keyword_ids: draft.keyword_ids.map((id) => id.trim()).filter(Boolean) };
}

export function safeSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function formatAdminTime(value: string | null): string {
  if (!value) return "지정하지 않음";
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

/** 목록 날짜는 브라우저 시간대와 무관하게 한국 날짜의 YYYY.MM.DD로 표시합니다. */
export function formatAdminDate(value: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}.${part("month")}.${part("day")}`;
}

/** 현재 쪽 주변 번호를 최대 다섯 개 보여주되, 처음과 끝에서는 범위를 안쪽으로 맞춥니다. */
export function visiblePageNumbers(page: number, totalPages: number): number[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);
  const visibleCount = Math.min(5, total);
  const first = Math.min(Math.max(1, current - 2), total - visibleCount + 1);
  return Array.from({ length: visibleCount }, (_, index) => first + index);
}

/** 같은 승인 판본 재전송에는 같은 번호를 사용해 통신 실패 시 이중 게시를 막습니다. */
export function publicationKey(candidate: Candidate): string {
  if (candidate.approved_revision === null || candidate.approved_revision !== candidate.current_revision) {
    throw new Error("현재 판본의 승인을 먼저 확인해 주세요.");
  }
  return `insight:${candidate.id}:revision:${candidate.approved_revision}`;
}

export function scheduleToIso(value: string): string | null {
  if (!value) return null;
  // 입력칸의 시간대는 PC 설정과 무관하게 화면에 명시한 한국 시간입니다.
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new Error("한국 시간 기준 현재보다 나중인 예약 시각을 선택해 주세요.");
  }
  return date.toISOString();
}
