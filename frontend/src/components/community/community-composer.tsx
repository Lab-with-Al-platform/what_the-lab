"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { ApiError } from "@/lib/api";
import {
  AREAS,
  Category,
  CATEGORIES,
  communityApi,
  newCommunityToken,
  CommunityPost,
  INSIGHT_LINKS,
  PostInput,
  TEMPLATES,
} from "@/lib/community";
import {
  AccessMessage,
  CommunityBody,
  Icon,
  useCommunityMember,
} from "./community-ui";
import styles from "./community.module.css";

export function CommunityComposer({ postId }: { postId?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const { member, loading, error: memberError } = useCommunityMember();
  const [input, setInput] = useState<PostInput>(() => ({
    title: params.get("title")?.slice(0, 120) ?? "",
    body: "",
    category: ((params.get("category") ?? "") in CATEGORIES
      ? params.get("category")
      : "question") as Category,
    visibility: params.get("visibility") === "private" ? "private" : "public",
    tags: [],
    area: "general",
    insight_slug: INSIGHT_LINKS.some((x) => x.slug === params.get("insight"))
      ? params.get("insight")
      : null,
  }));
  const [tags, setTags] = useState("");
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [confirmMode, setConfirmMode] = useState<"submit" | "leave">("submit");
  const [uncertain, setUncertain] = useState(false);
  const token = useRef("");
  const savingRef = useRef(false);
  const loadedDraftKey = useRef("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const confirm = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    token.current = newCommunityToken();
  }, []);
  useEffect(() => {
    if (!postId || !member) return;
    const key = `${member.user_id}:${postId}`;
    if (loadedDraftKey.current === key) return;
    setVersion(0);
    let active = true;
    communityApi<CommunityPost>(`/posts/${postId}`)
      .then((p) => {
        if (!active) return;
        if (!p.is_mine) {
          setError("작성자만 이 글을 수정할 수 있습니다.");
          return;
        }
        setInput({
          title: p.title,
          body: p.body ?? "",
          category: p.category,
          visibility: p.visibility,
          tags: p.tags,
          area: p.area,
          insight_slug: p.insight?.slug ?? null,
        });
        setTags(p.tags.join(", "));
        setVersion(p.version);
        loadedDraftKey.current = key;
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, [postId, member]);
  const composingMember = useRef<number | null>(null);
  useEffect(() => {
    if (loading || !member) return;
    if (
      composingMember.current !== null &&
      composingMember.current !== member.user_id
    ) {
      setInput((value) => ({ ...value, title: "", body: "", tags: [] }));
      setTags("");
      setDirty(false);
      setAcknowledged(false);
      setUncertain(false);
      setVersion(0);
      token.current = newCommunityToken();
    }
    composingMember.current = member.user_id;
  }, [member, loading]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || savingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const guardLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a");
      if (
        dirty &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        event.button === 0 &&
        link?.getAttribute("target") !== "_blank" &&
        link?.getAttribute("href")?.startsWith("/") &&
        !window.confirm(
          "아직 저장하지 않은 내용은 사라집니다. 다른 화면으로 이동할까요?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [dirty, saving]);

  function change<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setInput((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setAcknowledged(false);
  }
  function askSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!acknowledged) {
      setError("아래 공개 범위와 작성 내용을 먼저 확인해 주세요.");
      return;
    }
    if (tags.split(",").filter((t) => t.trim()).length > 5) {
      setError("태그는 5개까지 입력할 수 있습니다.");
      return;
    }
    if (
      tags.split(",").some((tag) => tag.trim().replace(/^#+/, "").length > 20)
    ) {
      setError("태그 하나는 20자까지 입력할 수 있습니다.");
      document.getElementById("post-tags")?.focus();
      return;
    }
    setConfirmMode("submit");
    returnFocus.current = document.activeElement as HTMLElement;
    confirm.current?.showModal();
  }
  async function submit() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const content = {
      ...input,
      title: input.title.trim(),
      body: input.body.trim(),
      tags: [
        ...new Set(
          tags
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter(Boolean),
        ),
      ],
    };
    try {
      const result = await communityApi<CommunityPost>(
        postId ? `/posts/${postId}` : "/posts",
        {
          method: postId ? "PUT" : "POST",
          body: JSON.stringify({
            ...content,
            ...(postId
              ? { expected_version: version }
              : { client_token: token.current }),
          }),
        },
      );
      setDirty(false);
      confirm.current?.close();
      router.push(`/community/${result.id}`);
    } catch (caught) {
      confirm.current?.close();
      setError(
        caught instanceof Error
          ? caught.message
          : "저장하지 못했습니다. 입력은 그대로 남아 있습니다.",
      );
      if (
        !postId &&
        (!(caught instanceof ApiError) || (caught.status ?? 500) >= 500)
      )
        setUncertain(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function insertTemplate() {
    if (input.body.trim()) {
      setError(
        "이미 작성 중인 내용이 있습니다. 기존 내용을 지운 뒤 틀을 넣어 주세요.",
      );
      return;
    }
    change("body", TEMPLATES[input.category] ?? "[나누고 싶은 이야기]\n\n");
  }
  const disabled = saving || uncertain || (!!postId && version === 0);

  return (
    <PageContainer className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/">홈</Link>
        <span>›</span>
        <Link href="/community">자유게시판</Link>
        <span>›</span>
        <span>{postId ? "글 수정" : "글쓰기"}</span>
      </div>
      <div className={styles.form}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>SHARE YOUR QUESTION</p>
            <h1>
              {postId ? "이야기를 다듬어 주세요" : "무슨 이야기를 나눌까요?"}
            </h1>
            <p>작은 질문도, 솔직한 피드백도 환영합니다.</p>
          </div>
        </header>
        {loading ? (
          <p className={styles.loading}>로그인 정보를 확인하고 있어요…</p>
        ) : !member ? (
          <>
            <AccessMessage />
            {memberError && <p className={styles.error}>{memberError}</p>}
          </>
        ) : (
          <form className={styles.panel} onSubmit={askSubmit}>
            <div className={styles.formPanel}>
              <fieldset
                className={styles.field}
                disabled={!!postId || saving || uncertain}
              >
                <legend>누가 볼 수 있나요?</legend>
                <div className={styles.visibilityOptions}>
                  {(["public", "private"] as const).map((visibility) => (
                    <label
                      key={visibility}
                      className={`${styles.visibilityOption} ${input.visibility === visibility ? styles.visibilityActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        checked={input.visibility === visibility}
                        onChange={() => change("visibility", visibility)}
                      />
                      <div>
                        <strong>
                          {visibility === "public"
                            ? "공개 대화"
                            : "비공개 문의"}
                        </strong>
                        <span>
                          {visibility === "public"
                            ? "로그인하지 않은 방문자도 읽을 수 있어요."
                            : "작성자와 관리자만 확인해요."}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                <small>
                  {postId
                    ? "기존 댓글의 공개 범위를 보호하기 위해 등록 후에는 변경할 수 없습니다."
                    : "개인적인 계정 문제와 민감한 문의는 비공개를 선택해 주세요."}
                </small>
              </fieldset>
              {input.visibility === "private" && (
                <p className={`${styles.notice} ${styles.privacy}`}>
                  <strong>작성자와 관리자만 보는 대화입니다.</strong>
                  <br />
                  비밀번호·인증번호·API 키·연구 원자료는 비공개 문의에도 적지
                  마세요. 입력 내용은 이 브라우저에 임시 저장하지 않습니다.
                </p>
              )}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="post-category">글 종류</label>
                  <select
                    className={styles.input}
                    id="post-category"
                    value={input.category}
                    onChange={(e) =>
                      change("category", e.target.value as Category)
                    }
                    disabled={saving || uncertain}
                  >
                    {Object.entries(CATEGORIES)
                      .filter(([k]) => k !== "notice" || member.is_admin)
                      .map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="post-area">관련 서비스 영역</label>
                  <select
                    className={styles.input}
                    id="post-area"
                    value={input.area}
                    onChange={(e) =>
                      change("area", e.target.value as PostInput["area"])
                    }
                    disabled={saving || uncertain}
                  >
                    {Object.entries(AREAS).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="post-title">
                  제목 <span className={styles.meta}>필수</span>
                </label>
                <input
                  className={styles.input}
                  id="post-title"
                  placeholder="어떤 점이 궁금한지 한 문장으로 알려 주세요"
                  value={input.title}
                  onChange={(e) => change("title", e.target.value)}
                  required
                  minLength={3}
                  maxLength={120}
                  disabled={saving || uncertain}
                />
                <p className={styles.counter}>{input.title.length} / 120</p>
              </div>
              <div className={styles.field}>
                <label htmlFor="post-body">
                  내용 <span className={styles.meta}>필수</span>
                </label>
                <div className={styles.editorTabs}>
                  <button
                    type="button"
                    aria-pressed={!preview}
                    onClick={() => setPreview(false)}
                  >
                    작성하기
                  </button>
                  <button
                    type="button"
                    aria-pressed={preview}
                    onClick={() => setPreview(true)}
                  >
                    미리보기
                  </button>
                  <button
                    type="button"
                    style={{ marginLeft: "auto" }}
                    onClick={insertTemplate}
                    disabled={saving || uncertain}
                  >
                    작성 틀 넣기
                  </button>
                </div>
                {preview ? (
                  <div
                    className={styles.notice}
                    style={{ minHeight: 270, background: "var(--color-page)" }}
                  >
                    <CommunityBody
                      text={input.body || "작성한 내용이 여기에 표시됩니다."}
                    />
                  </div>
                ) : (
                  <textarea
                    className={styles.textarea}
                    id="post-body"
                    placeholder="어떤 상황인지, 무엇을 시도했는지, 어떤 도움이 필요한지 알려 주세요. 코드는 ```로 감싸면 읽기 편해요."
                    value={input.body}
                    onChange={(e) => change("body", e.target.value)}
                    minLength={10}
                    maxLength={15000}
                    required
                    disabled={saving || uncertain}
                  />
                )}
                <p className={styles.counter}>
                  {input.body.length.toLocaleString()} / 15,000
                </p>
                <small>
                  외부 링크는 텍스트로 표시합니다. 연구 원본 파일·개인 연락처는
                  게시하지 마세요.
                </small>
              </div>
              <div className={styles.field}>
                <label htmlFor="post-tags">
                  태그 <span className={styles.meta}>선택</span>
                </label>
                <input
                  className={styles.input}
                  id="post-tags"
                  value={tags}
                  onChange={(e) => {
                    setTags(e.target.value);
                    setDirty(true);
                    setAcknowledged(false);
                  }}
                  maxLength={110}
                  placeholder="예: 이미지 분석, RAG, 첫 질문"
                  disabled={saving || uncertain}
                />
                <small>
                  쉼표로 구분해 최대 5개, 태그당 20자까지 입력할 수 있어요.
                </small>
              </div>
              <div className={styles.field}>
                <label htmlFor="post-insight">
                  관련 사례·트렌드 연결{" "}
                  <span className={styles.meta}>선택</span>
                </label>
                <select
                  className={styles.input}
                  id="post-insight"
                  value={input.insight_slug ?? ""}
                  onChange={(e) =>
                    change("insight_slug", e.target.value || null)
                  }
                  disabled={saving || uncertain}
                >
                  <option value="">연결하지 않음</option>
                  {INSIGHT_LINKS.map((x) => (
                    <option value={x.slug} key={x.slug}>
                      {x.kind === "case" ? "[연구사례]" : "[트렌드]"} {x.title}
                    </option>
                  ))}
                </select>
                <small>
                  공개된 콘텐츠의 링크만 연결합니다. 내 연구의 비공개 자료는
                  가져오지 않습니다.
                </small>
              </div>
              <div className={styles.confirm}>
                <label>
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    required
                  />
                  <span>
                    <strong>
                      {input.visibility === "public"
                        ? "누구나 볼 수 있는 공개 글"
                        : "작성자와 관리자만 보는 비공개 문의"}
                    </strong>
                    임을 확인했고, 공유하면 안 되는 연구
                    자료·개인정보·인증정보를 넣지 않았습니다.
                  </span>
                </label>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.formActions}>
                {uncertain && (
                  <div className={styles.notice} role="status">
                    서버의 등록 결과를 확인하지 못했습니다. 입력을 유지한 채
                    같은 요청을 다시 확인하면 중복 등록을 방지합니다.
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={saving}
                      onClick={submit}
                    >
                      같은 요청 다시 확인
                    </button>
                    <Link href="/community?scope=mine">
                      내가 쓴 글에서 확인
                    </Link>
                  </div>
                )}
                <Link
                  className={styles.textButton}
                  href="/community/guidelines"
                >
                  이용 가이드
                </Link>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={saving || uncertain}
                    onClick={() => {
                      if (dirty) {
                        setConfirmMode("leave");
                        returnFocus.current =
                          document.activeElement as HTMLElement;
                        confirm.current?.showModal();
                      } else router.push("/community");
                    }}
                  >
                    나가기
                  </button>
                  <button
                    type="submit"
                    className={styles.primary}
                    disabled={
                      disabled ||
                      !acknowledged ||
                      input.title.trim().length < 3 ||
                      input.body.trim().length < 10
                    }
                  >
                    {saving
                      ? "저장하는 중…"
                      : postId
                        ? "수정 내용 확인"
                        : input.visibility === "private"
                          ? "비공개 문의 등록"
                          : "공개 글 등록"}
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
      <dialog
        ref={confirm}
        className={styles.dialog}
        aria-labelledby="composer-confirm-title"
        aria-describedby="composer-confirm-description"
        onClose={() => returnFocus.current?.focus()}
        onCancel={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <h2 id="composer-confirm-title">
          {confirmMode === "leave"
            ? "작성을 그만둘까요?"
            : input.visibility === "public"
              ? "공개 범위를 확인해 주세요"
              : "비공개 문의를 등록할까요?"}
        </h2>
        <p id="composer-confirm-description">
          {confirmMode === "leave"
            ? "아직 저장되지 않은 내용은 사라집니다."
            : input.visibility === "public"
              ? "이 글과 댓글은 로그인하지 않은 방문자도 읽을 수 있습니다. 등록 후 공개·비공개 전환은 지원하지 않습니다."
              : "이 글과 댓글은 작성자와 관리자만 볼 수 있습니다. 공개 게시판과 검색 결과에는 나타나지 않습니다."}
        </p>
        <strong>{input.title}</strong>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={saving || uncertain}
            onClick={() => confirm.current?.close()}
          >
            계속 작성
          </button>
          {confirmMode === "leave" ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setDirty(false);
                router.push("/community");
              }}
            >
              작성 취소
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={saving || uncertain}
              onClick={submit}
            >
              {saving ? "저장하는 중…" : postId ? "수정 저장" : "확인하고 등록"}
            </button>
          )}
        </div>
      </dialog>
    </PageContainer>
  );
}
