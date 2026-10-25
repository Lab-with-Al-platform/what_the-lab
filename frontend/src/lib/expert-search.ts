// AI 전문가 찾기·협업 요청 창에서 쓰는 타입과 계산. 백엔드 응답(snake_case) 모양 그대로예요.
import type { CareerProfile } from "@/lib/my-career";

/** 목록 카드 한 장 (GET /experts) */
export type ExpertCardData = {
  user_id: number;
  nickname: string;
  user_photo: string | null;
  introduce: string | null; // 한 줄 소개 (40자)
  engaged: boolean; // 지금 다른 연구와 협업 중인지
  engaged_until: string | null; // 협업 종료 예정일 YYYY-MM-DD (정하지 않았으면 null)
  able_work_ids: string[]; // 할 수 있는 일 UG ID
  domain_ids: string[]; // 도메인(연구 분야) FIELD ID
};

export type ExpertSearchResult = {
  total: number;
  items: ExpertCardData[];
  matched: { able_work_ids: string[]; field_ids: string[] }; // 검색어와 같은 뜻으로 함께 찾은 분류
};

/** 공개 프로필 (GET /experts/{id}). 협업 요청 창의 '전문가의 협업 조건'에 써요. */
export type ExpertPublicProfile = Omit<CareerProfile, "is_public"> & {
  user_id: number;
  engaged: boolean;
  engaged_until: string | null;
};

/** 분류 ID → 화면 이름 (맡길 일·분야 칩과 태그에 씀) */
export type Names = {
  works: Map<string, string>; // UG ID → 이름
  fields: Map<string, string>; // FIELD ID → 이름
  categoryOf: Map<string, string>; // FIELD ID → 대분류 ID
  categories: Map<string, string>; // 대분류 ID → 이름
};

/** 세부 분야 ID 목록 → 겹치지 않는 대분류 이름 목록. 예: [FIELD001, FIELD002] → ["생명과학"] */
export function categoryNames(fieldIds: string[], names: Names): string[] {
  return [...new Set(fieldIds.map((id) => names.categories.get(names.categoryOf.get(id) ?? "") ?? ""))].filter(Boolean);
}

/** 2026-10-28 → 10월 28일 */
export function monthDay(date: string): string {
  const [, month, day] = date.slice(0, 10).split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

/** 카드의 참여 상태 문구. 협업 가능하면 null */
export function engagedLabel(expert: Pick<ExpertCardData, "engaged" | "engaged_until">): string | null {
  if (!expert.engaged) return null;
  return expert.engaged_until ? `참여 중 · ${monthDay(expert.engaged_until)} 종료 예정` : "참여 중";
}

/** 협업 종료 예정일 다음 날 (YYYY-MM-DD). 새 협업을 시작할 수 있는 가장 빠른 날이에요. */
export function dayAfter(date: string): string {
  const next = new Date(`${date.slice(0, 10)}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return localDate(next);
}

/** 오늘 날짜 YYYY-MM-DD (내 컴퓨터 시간 기준) */
export function today(): string {
  return localDate(new Date());
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 이름 목록을 앞에서 limit개만 보여 주고 나머지는 +N */
export function headAndRest(names: string[], limit = 3): { shown: string[]; rest: number } {
  return { shown: names.slice(0, limit), rest: Math.max(0, names.length - limit) };
}

export const MESSAGE_LIMIT = 300; // 백엔드 MAX_MESSAGE와 같은 값