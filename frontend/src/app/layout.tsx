import type { Metadata } from "next";
import { AnalyticsPageBeacon } from "@/components/analytics-page-beacon";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pretendard } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LabBridge",
    template: "%s · LabBridge",
  },
  description: "연구의 질문이 AI와 만나는 곳. 연구 사례와 기술 동향을 보고 함께할 AI 전문가를 찾습니다.",
  icons: {
    icon: [{ url: "/brand/labbridge-favicon.png", type: "image/png" }],
    apple: "/brand/labbridge-mark.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="min-h-screen antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <AnalyticsPageBeacon />
        <main id="content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
