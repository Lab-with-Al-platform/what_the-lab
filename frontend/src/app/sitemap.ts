import type { MetadataRoute } from "next";
import { insightCanonical } from "@/lib/insight-seo";
import { INSIGHTS } from "@/lib/insights";
import { getSiteOrigin, publicPagePaths } from "@/lib/site-seo";

// 사이트맵은 배포 시점의 공개 원고만 담는 정적 파일입니다.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  if (!origin) return [];

  const pages = publicPagePaths.map((path) => ({ url: new URL(path, origin).href }));
  const articles = INSIGHTS.flatMap((article) => {
    const url = insightCanonical(article);
    return url ? [{ url }] : [];
  });

  // 실제 수정일을 알 수 없으므로 빌드 날짜를 lastModified로 넣지 않습니다.
  return [...pages, ...articles];
}
