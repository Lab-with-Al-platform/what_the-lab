"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageKey, sendAnalytics } from "@/lib/analytics-collect";

/** 허용한 공개 페이지가 보일 때 방문 한 건을 보냅니다. 화면에는 아무것도 그리지 않습니다. */
export function AnalyticsPageBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const target = pageKey(pathname);
    if (!target) return;
    sendAnalytics({ event_name: "page_view", target });
  }, [pathname]);
  return null;
}
