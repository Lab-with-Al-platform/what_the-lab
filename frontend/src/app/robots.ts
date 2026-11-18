import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/site-seo";

// S3용 정적 빌드에서도 robots.txt를 실제 파일로 저장합니다.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const sitemap = canonicalUrl("/sitemap.xml");
  return {
    // 페이지는 읽을 수 있어야 검색 로봇이 각 페이지의 noindex 태그를 확인할 수 있습니다.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(sitemap ? { sitemap } : {}),
  };
}
