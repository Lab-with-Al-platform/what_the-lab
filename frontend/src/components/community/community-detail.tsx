"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/page-container";
import {
  AREAS,
  communityApi,
  newCommunityToken,
  CommunityComment,
  CommentList,
  communityDate,
  CommunityPost,
  roleName,
  STATUSES,
} from "@/lib/community";
import {
  AccessMessage,
  CommunityBody,
  Icon,
  PostBadges,
  useCommunityMember,
} from "./community-ui";
import styles from "./community.module.css";

type Reports = {
  items: {
    reason: string;
    detail: string;
    handled: boolean;
    created_at: string;
  }[];
  history: { action: string; reason: string; created_at: string }[];
};
type Action = {
  type:
    | "delete"
    | "delete_comment"
    | "report"
    | "hide"
    | "restore"
    | "pin"
    | "unpin"
    | "dismiss_reports";
  commentId?: string;
};

export function CommunityDetail({ postId }: { postId: string }) {
  const router = useRouter();
  const {
    member,
    loading: memberLoading,
    error: memberError,
  } = useCommunityMember();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState("");
  const viewerKey = `${member?.user_id ?? "guest"}:${member?.is_admin === true}`;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<CommunityComment | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [reportType, setReportType] = useState("privacy");
  const [reload, setReload] = useState(0);
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(
    null,
  );
  const [editedBody, setEditedBody] = useState("");
  const token = useRef("");
  const busyRef = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    token.current = newCommunityToken();
  }, []);
  useEffect(() => {
    if (memberLoading) return;
    let active = true;
    setLoading(true);
    setError("");
    setPost(null);
    setComments([]);
    setReports(null);
    const controller = new AbortController();
    Promise.all([
      communityApi<CommunityPost>(`/posts/${postId}`, {
        signal: controller.signal,
      }),
      communityApi<CommentList>(`/posts/${postId}/comments`, {
        signal: controller.signal,
      }),
    ])
      .then(([p, c]) => {
        if (active) {
          setPost(p);
          setComments(c.items);
          setNextCursor(c.next_cursor);
          setAccepted(c.accepted);
        }
      })
      .catch((caught) => {
        if (active) {
          setPost(null);
          setError(caught.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoadedFor(viewerKey);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [postId, memberLoading, viewerKey, reload]);
  const previousMember = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (memberLoading) return;
    if (
      previousMember.current !== undefined &&
      previousMember.current !== (member?.user_id ?? null)
    ) {
      setBody("");
      setEditedBody("");
      setEditingComment(null);
      setAction(null);
      token.current = newCommunityToken();
    }
    previousMember.current = member?.user_id ?? null;
  }, [memberLoading, member]);
  useEffect(() => {
    if (!member?.is_admin || !post) {
      setReports(null);
      return;
    }
    let active = true;
    communityApi<Reports>(`/admin/reports/${postId}`)
      .then((value) => {
        if (active) setReports(value);
      })
      .catch(() => {
        if (active) setReports(null);
      });
    return () => {
      active = false;
    };
  }, [member, post, postId]);
  useEffect(() => {
    if (action) {
      returnFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      returnFocus.current?.focus();
    }
  }, [action]);

  async function run(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "처리하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function toggle(actionName: "bookmark" | "helpful") {
    if (!post) return;
    void run(async () => {
      const enabled =
        actionName === "bookmark" ? !post.bookmarked : !post.reacted;
      await communityApi(`/posts/${postId}/${actionName}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      setPost({
        ...post,
        ...(actionName === "bookmark"
          ? { bookmarked: enabled }
          : {
              reacted: enabled,
              helpful_count: post.helpful_count + (enabled ? 1 : -1),
            }),
      });
    });
  }
  function status(value: CommunityPost["status"], commentId?: string) {
    if (!post) return;
    void run(async () => {
      await communityApi(`/posts/${postId}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: value,
          expected_version: post.version,
          accepted_comment_id: commentId ?? null,
          accepted_comment_version: commentId
            ? (comments.find((comment) => comment.id === commentId) ?? accepted)
                ?.version
            : null,
        }),
      });
      setReload((x) => x + 1);
    });
  }
  function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await communityApi(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: body.trim(),
          client_token: token.current,
        }),
      });
      setBody("");
      token.current = newCommunityToken();
      setReload((x) => x + 1);
      setNotice("댓글을 등록했습니다.");
    });
  }
  function saveComment() {
    if (!editingComment) return;
    void run(async () => {
      await communityApi(`/posts/${postId}/comments/${editingComment.id}`, {
        method: "PUT",
        body: JSON.stringify({
          body: editedBody.trim(),
          expected_version: editingComment.version,
        }),
      });
      setEditingComment(null);
      setReload((x) => x + 1);
      setNotice(
        "댓글을 수정했습니다. 채택된 답변을 수정했다면 작성자의 재확인이 필요합니다.",
      );
    });
  }
  async function moreComments() {
    if (!nextCursor) return;
    await run(async () => {
      const result = await communityApi<CommentList>(
        `/posts/${postId}/comments?after=${nextCursor}`,
      );
      setComments((previous) => [
        ...previous,
        ...result.items.filter((c) => !previous.some((old) => old.id === c.id)),
      ]);
      setNextCursor(result.next_cursor);
      setAccepted(result.accepted);
    });
  }
  function perform() {
    if (!action || !post) return;
    void run(async () => {
      if (action.type === "delete") {
        await communityApi(`/posts/${postId}`, {
          method: "DELETE",
          body: JSON.stringify({ expected_version: post.version }),
        });
        router.push("/community");
      } else if (action.type === "delete_comment") {
        const comment =
          comments.find((item) => item.id === action.commentId) ?? accepted;
        if (!comment) throw new Error("최신 댓글을 다시 확인해 주세요.");
        await communityApi(`/posts/${postId}/comments/${action.commentId}`, {
          method: "DELETE",
          body: JSON.stringify({ expected_version: comment.version, reason }),
        });
        setReload((x) => x + 1);
      } else if (action.type === "report") {
        await communityApi(`/posts/${postId}/reports`, {
          method: "POST",
          body: JSON.stringify({ reason: reportType, detail: reason }),
        });
        setNotice("신고를 접수했습니다. 관리자가 내용을 확인합니다.");
      } else {
        await communityApi(`/admin/posts/${postId}/moderate`, {
          method: "POST",
          body: JSON.stringify({
            action: action.type,
            expected_version: post.version,
            reason,
          }),
        });
        setReload((x) => x + 1);
      }
      setAction(null);
      setReason("");
    });
  }
  function openAction(value: Action) {
    setReason("");
    setError("");
    setAction(value);
  }
  const moderation =
    action && !["report", "delete", "delete_comment"].includes(action.type);
  const deletingOthersComment =
    action?.type === "delete_comment" &&
    !(comments.find((item) => item.id === action.commentId) ?? accepted)
      ?.is_mine;
  const actionTitle =
    action?.type === "report"
      ? "관리자에게 신고하기"
      : action?.type === "delete" || action?.type === "delete_comment"
        ? "정말 삭제할까요?"
        : "운영 조치를 기록합니다";

  return (
    <PageContainer className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/">홈</Link>
        <span>›</span>
        <Link href="/community">자유게시판</Link>
        <span>›</span>
        <span>대화</span>
      </div>
      {loading || memberLoading || loadedFor !== viewerKey ? (
        <p className={styles.loading} role="status">
          글을 불러오고 있어요…
        </p>
      ) : !post ? (
        <div className={styles.empty}>
          <Icon name="lock" size={32} />
          <h1>글을 확인할 수 없습니다</h1>
          <p>
            {memberError || error || "삭제되었거나 접근할 수 없는 글입니다."}
          </p>
          <div className={styles.actions}>
            <Link className={styles.secondary} href="/community">
              게시판으로
            </Link>
            {!member && (
              <Link className={styles.primary} href="/login">
                내 문의 확인을 위해 로그인
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.detailGrid}>
          <div className={styles.main}>
            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
            {error && !action && (
              <p className={styles.error} role="alert">
                {error}{" "}
                <button
                  className={styles.textButton}
                  onClick={() => setReload((x) => x + 1)}
                >
                  최신 글 다시 확인
                </button>
              </p>
            )}
            {post.visibility === "private" && (
              <p className={`${styles.notice} ${styles.privacy}`}>
                <Icon name="lock" size={16} /> 이 글과 댓글은 작성자와
                관리자에게만 보입니다. 공개 검색·공감·공유 대상에 포함되지
                않습니다.
              </p>
            )}
            {post.hidden && (
              <p className={`${styles.notice} ${styles.privacy}`}>
                운영 검토 중인 글입니다. 공개 목록에서 숨겨져 있으며 새 댓글을
                받을 수 없습니다.
              </p>
            )}
            <article className={styles.panel}>
              <div className={styles.article}>
                <PostBadges post={post} />
                <h1>{post.title}</h1>
                <div className={styles.meta}>
                  <span className={styles.avatar}>
                    {post.author_name.slice(0, 1)}
                  </span>
                  <strong>{post.author_name}</strong>
                  <span>{roleName(post.author_role)}</span>
                  <time dateTime={post.created_at}>
                    {communityDate(post.created_at, true)}
                  </time>
                  {post.version > 1 && <span>수정·상태 변경됨</span>}
                </div>
                <CommunityBody text={post.body ?? ""} />
                {post.insight && (
                  <div className={styles.notice}>
                    <p className={styles.meta}>이 대화와 연결된 공개 콘텐츠</p>
                    <Link
                      href={post.insight.href}
                      style={{ fontWeight: 650, color: "var(--color-brand)" }}
                    >
                      {post.insight.title} →
                    </Link>
                  </div>
                )}
                <div className={styles.tags}>
                  {post.tags.map((tag) => (
                    <Link
                      href={`/community?tag=${encodeURIComponent(tag)}`}
                      key={tag}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
              <div className={styles.articleFooter}>
                <div className={styles.actions}>
                  {post.visibility === "public" && (
                    <>
                      <button
                        className={`${styles.secondary} ${post.reacted ? styles.selectedAction : ""}`}
                        disabled={
                          !member || busy || post.is_mine || post.hidden
                        }
                        aria-pressed={post.reacted}
                        onClick={() => toggle("helpful")}
                      >
                        <Icon name="heart" size={15} /> 공감{" "}
                        {post.helpful_count}
                      </button>
                      <button
                        className={`${styles.secondary} ${post.bookmarked ? styles.selectedAction : ""}`}
                        disabled={!member || busy || post.hidden}
                        aria-pressed={post.bookmarked}
                        onClick={() => toggle("bookmark")}
                      >
                        <Icon name="bookmark" size={15} />
                        {post.bookmarked ? "저장됨" : "저장"}
                      </button>
                      <button
                        className={styles.textButton}
                        onClick={() => {
                          if (navigator.clipboard)
                            navigator.clipboard
                              .writeText(window.location.href)
                              .then(() => setNotice("글 주소를 복사했습니다."))
                              .catch(() =>
                                setNotice("주소창의 글 주소를 복사해 주세요."),
                              );
                          else setNotice("주소창의 글 주소를 복사해 주세요.");
                        }}
                      >
                        링크 복사
                      </button>
                    </>
                  )}
                </div>
                <div className={styles.actions}>
                  {post.is_mine && (
                    <>
                      <Link
                        className={styles.textButton}
                        href={`/community/${postId}/edit`}
                      >
                        수정
                      </Link>
                      <button
                        className={styles.textButton}
                        disabled={busy}
                        onClick={() => openAction({ type: "delete" })}
                      >
                        삭제
                      </button>
                    </>
                  )}
                  {member && (
                    <button
                      className={styles.textButton}
                      onClick={() => openAction({ type: "report" })}
                    >
                      신고
                    </button>
                  )}
                </div>
              </div>
            </article>
            <section
              className={`${styles.panel} ${styles.comments}`}
              aria-label="댓글"
            >
              <h2>
                함께 나눈 답변{" "}
                <span className={styles.count}>{post.reply_count}</span>
              </h2>
              {!comments.length && (
                <p className={styles.meta}>
                  아직 답변이 없습니다. 알고 있는 작은 경험을 나눠 주세요.
                </p>
              )}
              {(accepted
                ? [
                    accepted,
                    ...comments.filter((comment) => comment.id !== accepted.id),
                  ]
                : comments
              ).map((comment) => (
                <article
                  id={`comment-${comment.id}`}
                  className={`${styles.comment} ${comment.id === post.accepted_comment_id ? styles.accepted : ""}`}
                  key={comment.id}
                >
                  {comment.id === post.accepted_comment_id && (
                    <p className={styles.count} style={{ marginBottom: 12 }}>
                      ✓ 해결에 도움이 된 답변
                    </p>
                  )}
                  <div className={styles.commentTop}>
                    <strong style={{ fontSize: 13 }}>
                      {comment.author_name}
                    </strong>
                    <span className={styles.meta}>
                      {roleName(comment.author_role)}
                    </span>
                    {comment.is_staff && (
                      <span className={styles.brandBadge}>관리자 답변</span>
                    )}
                    <time className={styles.meta}>
                      {communityDate(comment.created_at, true)}
                    </time>
                  </div>
                  {editingComment?.id === comment.id ? (
                    <div>
                      <label className={styles.meta} htmlFor="edit-comment">
                        댓글 수정
                      </label>
                      <textarea
                        id="edit-comment"
                        className={`${styles.textarea} ${styles.replyInput}`}
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        maxLength={5000}
                        disabled={busy}
                      />
                      <div className={styles.actions}>
                        <button
                          className={styles.secondary}
                          disabled={busy}
                          onClick={() => setEditingComment(null)}
                        >
                          수정 취소
                        </button>
                        <button
                          className={styles.primary}
                          disabled={busy || !editedBody.trim()}
                          onClick={saveComment}
                        >
                          수정 저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CommunityBody text={comment.body} />
                  )}
                  <div className={styles.commentActions}>
                    {comment.is_mine && (
                      <button
                        className={styles.textButton}
                        disabled={busy}
                        onClick={() => {
                          setEditingComment(comment);
                          setEditedBody(comment.body);
                        }}
                      >
                        댓글 수정
                      </button>
                    )}
                    {post.can_manage && (
                      <button
                        className={styles.textButton}
                        disabled={busy}
                        onClick={() =>
                          status(
                            comment.id === post.accepted_comment_id
                              ? "open"
                              : "resolved",
                            comment.id === post.accepted_comment_id
                              ? undefined
                              : comment.id,
                          )
                        }
                      >
                        {comment.id === post.accepted_comment_id
                          ? "채택 취소"
                          : "해결 답변으로 채택"}
                      </button>
                    )}
                    {(comment.is_mine || member?.is_admin) && (
                      <button
                        className={styles.textButton}
                        disabled={busy}
                        onClick={() =>
                          openAction({
                            type: "delete_comment",
                            commentId: comment.id,
                          })
                        }
                      >
                        댓글 삭제
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {nextCursor && (
                <button
                  className={styles.secondary}
                  style={{ marginTop: 15 }}
                  disabled={busy}
                  onClick={moreComments}
                >
                  다음 답변 더 보기
                </button>
              )}
              {member && !post.hidden ? (
                <form onSubmit={reply}>
                  <label
                    htmlFor="community-reply"
                    className={styles.meta}
                    style={{ marginTop: 22 }}
                  >
                    {post.visibility === "private"
                      ? "비공개 답변"
                      : "내 경험 나누기"}
                  </label>
                  <textarea
                    id="community-reply"
                    className={`${styles.textarea} ${styles.replyInput}`}
                    placeholder="도움이 될 만한 방법이나 확인할 점을 알려 주세요."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    maxLength={5000}
                    disabled={busy}
                  />
                  <div
                    className={styles.formActions}
                    style={{ paddingTop: 12 }}
                  >
                    <span className={styles.meta}>
                      {body.length} / 5,000 · 개인정보와 인증정보는 제외해
                      주세요.
                    </span>
                    <button
                      className={styles.primary}
                      disabled={busy || !body.trim()}
                    >
                      {busy ? "처리 중…" : "답변 등록"}
                    </button>
                  </div>
                </form>
              ) : (
                !member && (
                  <AccessMessage message="로그인하고 대화에 참여해 보세요" />
                )
              )}
            </section>
            <Link
              href="/community"
              className={styles.textButton}
              style={{ marginTop: 18 }}
            >
              <Icon name="back" size={16} />
              목록으로
            </Link>
          </div>
          <aside className={styles.rightRail}>
            <div className={styles.railCard}>
              <h2>이 대화의 현재 상태</h2>
              <p>{STATUSES[post.status]}</p>
              {post.can_manage && (
                <div className={styles.actions} style={{ marginTop: 12 }}>
                  {(["open", "in_progress", "resolved"] as const).map(
                    (value) => (
                      <button
                        key={value}
                        disabled={busy || value === post.status}
                        onClick={() => status(value)}
                        className={styles.secondary}
                      >
                        {STATUSES[value]}
                      </button>
                    ),
                  )}
                </div>
              )}
              <p style={{ marginTop: 14 }}>
                상태는 글 작성자와 관리자가 변경할 수 있습니다.
              </p>
            </div>
            {post.visibility === "public" && post.tags.length > 0 && (
              <div className={styles.railCard}>
                <h2>필요한 기술이 떠올랐다면</h2>
                <p>
                  태그를 검색어로 사용해 전문가를 찾아보세요. 게시글 답변은 역량
                  인증이나 협업 확정을 뜻하지 않습니다.
                </p>
                <Link href={`/experts?q=${encodeURIComponent(post.tags[0])}`}>
                  관련 전문가 찾아보기
                  <Icon name="arrow" size={15} />
                </Link>
              </div>
            )}
            <div className={styles.railCard}>
              <h2>관련 영역</h2>
              <p>{AREAS[post.area]}</p>
              <Link href="/faq">
                FAQ에서 먼저 확인하기
                <Icon name="arrow" size={15} />
              </Link>
              <Link href="/community/guidelines">
                이용 가이드
                <Icon name="arrow" size={15} />
              </Link>
            </div>
            {member?.is_admin && (
              <div className={styles.railCard}>
                <h2>게시판 운영</h2>
                <div className={styles.actions}>
                  {(post.hidden ? ["restore"] : ["hide"]).map((value) => (
                    <button
                      className={styles.secondary}
                      disabled={busy}
                      key={value}
                      onClick={() =>
                        openAction({ type: value as Action["type"] })
                      }
                    >
                      {value === "hide" ? "글 숨기기" : "숨김 해제"}
                    </button>
                  ))}
                  {post.visibility === "public" && (
                    <button
                      className={styles.secondary}
                      disabled={busy}
                      onClick={() =>
                        openAction({ type: post.pinned ? "unpin" : "pin" })
                      }
                    >
                      {post.pinned ? "고정 해제" : "목록에 고정"}
                    </button>
                  )}
                  <button
                    className={styles.textButton}
                    disabled={busy}
                    onClick={() => openAction({ type: "dismiss_reports" })}
                  >
                    신고 검토 완료
                  </button>
                </div>
                <h2 style={{ marginTop: 22 }}>접수된 신고</h2>
                {reports ? (
                  reports.items.length ? (
                    reports.items.map((r, i) => (
                      <p key={i}>
                        {r.reason} · {r.handled ? "처리됨" : "검토 대기"}
                        <br />
                        {r.detail}
                      </p>
                    ))
                  ) : (
                    <p>접수된 신고가 없습니다.</p>
                  )
                ) : (
                  <p>신고 내역을 불러오지 못했습니다.</p>
                )}
                {reports?.history.length ? (
                  <details style={{ marginTop: 16 }}>
                    <summary className={styles.meta}>운영 조치 이력</summary>
                    {reports.history.map((e, i) => (
                      <p key={i}>
                        {e.action} · {communityDate(e.created_at)}
                        <br />
                        {e.reason}
                      </p>
                    ))}
                  </details>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="detail-action-title"
        aria-describedby="detail-action-description"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setAction(null);
        }}
      >
        <h2 id="detail-action-title">{actionTitle}</h2>
        <p id="detail-action-description">
          {action?.type === "report"
            ? "신고 내용은 관리자만 확인합니다. 신고만으로 글이 자동 삭제되지는 않습니다."
            : moderation
              ? "변경 사유는 관리자 이력에 남습니다. 비공개 문의의 공개 범위는 바뀌지 않습니다."
              : "삭제 후에는 글이나 댓글을 화면에서 다시 볼 수 없습니다."}
        </p>
        {action?.type === "report" && (
          <select
            aria-label="신고 유형"
            className={styles.input}
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="privacy">개인정보·연구정보 노출</option>
            <option value="spam">광고·스팸</option>
            <option value="abuse">비방·괴롭힘</option>
            <option value="other">기타</option>
          </select>
        )}
        {(moderation || deletingOthersComment || action?.type === "report") && (
          <textarea
            aria-label={
              moderation || deletingOthersComment
                ? "운영 조치 사유"
                : "신고 내용"
            }
            className={`${styles.textarea} ${styles.replyInput}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              moderation || deletingOthersComment
                ? "조치 사유를 3자 이상 입력해 주세요"
                : "확인할 내용을 적어 주세요 (선택)"
            }
            maxLength={deletingOthersComment ? 450 : 500}
          />
        )}
        {error && action && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={() => setAction(null)}
          >
            취소
          </button>
          <button
            className={styles.primary}
            disabled={
              busy ||
              ((!!moderation || deletingOthersComment) &&
                reason.trim().length < 3)
            }
            onClick={perform}
          >
            {busy ? "처리 중…" : "확인"}
          </button>
        </div>
      </dialog>
    </PageContainer>
  );
}
