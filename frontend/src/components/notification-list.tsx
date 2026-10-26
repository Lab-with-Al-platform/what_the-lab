"use client";

import { NOTIFICATION_ICONS, splitActor, timeAgo, type NotificationItem } from "@/lib/notifications";

/** 알림 목록 (헤더 드롭다운과 알림 화면이 같이 써요). 누르면 onOpen으로 알려 줘요. */
export function NotificationRows({ items, onOpen }: { items: NotificationItem[]; onOpen: (item: NotificationItem) => void }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm font-semibold text-ink">아직 알림이 없어요</p>
        <p className="mt-1 text-[13px] text-faint">협업 요청을 주고받으면 여기에서 알려 드려요</p>
      </div>
    );
  }
  return (
    <ul>
      {items.map((item) => {
        const [actor, rest] = splitActor(item.title);
        const icon = NOTIFICATION_ICONS[item.type] ?? NOTIFICATION_ICONS.request_canceled;
        return (
          <li key={item.notification_id} className="border-t border-line/70 first:border-t-0">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className={`relative flex w-full gap-3 px-5 py-3.5 text-left hover:bg-page ${item.read ? "" : "bg-[#fafaff]"}`}
            >
              <span className={`grid size-[34px] shrink-0 place-items-center rounded-full text-[15px] ${icon.className}`} aria-hidden>
                {icon.icon}
              </span>
              <span className="min-w-0 flex-1 pr-4">
                <span className="block text-[13.5px] leading-[1.45] text-ink">
                  {actor && <b className="font-bold">{actor}</b>}
                  {rest}
                </span>
                <span className="mt-0.5 block text-xs text-faint">
                  {item.detail} · {timeAgo(item.created_at)}
                </span>
              </span>
              {!item.read && (
                <>
                  <i className="absolute top-5 right-5 size-2 rounded-full bg-brand" aria-hidden />
                  <span className="sr-only">안 읽음</span>
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}