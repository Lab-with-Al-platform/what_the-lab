"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationRows } from "@/components/notification-list";
import { requestApi } from "@/lib/api";
import { UNREAD_POLL_MS, type NotificationItem, type NotificationList } from "@/lib/notifications";

/** 헤더 알림 종. 안 읽은 수를 1분마다 새로 가져오고, 누르면 프로필 메뉴처럼 아래로 목록이 열려요. */
export function NotificationBell({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationList | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    requestApi<{ count: number }>("/notifications/unread-count")
      .then((data) => setCount(data.count))
      .catch(() => undefined); // 잠깐 실패해도 다음 1분에 다시 가져와요
  }, []);

  // 페이지를 옮길 때, 1분마다, 창으로 돌아왔을 때 새로 가져와요. 페이지를 옮기면 목록은 닫아요.
  useEffect(() => {
    setOpen(false);
    refreshCount();
    const timer = window.setInterval(refreshCount, UNREAD_POLL_MS);
    window.addEventListener("focus", refreshCount);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshCount);
    };
  }, [pathname, refreshCount]);

  // 열려 있을 때 바깥을 누르거나 ESC를 누르면 닫기 (프로필 메뉴와 같은 방식)
  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setList(null);
    requestApi<NotificationList>("/notifications")
      .then((data) => {
        setList(data);
        setCount(data.unread);
      })
      .catch(() => setList({ unread: count, items: [] }));
  }

  async function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.read) {
      const data = await requestApi<{ count: number }>(`/notifications/${item.notification_id}/read`, { method: "POST" }).catch(() => null);
      if (data) setCount(data.count);
    }
    router.push(item.link);
  }

  async function readAll() {
    await requestApi("/notifications/read-all", { method: "POST" }).catch(() => null);
    setCount(0);
    setList((current) => (current ? { unread: 0, items: current.items.map((item) => ({ ...item, read: true })) } : current));
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={count > 0 ? `알림 ${count}개 안 읽음` : "알림"}
        className={`relative grid h-11 w-11 place-items-center rounded-button ${open ? "bg-brand-soft text-brand" : "text-ink hover:bg-page"}`}
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute top-1.5 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-trend px-1 text-[11px] leading-none font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        // 데스크톱: 종 바로 아래 오른쪽 맞춤(380px). 모바일: 화면 좌우 12px 여백으로 헤더 바로 아래에 펼쳐요.
        <div
          id="notification-panel"
          className="fixed inset-x-3 top-[calc(var(--header-height)+8px)] z-50 overflow-hidden rounded-card border border-line bg-white shadow-[0_12px_32px_rgba(18,32,75,0.12)] lg:absolute lg:inset-x-auto lg:top-full lg:right-0 lg:mt-2 lg:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 pt-4 pb-3">
            <p className="text-base font-bold">
              알림 {count > 0 && <span className="text-brand">{count}</span>}
            </p>
            {count > 0 && (
              <button type="button" onClick={readAll} className="text-xs font-semibold text-brand">
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-[min(420px,calc(100dvh-180px))] overflow-y-auto">
            {list ? <NotificationRows items={list.items} onOpen={openItem} /> : <p className="px-5 py-8 text-center text-sm text-faint">불러오는 중…</p>}
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px]">
            <span className="text-muted">최근 30일 알림만 보여요</span>
            <Link href="/settings/profile#noti" onClick={() => setOpen(false)} className="font-semibold text-brand">
              알림 설정
            </Link>
          </div>        
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}