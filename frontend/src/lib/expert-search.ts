// AI 전문가 찾기·협업 요청 창에서 쓰는 타입과 계산. 백엔드 응답(snake_case) 모양 그대로예요.
import type { AbleWorkOption, CareerProfile, FieldCategory } from "@/lib/my-career";

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

/** 이 서비스에서 진행한 연구 한 건 (협업을 시작한 요청) */
export type ExpertCollaboration = {
  start_date: string; // 희망 시작일 YYYY-MM-DD
  end_date: string; // 희망 종료일 YYYY-MM-DD
  ongoing: boolean; // 종료일이 아직 안 지났으면 true (진행 중)
  title: string; // 연구 제목
  partner_nickname: string; // 함께한 연구회원 닉네임
  category_ids: string[]; // 연구 분야 대분류 ID (F01~F10)
  able_work_ids: string[]; // 연구에서 맡긴 일 UG ID
};

/** 공개 프로필 (GET /experts/{id}). 전문가 상세와 협업 요청 창에서 써요. */
export type ExpertPublicProfile = Omit<CareerProfile, "is_public"> & {
  user_id: number;
  affiliation: string | null; // 소속 (선택)
  engaged: boolean;
  engaged_until: string | null;
  collaborations: ExpertCollaboration[];
};

/** 분류 ID → 화면 이름 (맡길 일·분야 칩과 태그에 씀) */
export type Names = {
  works: Map<string, string>; // UG ID → 이름
  fields: Map<string, string>; // FIELD ID → 이름
  categoryOf: Map<string, string>; // FIELD ID → 대분류 ID
  categories: Map<string, string>; // 대분류 ID → 이름
};

/** 보기 목록 두 개(맡길 일·분야)로 이름표를 만들어요. */
export function buildNames(ableWorks: AbleWorkOption[], categories: FieldCategory[]): Names {
  const fields = new Map<string, string>();
  const categoryOf = new Map<string, string>();
  for (const category of categories) {
    for (const field of category.fields) {
      fields.set(field.field_id, field.name);
      categoryOf.set(field.field_id, category.field_category_id);
    }
  }
  return {
    works: new Map(ableWorks.map((item) => [item.able_work_id, item.name])),
    fields,
    categoryOf,
    categories: new Map(categories.map((item) => [item.field_category_id, item.name])),
  };
}

/** 협업 기간 → "2026.06 ~ 07" / "2025.12 ~ 2026.02" / "2026.10 ~ 진행 중" */
export function periodLabel(item: Pick<ExpertCollaboration, "start_date" | "end_date" | "ongoing">): string {
  const start = item.start_date.slice(0, 7).replace("-", ".");
  if (item.ongoing) return `${start} ~ 진행 중`;
  const end = item.end_date.slice(0, 7).replace("-", ".");
  return end.slice(0, 4) === start.slice(0, 4) ? `${start} ~ ${end.slice(5)}` : `${start} ~ ${end}`;
}

/** 마친 연구를 분야(대분류)별로 셉니다. 많은 분야부터. 예: [{id:"F02", count:2}, {id:"F09", count:1}] */
export function countByCategory(items: ExpertCollaboration[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const id of item.category_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

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