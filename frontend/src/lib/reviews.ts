import { requestApi } from "@/lib/api";

export type ReviewSide = "researcher" | "expert";
export type CollaborationReview = {
  review_id: number;
  collaboration_id: number;
  reviewer_side: ReviewSide;
  expertise: number;
  communication: number;
  timeliness: number;
  quality: number;
  comment: string;
  visibility: "visible" | "hidden";
  edit_count: number;
  created_at: string;
  updated_at: string;
};
export type ReviewScores = {
  expertise: number;
  communication: number;
  timeliness: number;
  quality: number;
  comment: string;
};
export type ReviewContext = {
  collaboration_id: number;
  side: ReviewSide;
  eligible: boolean;
  status: "done" | "ended_early" | "canceled" | "ongoing";
  submission_deadline: string | null;
  partner: string;
  research_title: string;
  public_policy: string;
  my_review: CollaborationReview | null;
  received_review: (Pick<CollaborationReview, "review_id" | "collaboration_id" | "reviewer_side" | "expertise" | "communication" | "timeliness" | "quality" | "comment" | "created_at">) | null;
  can_edit: boolean;
  can_submit: boolean;
};
export type ReviewOpportunity = {
  collaboration_id: number;
  side: ReviewSide;
  status: "done" | "ended_early";
  partner: string;
  research_title: string;
  submission_deadline: string;
  eligible: boolean;
  submitted: boolean;
  review_id: number | null;
  reviewed_at: string | null;
  visibility: "visible" | "hidden" | null;
};

/**
 * LAB TRUST is not the raw 5-star average. null score means insufficient
 * evidence (not a zero rating), and undefined UI state means still loading.
 */
export type ReputationSnapshot = {
  state: "gathering" | "established";
  score: number | null;
  level: string;
  review_count: number;
  reviewer_count: number;
  minimum_reviews: number;
  minimum_reviewers: number;
  max_per_reviewer: number;
};

export function getExpertReputations(ids: number[]): Promise<Record<string, ReputationSnapshot>> {
  const clean = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 60);
  if (clean.length === 0) return Promise.resolve({});
  return requestApi<Record<string, ReputationSnapshot>>(`/reviews/reputation?ids=${clean.join(",")}`);
}

export type PublicExpertReview = {
  review_id: number;
  created_at: string;
  expertise: number;
  communication: number;
  timeliness: number;
  quality: number;
  comment: string;
  score: number;
  author: string;
};
export type PublicExpertRating = {
  reputation: ReputationSnapshot;
  count: number;
  average: number | null;
  criteria: { expertise: number | null; communication: number | null; timeliness: number | null; quality: number | null };
  reviews: PublicExpertReview[];
  policy: string;
};

export const REVIEW_LABELS = {
  researcher: [
    { key: "expertise", label: "전문성", hint: "필요한 기술과 지식으로 문제를 해결했나요?" },
    { key: "communication", label: "소통", hint: "일정·기대사항을 명확하게 소통했나요?" },
    { key: "timeliness", label: "일정 준수", hint: "합의한 일정과 작업 약속을 지켰나요?" },
    { key: "quality", label: "결과물 품질", hint: "결과물이 연구 목표에 적합했나요?" },
  ],
  expert: [
    { key: "expertise", label: "연구 준비도", hint: "연구 목표와 데이터가 충분히 준비됐나요?" },
    { key: "communication", label: "소통", hint: "피드백과 의사결정이 명확했나요?" },
    { key: "timeliness", label: "일정 협력", hint: "상대방이 합의한 일정을 존중했나요?" },
    { key: "quality", label: "요구사항 명확성", hint: "기대 결과와 검수 기준이 분명했나요?" },
  ],
} as const;

export const EMPTY_SCORES: ReviewScores = {
  expertise: 0, communication: 0, timeliness: 0, quality: 0, comment: "",
};

export function getReviewContext(id: number): Promise<ReviewContext> {
  return requestApi<ReviewContext>(`/reviews/collaborations/${id}`);
}
export function submitReview(id: number, body: ReviewScores, editing = false): Promise<ReviewContext> {
  return requestApi<ReviewContext>(`/reviews/collaborations/${id}`, {
    method: editing ? "PUT" : "POST", body: JSON.stringify(body),
  });
}
export function getMyReviews(): Promise<ReviewOpportunity[]> {
  return requestApi<ReviewOpportunity[]>("/reviews/mine");
}
export function getPublicExpertReviews(id: number): Promise<PublicExpertRating> {
  return requestApi<PublicExpertRating>(`/reviews/experts/${id}/summary`);
}
export function reportPublicReview(reviewId: number, reason: string, description: string): Promise<{ reported: boolean }> {
  return requestApi<{ reported: boolean }>(`/reviews/${reviewId}/reports`, {
    method: "POST", body: JSON.stringify({ reason, description }),
  });
}
