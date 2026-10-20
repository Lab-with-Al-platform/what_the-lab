"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import {
  DATA_STATUS_LABELS,
  DATA_TYPE_LABELS,
  formatDate,
  MEETING_LABELS,
  OUTPUT_LABELS,
  Research,
  ResearchInput,
  REWARD_LABELS,
  SHARE_LABELS,
} from "@/lib/my-research";
import { AbleWorkOption, FieldCategory, MyResearchModal } from "@/components/my-research-modal";

/** 내 연구 상세. 연구 하나와 분류표 목록을 불러와 보여 주고, 여기서 수정·삭제·지정할 수 있어요. */
export function MyResearchDetail({ researchId }: { researchId: number }) {
  const router = useRouter();
  const [research, setResearch] = useState<Research | null>(null);
  const [ableWorks, setAbleWorks] = useState<AbleWorkOption[]>([]);
  const [fields, setFields] = useState<FieldCategory[]>([]);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false); // 지정·삭제 요청 중
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    Promise.all([
      requestApi<Research>(`/researcher/researches/${researchId}`),
      requestApi<AbleWorkOption[]>("/expert/able-works"),
      requestApi<FieldCategory[]>("/taxonomy/fields"),
    ])
      .then(([loadedResearch, loadedWorks, loadedFields]) => {
        setResearch(loadedResearch);
        setAbleWorks(loadedWorks);
        setFields(loadedFields);
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요"));
  }, [researchId]);

  if (loadError) return <LoadError message={loadError} />;
  if (!research) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const workName = new Map(ableWorks.map((work) => [work.able_work_id, work.name]));
  const fieldName = new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name])));
  const draft = research.status === "draft";
  const edited = research.updated_at.slice(0, 10) !== research.created_at.slice(0, 10);
  const tasks = research.task_unsure ? ["잘 모르겠어요"] : research.able_work_ids.map((id) => workName.get(id) ?? id);

  /** 저장·지정 API는 최신 목록 전체를 돌려줘요. 그중 이 연구만 골라 화면을 다시 그립니다. */
  function pickThis(list: Research[]) {
    const found = list.find((item) => item.research_id === researchId);
    if (found) setResearch(found);
  }

  async function save(input: ResearchInput) {
    pickThis(await requestApi<Research[]>(`/researcher/researches/${researchId}`, { method: "PUT", body: JSON.stringify(input) }));
    setEditing(false);
  }

  /** 이 연구를 지정하고, 필요하면 바로 전문가 찾기로 이동해요. */
  async function makePrimary(thenFindExperts: boolean) {
    setBusy(true);
    setActionError("");
    try {
      pickThis(await requestApi<Research[]>(`/researcher/researches/${researchId}/primary`, { method: "PUT" }));
      if (thenFindExperts) router.push("/experts");
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setActionError("");
    try {
      await requestApi<Research[]>(`/researcher/researches/${researchId}`, { method: "DELETE" });
      router.push("/my-research"); // 지운 뒤에는 목록으로 돌아가요.
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요");
      setBusy(false);
    }
  }

  return (
    <div>
      {/* 맨 위: 돌아가기 + 지정·수정·삭제 */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/my-research" className="mr-auto inline-flex h-9 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <span aria-hidden="true">←</span> 내 연구로 돌아가기
        </Link>
        {!draft && !research.is_primary && (
          <button type="button" onClick={() => makePrimary(false)} disabled={busy} className="h-9 rounded-button border border-brand px-4 text-[13px] font-semibold text-brand hover:bg-brand-soft disabled:opacity-50">
            이 연구로 지정
          </button>
        )}
        <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-button border border-line px-4 text-[13px] font-semibold text-muted hover:bg-page hover:text-ink">
          {draft ? "이어서 작성" : "수정"}
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="h-9 rounded-button px-3 text-[13px] font-semibold text-danger hover:bg-danger-soft disabled:opacity-50">
          삭제
        </button>
      </div>

      {confirmDelete && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="mr-auto text-sm font-semibold text-danger">이 연구를 삭제할까요? 되돌릴 수 없어요.</p>
          <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="h-9 rounded-button border border-line bg-card px-4 text-[13px] font-semibold text-muted">
            아니요
          </button>
          <button type="button" onClick={remove} disabled={busy} className="h-9 rounded-button bg-danger px-4 text-[13px] font-semibold text-white disabled:opacity-60">
            {busy ? "삭제하는 중…" : "삭제하기"}
          </button>
        </div>
      )}
      {actionError && <p className="mt-3 text-[13px] text-danger">{actionError}</p>}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* 왼쪽: 연구 내용 */}
        <article className="rounded-card border border-line bg-card shadow-card">
          <header className="border-b border-line p-6">
            <div className="flex flex-wrap items-center gap-2">
              {research.is_primary && <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">지정한 연구</span>}
              {draft && <span className="rounded-full border border-line bg-page px-2.5 py-0.5 text-[11px] font-bold text-muted">임시 저장</span>}
              {research.field_ids.map((id) => (
                <span key={id} className="rounded-full bg-researcher-soft px-2.5 py-0.5 text-[11px] font-semibold text-researcher">
                  {fieldName.get(id) ?? id}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-[22px] font-bold leading-snug">{research.title}</h1>
            <p className="mt-2 text-xs text-faint">
              {formatDate(research.created_at)} 작성{edited && ` · ${formatDate(research.updated_at)} 수정`}
              <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-muted">나만 볼 수 있어요</span>
            </p>
          </header>

          <Section title="연구 내용">
            <p className="whitespace-pre-line text-sm leading-relaxed">{research.description || <Empty />}</p>
          </Section>

          <Section title="데이터">
            <InfoGrid>
              <Info label="데이터 종류" value={research.data_types.map((code) => DATA_TYPE_LABELS[code]).join(", ")} />
              <Info label="데이터 상태" value={research.data_status ? DATA_STATUS_LABELS[research.data_status] : ""} />
              <Info
                label="공유 조건"
                value={
                  research.share_policy === "conditional"
                    ? `조건이 있어요 · ${research.share_condition ?? ""}`
                    : research.share_policy
                      ? SHARE_LABELS[research.share_policy].title
                      : ""
                }
              />
            </InfoGrid>
            <p className="mt-4 rounded-button bg-page px-4 py-3 text-[13px] text-muted">
              AI 전문가는 이 조건에 동의해야 요청을 수락할 수 있어요. 데이터 파일은 사이트에 올리지 않아요.
            </p>
          </Section>

          <Section title="협업" last>
            <div className="mb-5">
              <p className="mb-2 text-xs text-faint">맡기고 싶은 일</p>
              {tasks.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {tasks.map((task) => (
                    <span key={task} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand">
                      {task}
                    </span>
                  ))}
                </div>
              ) : (
                <Empty />
              )}
            </div>
            <InfoGrid>
              <Info label="원하는 결과물" value={research.outputs.map((code) => OUTPUT_LABELS[code]).join(", ")} />
              <Info label="보상 형태" value={research.rewards.map((code) => REWARD_LABELS[code]).join(", ") || "선택 안 함"} />
              <Info
                label="미팅 방식"
                value={
                  research.meeting_type === "offline_ok"
                    ? `대면 가능 · ${research.face_to_area ?? ""}`
                    : research.meeting_type
                      ? MEETING_LABELS[research.meeting_type]
                      : "선택 안 함"
                }
              />
            </InfoGrid>
          </Section>
        </article>

        {/* 오른쪽: 이 연구로 보낸 협업 요청 (요청 기능을 만들면 여기에 목록이 들어가요) */}
        <aside className="space-y-3 lg:sticky lg:top-24">
          <section className="rounded-card border border-line bg-card p-5 shadow-card">
            <h2 className="font-bold">이 연구로 협업 요청을 보낸 전문가</h2>
            <div className="mt-4 rounded-card border border-dashed border-line px-4 py-8 text-center">
              <p className="text-sm font-semibold">아직 요청을 보낸 전문가가 없어요</p>
              {draft ? (
                <p className="mt-2 text-xs text-muted">연구를 등록하면 전문가에게 협업 요청을 보낼 수 있어요.</p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  맡길 일 키워드{tasks.length > 0 && research.able_work_ids.length > 0 ? `(${tasks.join(", ")})` : ""}로 전문가를 찾아 드려요.
                </p>
              )}
            </div>
            {draft ? (
              <button type="button" onClick={() => setEditing(true)} className="mt-4 h-11 w-full rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover">
                이어서 작성하기
              </button>
            ) : research.is_primary ? (
              <Link href="/experts" className="mt-4 flex h-11 w-full items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover">
                이 연구로 전문가 찾기
              </Link>
            ) : (
              <button type="button" onClick={() => makePrimary(true)} disabled={busy} className="mt-4 h-11 w-full rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
                이 연구로 지정하고 전문가 찾기
              </button>
            )}
          </section>
          <p className="px-1 text-xs leading-relaxed text-faint">이 연구는 나만 볼 수 있어요. 요청을 보낸 전문가에게만 전달돼요.</p>
        </aside>
      </div>

      {editing && (
        <MyResearchModal
          research={research}
          ableWorks={ableWorks}
          fields={fields}
          onClose={() => setEditing(false)}
          onSave={save}
          onDelete={async () => {
            await requestApi<Research[]>(`/researcher/researches/${researchId}`, { method: "DELETE" });
            router.push("/my-research");
          }}
        />
      )}
    </div>
  );
}

function Section({ title, last, children }: { title: string; last?: boolean; children: ReactNode }) {
  return (
    <section className={`p-6 ${last ? "" : "border-b border-line"}`}>
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-3">{children}</dl>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || <Empty />}</dd>
    </div>
  );
}

function Empty() {
  return <span className="text-faint">아직 안 적었어요</span>;
}

function LoadError({ message }: { message: string }) {
  const needsLogin = message === "로그인이 필요합니다";
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-danger">{message}</p>
      <div className="mt-4 flex justify-center gap-2">
        {needsLogin ? (
          <Link href="/login" className="inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
            로그인하러 가기
          </Link>
        ) : (
          <Link href="/my-research" className="inline-flex h-10 items-center rounded-button border border-line px-4 text-sm font-semibold text-muted">
            내 연구로 돌아가기
          </Link>
        )}
      </div>
    </div>
  );
}