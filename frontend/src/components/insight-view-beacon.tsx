"use client";

import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";

/** 공개 글이 보인 뒤에만 조회를 보냅니다. 실패해도 글 화면은 그대로 둡니다. */
export function InsightViewBeacon({ slug, kind }: { slug: string; kind: "case" | "trend" }) {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin") || navigator.webdriver) return;
    const storageKey = `lb-view:${kind}:${slug}`;
    let eventId = sessionStorage.getItem(storageKey);
    if (!eventId) {
      eventId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, eventId);
    }
    let ignore = false;
    function send(id: string) {
      // 같은 방문의 재전송은 같은 ID를 씁니다. 서버가 한 번만 셉니다.
      fetch(`${API_BASE_URL}/insights/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({ event_id: id, kind, slug, purpose: "public" }),
      }).then(response => {
        if (response.ok) sessionStorage.removeItem(storageKey);
      }).catch(() => undefined);
    }
    function sendWhenVisible() {
      if (document.visibilityState === "hidden") return;
      send(eventId as string);
      document.removeEventListener("visibilitychange", sendWhenVisible);
    }
    sendWhenVisible();
    document.addEventListener("visibilitychange", sendWhenVisible);
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted || ignore) return;
      const next = crypto.randomUUID();
      sessionStorage.setItem(storageKey, next);
      eventId = next;
      send(next);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => {
      ignore = true;
      document.removeEventListener("visibilitychange", sendWhenVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [kind, slug]);
  return null;
}
