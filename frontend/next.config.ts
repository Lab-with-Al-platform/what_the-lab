import type { NextConfig } from "next";

// S3 + CloudFront에 올릴 정적 파일(out/)은 STATIC_EXPORT=1 일 때만 만들어요.
// 그 외(로컬 개발·Vercel)는 지금처럼 동작해요. 전환이 끝나면 이 분기를 지워요.
// 실행: npm run build:static  (docs/aws-deployment/09-deployment-roadmap.md B2)
const isStaticExport = process.env.STATIC_EXPORT === "1";

// 선택 사항: 로컬 개발에서 같은 출처로 API를 전달할 때 frontend/.env.local에서 설정합니다.
async function apiProxyRewrites() {
  const target = process.env.API_PROXY_TARGET;
  if (!target) return [];
  const url = new URL(target);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "API_PROXY_TARGET에는 인증정보·경로 없는 HTTP(S) 서버 주소를 설정하세요.",
    );
  }
  return [
    { source: "/api/v1/:path*", destination: `${url.origin}/api/v1/:path*` },
  ];
}

const nextConfig: NextConfig = isStaticExport
  ? {
      output: "export",
      // 정적 파일에는 이미지 변환 서버가 없어서 원본을 그대로 보내요.
      images: { unoptimized: true },
    }
  : { rewrites: apiProxyRewrites };

export default nextConfig;
