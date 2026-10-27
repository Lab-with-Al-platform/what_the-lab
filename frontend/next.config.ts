import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 선택 사항: 같은 출처로 API를 전달할 때 frontend/.env.local에서 설정합니다.
  async rewrites() {
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
  },
};

export default nextConfig;
