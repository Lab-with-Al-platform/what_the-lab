"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { ApiError } from "@/lib/api";
import {
  communityApi,
  communityDate,
  communityPage,
  NotificationList,
  PostList,
  roleName,
} from "@/lib/community";
import { communityCategoryLabel } from "@/lib/community-navigation";
import {
  AccessMessage,
  CommunitySidebar,
  Icon,
  PostBadges,
  useCommunityMember,
} from "./community-ui";
import styles from "./community.module.css";

const SCOPE_LABELS: Record<string, string> = {
  public: "전체 대화",
  mine: "내가 쓴 글·문의",
  saved: "저장한 글",
  inbox: "관리자 · 비공개 문의",
  moderation: "관리자 · 신고·숨김",
  notifications: "내 글의 새 답변",
};

export function CommunityBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const {
    member,
    loading: memberLoading,
    error: memberError,
  } = useCommunityMember();
  const [data, setData] = useState<PostList | null>(null);
  const [notifications, setNotifications] = useState<NotificationList | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState("");
  const viewerKey = `${member?.user_id ?? "guest"}:${member?.is_admin === true}`;
  const [reload, setReload] = useState(0);
  const scope =
    params.get("scope") && SCOPE_LABELS[params.get("scope")!]
      ? params.get("scope")!
      : "public";
  const queryString = params.toString();
  const page = communityPage(params.get("page"));

  useEffect(() => {
    if (memberLoading) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setNotifications(null);
    if (scope !== "public" && !member) {
      setLoadedFor(viewerKey);
      setLoading(false);
      return;
    }
    const query = new URLSearchParams(queryString);
    query.set("scope", scope);
    const promise =
      scope === "notifications"
        ? communityApi<NotificationList>("/notifications", {
            signal: controller.signal,
          }).then((value) => {
            if (!controller.signal.aborted) setNotifications(value);
          })
        : communityApi<PostList>(`/posts?${query}`, {
            signal: controller.signal,
          }).then((value) => {
            if (!controller.signal.aborted) setData(value);
          });
    promise
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof ApiError
              ? caught.message
              : "목록을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedFor(viewerKey);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [scope, queryString, memberLoading, member, viewerKey, reload]);

  function filter(next: Record<string, string>) {
    const query = new URLSearchParams(queryString);
    query.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    router.push(`/community${query.size ? `?${query}` : ""}`, {
      scroll: false,
    });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    filter({
      q: String(new FormData(event.currentTarget).get("q") ?? "").trim(),
    });
  }
  async function readAll() {
    try {
      await communityApi("/notifications/read", { method: "PUT" });
      setReload((x) => x + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "읽음 처리에 실패했습니다.",
      );
    }
  }
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const firstNumber = Math.max(1, Math.min(page - 2, totalPages - 4));
  const numbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => firstNumber + i,
  );

  return (
    <PageContainer className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/">홈</Link>
        <span>›</span>
        <span>자유게시판</span>
      </div>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>COMMUNITY & FEEDBACK</p>
          <h1>질문에서 시작하는 연결</h1>
          <p>
            연구의 막힌 순간부터, 작지만 반가운 발견까지.
            <br />
            함께 묻고 나누며 랩브릿지를 만들어 가요.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.secondary} href="/faq">
            FAQ 먼저 보기
          </Link>
          <Link className={styles.primary} href="/community/new">
            <Icon name="plus" size={17} /> 글쓰기
          </Link>
        </div>
      </header>
      <div className={styles.entryGrid}>
        <Link href="/community/new?category=question" className={styles.entry}>
          <span className={styles.entryIcon}>
            <Icon name="chat" />
          </span>
          <div>
            <strong>작은 질문부터 괜찮아요</strong>
            <p>지금 막힌 한 가지를 함께 풀어요.</p>
          </div>
        </Link>
        <Link href="/community/new?category=idea" className={styles.entry}>
          <span className={styles.entryIcon}>
            <Icon name="plus" />
          </span>
          <div>
            <strong>이렇게 바뀌면 좋겠어요</strong>
            <p>사용하며 발견한 불편과 아이디어.</p>
          </div>
        </Link>
        <Link
          href="/community/new?category=support&visibility=private"
          className={styles.entry}
        >
          <span className={styles.entryIcon}>
            <Icon name="lock" />
          </span>
          <div>
            <strong>개인적인 문의는 안전하게</strong>
            <p>작성자와 관리자만 볼 수 있어요.</p>
          </div>
        </Link>
      </div>
      <div className={styles.grid}>
        <CommunitySidebar active={scope} category={params.get("category")} queryString={queryString} member={member} />
        <section className={styles.main} aria-label={scope === "public" ? communityCategoryLabel(params.get("category")) : SCOPE_LABELS[scope]}>
          {memberError && (
            <p className={styles.error} role="alert">
              {memberError}
            </p>
          )}
          {scope === "inbox" && (
            <p className={`${styles.notice} ${styles.privacy}`}>
              비공개 문의입니다. 제목·내용을 외부로 공유하지 마세요. 공통 관리자
              계정만 열람·답변할 수 있습니다.
            </p>
          )}
          {scope === "mine" && (
            <p className={styles.notice}>
              공개 글과 비공개 문의를 여기에서 함께 확인합니다. 다른 회원에게는
              내 비공개 문의가 보이지 않습니다.
            </p>
          )}
          {scope !== "notifications" && (
            <>
              <div className={styles.filters}>
                <form className={styles.search} onSubmit={search}>
                  <Icon name="search" size={17} />
                  <label className="sr-only" htmlFor="community-query">
                    게시글 제목·내용 검색
                  </label>
                  <input
                    id="community-query"
                    key={params.get("q")}
                    name="q"
                    defaultValue={params.get("q") ?? ""}
                    placeholder="제목이나 내용으로 검색"
                    maxLength={200}
                  />
                  <button type="submit">검색</button>
                </form>
                <label className="sr-only" htmlFor="community-status">
                  대화 상태
                </label>
                <select
                  id="community-status"
                  className={styles.select}
                  value={params.get("status") ?? ""}
                  onChange={(e) => filter({ status: e.target.value })}
                >
                  <option value="">모든 상태</option>
                  <option value="open">대화 중</option>
                  <option value="in_progress">확인 중</option>
                  <option value="resolved">해결됨</option>
                </select>
                <label className="sr-only" htmlFor="community-order">
                  목록 정렬
                </label>
                <select
                  id="community-order"
                  className={styles.select}
                  value={params.get("order") ?? "latest"}
                  onChange={(e) => filter({ order: e.target.value })}
                >
                  <option value="latest">최신순</option>
                  <option value="helpful">공감순</option>
                  <option value="oldest">오래된 순</option>
                </select>
              </div>
              <div className={styles.filterLine}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={params.get("unanswered") === "1"}
                    onChange={(e) =>
                      filter({ unanswered: e.target.checked ? "1" : "" })
                    }
                  />
                  답변을 기다리는 질문
                </label>
                {params.get("q") ||
                params.get("tag") ||
                params.get("category") ||
                params.get("status") ||
                params.get("unanswered") ? (
                  <button
                    className={styles.textButton}
                    onClick={() =>
                      router.push(
                        scope === "public"
                          ? "/community"
                          : `/community?scope=${scope}`,
                        { scroll: false },
                      )
                    }
                  >
                    {params.get("tag") ? `#${params.get("tag")} · ` : ""}필터
                    초기화
                  </button>
                ) : null}
              </div>
            </>
          )}
          {error && (
            <div className={styles.error} role="alert">
              {error}{" "}
              <button
                className={styles.textButton}
                onClick={() => setReload((x) => x + 1)}
              >
                다시 불러오기
              </button>
            </div>
          )}
          <div className={styles.panel} aria-busy={loading || memberLoading}>
            <div className={styles.panelHead}>
              <h2>{scope === "public" ? communityCategoryLabel(params.get("category")) : SCOPE_LABELS[scope]}</h2>
              <span className={styles.count}>
                {memberLoading || loadedFor !== viewerKey
                  ? ""
                  : data
                    ? `${data.total}개의 글`
                    : notifications
                      ? `읽지 않은 답변 ${notifications.unread}`
                      : ""}
              </span>
            </div>
            {loading || memberLoading || loadedFor !== viewerKey ? (
              <p className={styles.loading} role="status">
                대화를 불러오고 있어요…
              </p>
            ) : scope !== "public" && !member ? (
              <AccessMessage />
            ) : notifications ? (
              <>
                {notifications.items.length ? (
                  <>
                    <div className={styles.panelHead}>
                      <p className={styles.meta}>
                        내 글에 달린 새 댓글을 확인해요.
                      </p>
                      <button className={styles.textButton} onClick={readAll}>
                        모두 읽음 처리
                      </button>
                    </div>
                    {notifications.items.map((n) => (
                      <Link
                        className={styles.post}
                        key={n.id}
                        href={`/community/${n.post_id}`}
                      >
                        <span className={styles.eyebrow}>
                          {n.read ? "확인한 답변" : "새로운 답변"}
                        </span>
                        <h3>{n.title}</h3>
                        <p className={styles.meta}>
                          {communityDate(n.created_at, true)}
                        </p>
                      </Link>
                    ))}
                  </>
                ) : (
                  <div className={styles.empty}>
                    <Icon name="bell" size={30} />
                    <h2>새 답변이 도착하면 알려드려요</h2>
                    <p>
                      내가 쓴 글에 댓글이 달리면 여기에서 확인할 수 있습니다.
                    </p>
                  </div>
                )}
              </>
            ) : data?.items.length ? (
              data.items.map((post) => (
                <article className={styles.post} key={post.id}>
                  <PostBadges post={post} />
                  <Link href={`/community/${post.id}`}>
                    <h3>{post.title}</h3>
                    <p className={styles.excerpt}>{post.excerpt}</p>
                  </Link>
                  <div className={styles.tags}>
                    {post.tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        className={styles.textButton}
                        style={{ minHeight: 28, padding: 0, fontSize: 11 }}
                        onClick={() => filter({ tag })}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                  <div className={styles.postBottom}>
                    <div className={styles.meta}>
                      <span className={styles.avatar} aria-hidden="true">
                        {post.author_name.slice(0, 1)}
                      </span>
                      <span>{post.author_name}</span>
                      <span>{roleName(post.author_role)}</span>
                      <span>·</span>
                      <time dateTime={post.created_at}>
                        {communityDate(post.created_at)}
                      </time>
                    </div>
                    <div className={styles.metrics}>
                      <span>
                        <Icon name="heart" size={14} />
                        {post.helpful_count}
                      </span>
                      <span>
                        <Icon name="chat" size={14} />
                        {post.reply_count}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              !error && (
                <div className={styles.empty}>
                  <Icon name="chat" size={32} />
                  <h2>
                    {data && data.total > 0
                      ? "이 페이지에는 글이 없어요"
                      : params.get("q") ||
                          params.get("category") ||
                          params.get("unanswered") ||
                          params.get("tag")
                        ? "아직 이 조건에 맞는 글이 없어요"
                        : "첫 대화의 시작을 기다리고 있어요"}
                  </h2>
                  <p>
                    거창한 질문이 아니어도 괜찮습니다. 지금 막힌 한 가지를 적어
                    주세요.
                  </p>
                  <Link
                    className={styles.primary}
                    href="/community/new?category=question"
                  >
                    질문 남기기 <Icon name="arrow" size={16} />
                  </Link>
                  {page > 1 && (
                    <button
                      className={styles.textButton}
                      onClick={() => filter({ page: "1" })}
                    >
                      첫 페이지로
                    </button>
                  )}
                </div>
              )
            )}
          </div>
          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="게시글 페이지">
              <button
                disabled={page <= 1}
                onClick={() => filter({ page: String(page - 1) })}
              >
                이전
              </button>
              {numbers.map((n) => (
                <button
                  key={n}
                  aria-current={page === n ? "page" : undefined}
                  aria-label={`${n}페이지`}
                  onClick={() => filter({ page: String(n) })}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => filter({ page: String(page + 1) })}
              >
                다음
              </button>
            </nav>
          )}
        </section>
        <aside className={styles.rightRail} aria-label="시작 가이드">
          <div className={styles.railCard}>
            <p className={styles.smallEyebrow}>BETTER TOGETHER</p>
            <h2 style={{ marginTop: 10 }}>질문이 협업의 출발점이 되도록</h2>
            <ol>
              <li>해결하려는 문제를 적어 주세요.</li>
              <li>시도한 방법을 함께 알려 주세요.</li>
              <li>도움이 됐다면 답변을 채택해요.</li>
            </ol>
          </div>
          <div className={styles.railCard}>
            <h2>자주 찾는 도움말</h2>
            <Link href="/faq#private-post">
              비공개 문의는 누가 보나요?
              <Icon name="arrow" size={15} />
            </Link>
            <Link href="/faq#first-question">
              AI를 잘 몰라도 질문할 수 있나요?
              <Icon name="arrow" size={15} />
            </Link>
            <Link href="/faq#research-data">
              연구 데이터는 어떻게 공유하나요?
              <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className={styles.railCard}>
            <h2>읽고, 묻고, 연결하기</h2>
            <p>사례를 읽다 떠오른 질문은 관련 글과 함께 남겨 보세요.</p>
            <Link href="/cases">
              AI 연구 협업 사례
              <Icon name="arrow" size={15} />
            </Link>
            <Link href="/experts">
              AI 전문가 찾기
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
