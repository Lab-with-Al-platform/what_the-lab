"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  CATEGORIES,
  communityApi,
  Member,
  STATUSES,
  CommunityPost,
} from "@/lib/community";
import styles from "./community.module.css";

export function useCommunityMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    function refresh(mask = true) {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      if (mask) setLoading(true);
      communityApi<Member>("/me", { signal: request.signal })
        .then((value) => {
          if (!active || request.signal.aborted) return;
          // 같은 회원의 재확인은 작성 중인 폼을 새 데이터로 덮어쓰지 않습니다.
          setMember((previous) =>
            JSON.stringify(previous) === JSON.stringify(value)
              ? previous
              : value,
          );
          setError("");
        })
        .catch((caught) => {
          if (!active || request.signal.aborted) return;
          setMember(null);
          setError(
            caught instanceof ApiError &&
              [401, 403].includes(caught.status ?? 0)
              ? ""
              : "로그인 정보를 확인하지 못했습니다. 새로고침해 주세요.",
          );
        })
        .finally(() => {
          if (active && !request.signal.aborted) setLoading(false);
        });
    }
    function visibility() {
      if (document.visibilityState === "visible") refresh();
      else {
        controller?.abort();
        setLoading(true);
      }
    }
    const focus = () => refresh();
    refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh(false);
    }, 60_000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return { member, loading, error };
}

export function Icon({
  name,
  size = 20,
}: {
  name:
    | "chat"
    | "lock"
    | "arrow"
    | "plus"
    | "search"
    | "check"
    | "bookmark"
    | "heart"
    | "bell"
    | "back";
  size?: number;
}) {
  const paths = {
    chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z",
    lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
    arrow: "M5 12h14M13 6l6 6-6 6",
    plus: "M12 5v14M5 12h14",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    check: "M5 12l4 4L19 6",
    bookmark: "M6 3h12v18l-6-4-6 4z",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    back: "M19 12H5M11 6l-6 6 6 6",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function PostBadges({ post }: { post: CommunityPost }) {
  return (
    <div className={styles.badges}>
      {post.pinned && <span className={styles.brandBadge}>고정</span>}
      <span className={styles.categoryBadge}>{CATEGORIES[post.category]}</span>
      {post.visibility === "private" && (
        <span className={styles.privateBadge}>
          <Icon name="lock" size={12} /> 비공개
        </span>
      )}
      {post.status !== "open" && (
        <span
          className={
            post.status === "resolved" ? styles.solvedBadge : styles.softBadge
          }
        >
          {post.status === "resolved" && <Icon name="check" size={12} />}
          {STATUSES[post.status]}
        </span>
      )}
      {post.hidden && <span className={styles.privateBadge}>운영 검토 중</span>}
    </div>
  );
}

export function CommunitySidebar({
  active = "public",
  member,
  children,
}: {
  active?: string;
  member: Member | null;
  children?: ReactNode;
}) {
  const items = [
    { key: "public", label: "전체 대화", href: "/community" },
    { key: "mine", label: "내가 쓴 글·문의", href: "/community?scope=mine" },
    { key: "saved", label: "저장한 글", href: "/community?scope=saved" },
    {
      key: "notifications",
      label: "내 글의 새 답변",
      href: "/community?scope=notifications",
    },
  ];
  if (member?.is_admin)
    items.push(
      {
        key: "inbox",
        label: "관리자 · 비공개 문의",
        href: "/community?scope=inbox",
      },
      {
        key: "moderation",
        label: "관리자 · 신고·숨김",
        href: "/community?scope=moderation",
      },
    );
  return (
    <aside className={styles.sidebar} aria-label="게시판 탐색">
      <div className={styles.sideTitle}>COMMUNITY</div>
      <nav>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={`${styles.sideLink} ${active === item.key ? styles.sideActive : ""}`}
          >
            {item.label}
            <span aria-hidden="true">{active === item.key ? "●" : ""}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.sideCard}>
        <span className={styles.smallEyebrow}>작은 도움, 함께 나누기</span>
        <h3>답을 아는 질문이 있나요?</h3>
        <p>짧은 경험 하나도 누군가의 다음 실험에 도움이 됩니다.</p>
        <Link href="/community?unanswered=1">
          답변을 기다리는 질문 <Icon name="arrow" size={15} />
        </Link>
      </div>
      <div className={styles.sideLinks}>
        <Link href="/faq">
          자주 묻는 질문 <Icon name="arrow" size={15} />
        </Link>
        <Link href="/community/guidelines">
          커뮤니티 이용 가이드 <Icon name="arrow" size={15} />
        </Link>
        <Link href="/community/new?visibility=private&category=support">
          <Icon name="lock" size={15} /> 비공개로 문의하기
        </Link>
      </div>
      {children}
    </aside>
  );
}

export function CommunityBody({ text }: { text: string }) {
  // 사용자 HTML·스크립트를 실행하지 않고 React의 텍스트 이스케이프를 그대로 사용합니다.
  return (
    <div className={styles.prose}>
      {text.split("```").map((part, index) =>
        index % 2 ? (
          <pre key={index}>
            <code>
              {part.replace(
                /^(?:python|py|javascript|js|typescript|ts|tsx|jsx|json|bash|sh|shell|sql|r|css|html|text|txt|yaml|yml)\r?\n/i,
                "",
              )}
            </code>
          </pre>
        ) : (
          <p key={index}>{part}</p>
        ),
      )}
    </div>
  );
}

export function AccessMessage({
  message = "로그인하면 이어서 참여할 수 있어요.",
}: {
  message?: string;
}) {
  return (
    <div className={styles.empty}>
      <Icon name="lock" size={30} />
      <h2>{message}</h2>
      <p>
        공개 대화는 누구나 읽을 수 있습니다. 글·댓글 작성과 내 문의 확인에는
        로그인이 필요합니다.
      </p>
      <Link className={styles.primary} href="/login">
        로그인하기 <Icon name="arrow" size={16} />
      </Link>
    </div>
  );
}
