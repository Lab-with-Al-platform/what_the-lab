import { ApiError, requestApi } from "@/lib/api";
import insightLinks from "../../../data/community/insight-links.json";

export const CATEGORIES = {
  question: "질문·도움",
  story: "경험 공유",
  idea: "아이디어·제안",
  support: "오류·문의",
  chat: "자유 이야기",
  notice: "공지",
} as const;
export const STATUSES = {
  open: "대화 중",
  in_progress: "확인 중",
  resolved: "해결됨",
} as const;
export const AREAS = {
  general: "일반",
  account: "가입·계정",
  experts: "전문가 찾기",
  research: "내 연구",
  insights: "사례·트렌드",
  community: "게시판",
} as const;
export type Category = keyof typeof CATEGORIES;
export type PostStatus = keyof typeof STATUSES;
export type Member = {
  user_id: number;
  nickname: string;
  user_role: string | null;
  is_admin: boolean;
};
export type InsightLink = {
  slug: string;
  kind: string;
  title: string;
  href: string;
};
export const INSIGHT_LINKS: InsightLink[] = insightLinks;
export type CommunityPost = {
  id: string;
  title: string;
  body?: string;
  excerpt: string;
  category: Category;
  visibility: "public" | "private";
  status: PostStatus;
  author_name: string;
  author_role: string;
  tags: string[];
  area: keyof typeof AREAS;
  insight: InsightLink | null;
  accepted_comment_id: string | null;
  pinned: boolean;
  hidden: boolean;
  version: number;
  reply_count: number;
  helpful_count: number;
  bookmarked: boolean;
  reacted: boolean;
  is_mine: boolean;
  can_manage: boolean;
  created_at: string;
  updated_at: string;
};
export type PostInput = {
  title: string;
  body: string;
  category: Category;
  visibility: "public" | "private";
  tags: string[];
  area: keyof typeof AREAS;
  insight_slug: string | null;
};
export type CommunityComment = {
  id: string;
  body: string;
  version: number;
  author_name: string;
  author_role: string;
  is_staff: boolean;
  is_mine: boolean;
  created_at: string;
};
export type PostList = {
  items: CommunityPost[];
  total: number;
  page: number;
  page_size: number;
};
export type NotificationList = {
  items: {
    id: string;
    post_id: string;
    comment_id: string;
    title: string;
    read: boolean;
    created_at: string;
  }[];
  unread: number;
};

export async function communityApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (init?.signal?.aborted) cancel();
  init?.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  try {
    return await requestApi<T>(`/community${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (caught) {
    if (timedOut)
      throw new ApiError(
        "응답이 지연되고 있습니다. 입력을 유지한 채 다시 확인해 주세요.",
      );
    throw caught;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", cancel);
  }
}

export type CommentList = {
  items: CommunityComment[];
  accepted: CommunityComment | null;
  next_cursor: string | null;
};

export function communityPage(value: string | null): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 10000
    ? number
    : 1;
}

export function newCommunityToken(): string {
  // getRandomValues는 HTTP 개발 화면에서도 사용 가능하며 Math.random을 쓰지 않습니다.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function communityDate(value: string, time = false): string {
  // SQLite 테스트 날짜도 실제 운영의 UTC 날짜와 같은 방식으로 표시합니다.
  const date = new Date(
    /[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`,
  );
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function roleName(role: string): string {
  return role === "researcher"
    ? "연구자"
    : role === "expert"
      ? "AI 개발자"
      : "회원";
}

export const TEMPLATES: Partial<Record<Category, string>> = {
  question:
    "[궁금한 점]\n\n[지금까지 시도한 것]\n\n[원하는 도움]\n\n※ 이름·연락처·연구 원자료는 제외해 주세요.",
  idea: "[어떤 상황에서 불편했나요?]\n\n[이렇게 바뀌면 좋겠어요]\n\n[누구에게 도움이 될까요?]",
  support:
    "[어느 화면에서 발생했나요?]\n\n[어떤 순서로 진행했나요?]\n1. \n2. \n\n[기대했던 결과 / 실제 결과]\n\n※ 비밀번호·인증번호·API 키는 적지 마세요.",
  story:
    "[시도한 연구·개발]\n\n[알게 된 점]\n\n[다음에 시도할 것]\n\n※ 공유가 허용된 내용만 적어 주세요.",
};
