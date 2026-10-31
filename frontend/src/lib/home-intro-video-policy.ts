/** 홈 소개 영상을 오늘 자동으로 켤지 정합니다. 날짜 계산은 순수 함수이고, 저장소 읽기는 맨 아래 브라우저 함수만 합니다. */

export const HOME_VIDEO_STORAGE_KEY = "labbridge.homeIntroVideo";
export const HOME_VIDEO_VERSION = "creative-minds-v1";

export type HomeVideoRecord = {
  version: string;
  playedOn: string;
};

export function seoulDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function readHomeVideoRecord(storage: Pick<Storage, "getItem"> | null): HomeVideoRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HOME_VIDEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HomeVideoRecord>;
    if (typeof parsed.version !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.playedOn ?? "")) return null;
    return { version: parsed.version, playedOn: parsed.playedOn ?? "" };
  } catch {
    return null;
  }
}

export function writeHomeVideoRecord(storage: Pick<Storage, "setItem"> | null, playedOn: string): void {
  if (!storage) return;
  try {
    const record: HomeVideoRecord = { version: HOME_VIDEO_VERSION, playedOn };
    storage.setItem(HOME_VIDEO_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 저장을 거부해도 홈 화면은 그대로 둡니다.
  }
}

/** 한국 달력의 오늘 이미 재생했거나, 동작 줄이기·데이터 절약이면 자동재생하지 않습니다. */
export function shouldAutoplayHomeVideo(input: {
  record: HomeVideoRecord | null;
  today: string;
  reduceMotion: boolean;
  saveData: boolean;
}): boolean {
  if (input.reduceMotion || input.saveData) return false;
  return !(input.record?.version === HOME_VIDEO_VERSION && input.record.playedOn === input.today);
}

/** 브라우저 저장과 설정은 이 함수만 읽습니다. 홈을 연 뒤 자정에는 다시 판단하지 않습니다. */
export function decideDailyHomeVideoFromBrowser(now = new Date()): { today: string; show: boolean } {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return decideDailyHomeVideo({
    now,
    storage: window.localStorage,
    reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: connection?.saveData === true,
  });
}

export function decideDailyHomeVideo(input: {
  now: Date;
  storage: Pick<Storage, "getItem"> | null;
  reduceMotion: boolean;
  saveData: boolean;
}): { today: string; show: boolean } {
  const today = seoulDateKey(input.now);
  return {
    today,
    show: shouldAutoplayHomeVideo({
      record: readHomeVideoRecord(input.storage),
      today,
      reduceMotion: input.reduceMotion,
      saveData: input.saveData,
    }),
  };
}
