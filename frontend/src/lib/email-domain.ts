// 개인 메일 도메인. 이 메일로는 소속 인증을 할 수 없습니다.
const PERSONAL_DOMAINS = [
  "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com",
  "nate.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.com",
];

// TODO: 화면 확인용 예시입니다. 실제 기관 목록과 판단은 백엔드가 맡습니다.
const KNOWN_INSTITUTIONS: Record<string, string> = {
  "snu.ac.kr": "서울대학교",
  "kaist.ac.kr": "KAIST",
  "yonsei.ac.kr": "연세대학교",
  "korea.ac.kr": "고려대학교",
  "postech.ac.kr": "포항공과대학교",
};

/** "minseo@cs.snu.ac.kr" → "cs.snu.ac.kr" */
export function getEmailDomain(email: string): string {
  const atIndex = email.lastIndexOf("@");
  return atIndex === -1 ? "" : email.slice(atIndex + 1).trim().toLowerCase();
}

export function isPersonalEmail(email: string): boolean {
  return PERSONAL_DOMAINS.includes(getEmailDomain(email));
}

/** 기관 이메일이면 기관명을, 아니면 null을 돌려줍니다. */
export function findInstitution(email: string): string | null {
  const domain = getEmailDomain(email);
  if (!domain.includes(".") || isPersonalEmail(email)) {
    return null;
  }
  // "cs.snu.ac.kr"처럼 학과 하위 도메인도 "snu.ac.kr"로 인정합니다.
  const matched = Object.keys(KNOWN_INSTITUTIONS).find(
    (key) => domain === key || domain.endsWith(`.${key}`),
  );
  return matched ? KNOWN_INSTITUTIONS[matched] : null;
}