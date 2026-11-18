import type { Metadata } from "next";

export const NON_INDEXABLE: Metadata = { robots: { index: false, follow: false } };

const PUBLIC_PAGES = {
  "/": {
    title: "연구의 질문이 AI와 만나는 곳",
    description: "연구 사례와 AI 기술 동향을 읽고, 내 연구에 맞는 AI 전문가를 찾는 연구 협업 플랫폼 LabBridge입니다.",
  },
  "/cases": {
    title: "AI 연구 협업 사례",
    description: "원 논문을 바탕으로 연구 문제, AI 적용 과정과 결과를 설명합니다. 각 연구의 근거와 적용 범위를 확인해 보세요.",
  },
  "/trends": {
    title: "AI 트렌드",
    description: "연구자가 알아두면 좋은 AI 기술의 작동 원리, 활용 분야와 한계를 원문 근거와 함께 쉽게 정리합니다.",
  },
  "/experts": {
    title: "AI 전문가 찾기",
    description: "연구 분야와 필요한 AI 기술을 기준으로 협업할 수 있는 LabBridge AI 전문가를 찾아보세요.",
  },
  "/community/guidelines": {
    title: "커뮤니티 이용 가이드",
    description: "LabBridge 게시판에 질문을 올리는 방법과 공개 범위, 개인정보 보호, 신고와 운영 원칙을 확인하세요.",
  },
  "/faq": {
    title: "자주 묻는 질문",
    description: "연구·전문가 찾기, 협업 요청, 공유 일정과 작업, Discord 알림, Google Calendar, 게시판 이용 방법을 확인하세요.",
  },
} as const;

export const publicPagePaths = Object.keys(PUBLIC_PAGES);

/** 빌드에서 명시한 공개 주소만 씁니다. 미리보기와 미설정 빌드는 색인을 열지 않습니다. */
export function getSiteOrigin(
  siteUrl = process.env.LABBRIDGE_SITE_URL,
  vercelEnvironment = process.env.VERCEL_ENV,
): URL | undefined {
  if (!siteUrl || vercelEnvironment === "preview") return undefined;

  try {
    const url = new URL(siteUrl);
    if (
      url.protocol === "https:" && !url.username && !url.password &&
      url.href === `${url.origin}/` &&
      url.hostname.includes(".") && !/^[\d.]+$/.test(url.hostname) &&
      !url.hostname.endsWith(".localhost") && !url.hostname.endsWith(".local")
    ) {
      return new URL(url.origin);
    }
  } catch {
    // 잘못된 주소를 검색엔진에 알리는 것보다 색인을 닫아 두는 편이 안전합니다.
  }
  return undefined;
}

/** 검색엔진에 알려줄 대표 주소에는 필터나 추적 매개변수를 넣지 않습니다. */
export function canonicalUrl(path: string, origin = getSiteOrigin()): string | undefined {
  return origin ? new URL(path, origin).href : undefined;
}

/** 등록된 공개 페이지가 대표 주소를 얻었을 때만 루트의 noindex를 덮어씁니다. */
export function searchIndexMetadata(canonical: string | undefined): Metadata {
  return canonical
    ? { alternates: { canonical }, robots: { index: true, follow: true } }
    : NON_INDEXABLE;
}

export function publicPageMetadata(path: keyof typeof PUBLIC_PAGES): Metadata {
  return {
    ...PUBLIC_PAGES[path],
    ...searchIndexMetadata(canonicalUrl(path)),
  };
}
