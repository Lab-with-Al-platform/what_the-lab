// 프로필 설정 화면에서 쓰는 타입과 값. 백엔드 응답(snake_case) 모양 그대로예요.

export type SettingsMe = {
  user_id: number;
  nickname: string;
  user_role: "researcher" | "expert" | null;
  user_photo: string | null;
  signup_step: string;
};

/** 연구회원 소속 정보 (GET /researcher/profile) */
export type ResearcherInfo = {
  institution_name: string | null;
  institution_source: "list" | "manual";
  department: string | null;
  position: string | null;
  is_verified: boolean;
  verified_at: string | null;
};

/** AI 전문가 가입 정보 (GET /expert/basic) */
export type ExpertBasic = { current_job: string; ai_career: string; affiliation: string | null };

/** 알림 설정 (GET /notifications/settings) */
export type NotificationSetting = {
  status: "connected" | "not_connected" | "blocked";
  available: boolean; // 서버에 디스코드 봇 설정이 있는지
  discord_dm: boolean;
  notify_request: boolean;
  notify_workspace: boolean;
  blocked_at: string | null;
};

// 연구회원 직위 (가입 화면과 같은 값)
export const POSITION_OPTIONS = [
  { value: "undergrad", label: "학부연구생" },
  { value: "master", label: "석사과정" },
  { value: "phd", label: "박사과정" },
  { value: "postdoc", label: "박사후연구원" },
  { value: "professor", label: "교수" },
  { value: "researcher", label: "연구원" },
];

export const PHOTO_LIMIT_MB = 5; // 백엔드 MAX_PHOTO_MB와 같은 값
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DEPARTMENT_LIMIT = 100;
export const AFFILIATION_LIMIT = 100;

/** 2026-10-20T... → 2026.10.20 */
export function dotDate(iso: string | null): string {
  return iso ? iso.slice(0, 10).replaceAll("-", ".") : "";
}

/** 프로필 사진·닉네임을 바꿨다고 헤더에 알려요. (헤더가 내 정보를 다시 불러와요) */
export const ME_CHANGED_EVENT = "labbridge:me-changed";
export function announceMeChanged() {
  window.dispatchEvent(new Event(ME_CHANGED_EVENT));
}