"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { ApiError, requestApi } from "@/lib/api";
import {
  AbleWorkOption,
  CAREER_LABELS,
  CareerProfile,
  FieldCategory,
  formatBytes,
  formatMonth,
  JOB_LABELS,
  MEETING_LABELS,
  optionalChecks,
  portfolioPdfUrl,
  REWARD_LABELS,
  requiredChecks,
  RequiredKey,
  TIME_LABELS,
} from "@/lib/my-career";
import { MyCareerCollaborationModal } from "@/components/my-career-collaboration-modal";
import { HISTORY_LABELS, HistoryItem, HistoryTab, MyCareerHistoryModal } from "@/components/my-career-history-modal";
import { MyCareerIntroModal } from "@/components/my-career-intro-modal";
import { MyCareerPortfolioModal, PdfChange, PortfolioValues } from "@/components/my-career-portfolio-modal";

// 지금 열려 있는 작성 창. id가 있으면 그 항목 수정, 없으면 새로 추가.
type OpenModal =
  | { type: "intro" }
  | { type: "collaboration" }
  | { type: "portfolio"; id: number | null }
  | { type: "history"; tab: HistoryTab; id: number | null }
  | null;

const HISTORY_ID_KEY = { careers: "career_id", educations: "education_id", certificates: "certificate_id" } as const;

/** 내 이력 화면 전체. 처음 열 때 프로필·할 수 있는 일·연구 분야 목록을 한 번에 불러옵니다. */
export function MyCareerProfile() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [ableWorks, setAbleWorks] = useState<AbleWorkOption[]>([]);
  const [fields, setFields] = useState<FieldCategory[]>([]);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState<OpenModal>(null);

  useEffect(() => {
    Promise.all([
      requestApi<CareerProfile>("/expert/profile"),
      requestApi<AbleWorkOption[]>("/expert/able-works"),
      requestApi<FieldCategory[]>("/taxonomy/fields"),
    ])
      .then(([loadedProfile, loadedWorks, loadedFields]) => {
        setProfile(loadedProfile);
        setAbleWorks(loadedWorks);
        setFields(loadedFields);
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요"));
  }, []);

  if (loadError) return <LoadError message={loadError} />;
  if (!profile) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;

  const workName = new Map(ableWorks.map((work) => [work.able_work_id, work.name]));
  const fieldName = new Map(fields.flatMap((category) => category.fields.map((field) => [field.field_id, field.name])));
  const close = () => setOpen(null);

  /** JSON 저장 요청. 백엔드가 돌려준 최신 내 이력으로 화면을 다시 그리고 창을 닫아요. */
  async function save(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) {
    const updated = await requestApi<CareerProfile>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    setProfile(updated);
    close();
  }

  /** 포트폴리오 저장 → (골랐으면) PDF 올리기/지우기 순서로 진행합니다. */
  async function savePortfolio(id: number | null, values: PortfolioValues, pdf: PdfChange) {
    let updated = await requestApi<CareerProfile>(id ? `/expert/portfolios/${id}` : "/expert/portfolios", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(values),
    });
    setProfile(updated);
    // 새로 만든 포트폴리오는 번호가 가장 커요. PDF가 실패해도 같은 창이 '수정'으로 이어지게 번호를 기억합니다.
    const portfolioId = id ?? Math.max(...updated.portfolios.map((item) => item.portfolio_id));
    if (!id) setOpen({ type: "portfolio", id: portfolioId });

    if (pdf.kind !== "keep") {
      const pdfPath = `/expert/portfolios/${portfolioId}/pdf`;
      try {
        updated =
          pdf.kind === "upload"
            ? await requestApi<CareerProfile>(pdfPath, { method: "PUT", body: pdf.file, headers: { "Content-Type": "application/pdf" } })
            : await requestApi<CareerProfile>(pdfPath, { method: "DELETE" });
      } catch (error) {
        const reason = error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요";
        throw new ApiError(`내용은 저장됐지만 PDF는 처리하지 못했어요. ${reason}`);
      }
      setProfile(updated);
    }
    close();
  }

  /** 이어서 작성하기: 아직 비어 있는 첫 필수 항목의 창을 엽니다. */
  function continueWriting(key: RequiredKey) {
    if (key === "collaboration") setOpen({ type: "collaboration" });
    else if (key === "portfolio") setOpen({ type: "portfolio", id: null });
    else setOpen({ type: "intro" });
  }

  const editingPortfolio = open?.type === "portfolio" && open.id !== null ? (profile.portfolios.find((item) => item.portfolio_id === open.id) ?? null) : null;
  const editingHistory: HistoryItem | null =
    open?.type === "history" && open.id !== null
      ? ((profile[open.tab] as HistoryItem[]).find((item) => (item as unknown as Record<string, number>)[HISTORY_ID_KEY[open.tab]] === open.id) ?? null)
      : null;

  return (
    <div>
      <h1 className="text-[28px] font-bold">내 이력</h1>
      <PublishBanner profile={profile} onChange={setProfile} onContinue={continueWriting} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <IntroCard profile={profile} workName={workName} fieldName={fieldName} onEdit={() => setOpen({ type: "intro" })} />
          <CollaborationCard profile={profile} onEdit={() => setOpen({ type: "collaboration" })} />
          <PortfolioCard profile={profile} workName={workName} onAdd={() => setOpen({ type: "portfolio", id: null })} onEdit={(id) => setOpen({ type: "portfolio", id })} />
          <HistoryCard
            tab="careers"
            hint="다닌 회사나 기관, 맡은 일을 적어 주세요. 회사 이름은 밝히고 싶을 때만 적어도 돼요"
            rows={profile.careers.map((item) => ({
              id: item.career_id,
              title: [item.company, item.job].filter(Boolean).join(" · "),
              detail: `${formatMonth(item.start_month)} ~ ${item.end_month ? formatMonth(item.end_month) : "재직 중"}`,
            }))}
            onOpen={(id) => setOpen({ type: "history", tab: "careers", id })}
          />
          <HistoryCard
            tab="educations"
            hint="학교와 전공을 적어 주세요"
            rows={profile.educations.map((item) => ({
              id: item.education_id,
              title: `${item.school} · ${item.major}`,
              detail: item.graduated_year ? `${item.graduated_year} 졸업` : "",
            }))}
            onOpen={(id) => setOpen({ type: "history", tab: "educations", id })}
          />
          <HistoryCard
            tab="certificates"
            hint="AI·데이터 관련 자격증이 있다면 적어 주세요"
            rows={profile.certificates.map((item) => ({
              id: item.certificate_id,
              title: item.name,
              detail: [item.acquired_year && `${item.acquired_year} 취득`, item.issuer].filter(Boolean).join(" · "),
            }))}
            onOpen={(id) => setOpen({ type: "history", tab: "certificates", id })}
          />
        </div>
        <CompletionPanel profile={profile} />
      </div>

      {open?.type === "intro" && (
        <MyCareerIntroModal profile={profile} ableWorks={ableWorks} fields={fields} onClose={close} onSave={(values) => save("/expert/profile/intro", "PUT", values)} />
      )}
      {open?.type === "collaboration" && (
        <MyCareerCollaborationModal collaboration={profile.collaboration} onClose={close} onSave={(values) => save("/expert/collaboration", "PUT", values)} />
      )}
      {open?.type === "portfolio" && (
        <MyCareerPortfolioModal
          portfolio={editingPortfolio}
          ableWorks={ableWorks}
          onClose={close}
          onSave={(values, pdf) => savePortfolio(open.id, values, pdf)}
          onDelete={() => save(`/expert/portfolios/${open.id}`, "DELETE")}
        />
      )}
      {open?.type === "history" && (
        <MyCareerHistoryModal
          tab={open.tab}
          item={editingHistory}
          onClose={close}
          onSave={({ tab, body }) => (open.id ? save(`/expert/${tab}/${open.id}`, "PUT", body) : save(`/expert/${tab}`, "POST", body))}
          onDelete={() => save(`/expert/${open.tab}/${open.id}`, "DELETE")}
        />
      )}
    </div>
  );
}

/** 맨 위 공개 상태 줄. 필수 항목을 다 채우면 스위치로 공개를 켜고 끌 수 있어요. */
function PublishBanner({ profile, onChange, onContinue }: { profile: CareerProfile; onChange: (profile: CareerProfile) => void; onContinue: (key: RequiredKey) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const missing = requiredChecks(profile).filter((check) => !check.done);
  const ready = missing.length === 0;

  async function switchVisibility() {
    setSaving(true);
    setError("");
    try {
      onChange(await requestApi<CareerProfile>("/expert/profile/visibility", { method: "PUT", body: JSON.stringify({ is_public: !profile.is_public }) }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setSaving(false);
    }
  }

  const [title, description] = profile.is_public
    ? ["연구자 찾기 목록에 공개 중이에요", "협업 요청이 오면 디스코드 DM으로 알려 드려요. 잠시 쉬고 싶으면 스위치를 꺼 주세요"]
    : ready
      ? ["공개할 준비가 됐어요", "스위치를 켜면 연구자 찾기 목록에 보이고, 협업 요청을 받을 수 있어요"]
      : ["아직 찾기 목록에 보이지 않아요", "아래 항목을 채우면 공개를 켤 수 있어요"];

  return (
    <section className={`mt-5 rounded-card border p-5 sm:px-6 ${profile.is_public ? "border-success/30 bg-success-soft" : "border-line bg-card shadow-card"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-bold">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${profile.is_public ? "bg-success" : "bg-faint"}`} />
            {title}
          </p>
          <p className="mt-1 text-sm text-muted">{description}</p>
          {!ready && (
            <div className="mt-3 flex flex-wrap gap-2">
              {missing.map((check) => (
                <button key={check.key} type="button" onClick={() => onContinue(check.key)} className="h-8 rounded-full border border-danger/30 bg-danger-soft px-3 text-[13px] font-semibold text-danger">
                  {check.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!ready && (
            <button type="button" onClick={() => onContinue(missing[0].key)} className="h-10 rounded-button bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
              이어서 작성하기
            </button>
          )}
          <label className={`flex items-center gap-2 text-sm font-semibold ${ready || profile.is_public ? "text-ink" : "text-faint"}`}>
            요청 받기
            <button
              type="button"
              role="switch"
              aria-checked={profile.is_public}
              aria-label="프로필 공개"
              disabled={saving || (!ready && !profile.is_public)}
              onClick={switchVisibility}
              className={`relative h-7 w-12 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${profile.is_public ? "bg-success" : "bg-line"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${profile.is_public ? "left-6" : "left-1"}`} />
            </button>
          </label>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function Card({ title, badge, action, children }: { title: string; badge?: "required" | "optional"; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {badge === "required" && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">공개 필수</span>}
        {badge === "optional" && <span className="rounded-full bg-page px-2 py-0.5 text-[11px] font-semibold text-faint">선택</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-9 rounded-button px-3 text-sm font-semibold text-brand hover:bg-brand-soft">
      {children}
    </button>
  );
}

function EmptyAction({ text, label, onClick }: { text: string; label: string; onClick: () => void }) {
  return (
    <div className="mt-4 rounded-card border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm text-muted">{text}</p>
      <button type="button" onClick={onClick} className="mt-3 h-10 rounded-button border border-brand px-4 text-sm font-semibold text-brand hover:bg-brand-soft">
        {label}
      </button>
    </div>
  );
}

function Tags({ items, tone = "brand" }: { items: string[]; tone?: "brand" | "plain" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-2.5 py-1 text-xs ${tone === "brand" ? "bg-brand-soft text-brand" : "bg-page text-muted"}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function IntroCard({ profile, workName, fieldName, onEdit }: { profile: CareerProfile; workName: Map<string, string>; fieldName: Map<string, string>; onEdit: () => void }) {
  return (
    <section className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- 헤더와 같은 방식(서비스 업로드 사진 또는 기본 사진) */}
        <img src={profile.user_photo ?? "/profile-images/default-expert.png"} alt="" className="h-16 w-16 shrink-0 rounded-full bg-page object-cover" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold">
            {profile.nickname}
            <span className="whitespace-nowrap rounded-full bg-expert-soft px-2 py-0.5 text-[11px] font-semibold text-expert">AI 전문가</span>
          </p>
          <p className={`mt-1 text-sm ${profile.introduce ? "text-ink" : "text-danger"}`}>{profile.introduce ?? "한 줄 소개를 적어 주세요"}</p>
          <p className="mt-1 text-xs text-faint">
            {JOB_LABELS[profile.current_job] ?? profile.current_job} · AI 경력 {CAREER_LABELS[profile.ai_career] ?? profile.ai_career}
          </p>
        </div>
        <div className="ml-auto self-start">
          <TextButton onClick={onEdit}>수정</TextButton>
        </div>
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <p className="mb-2 text-sm font-semibold">도메인</p>
        {profile.domain_ids.length ? <Tags items={profile.domain_ids.map((id) => fieldName.get(id) ?? id)} tone="plain" /> : <p className="text-sm text-danger">어떤 분야 데이터를 다뤄 봤는지 골라 주세요</p>}
        <p className="mb-2 mt-5 text-sm font-semibold">할 수 있는 일</p>
        <Tags items={profile.able_work_ids.map((id) => workName.get(id) ?? id)} />
      </div>
    </section>
  );
}

function CollaborationCard({ profile, onEdit }: { profile: CareerProfile; onEdit: () => void }) {
  const collaboration = profile.collaboration;
  return (
    <Card title="협업 조건" badge="required" action={collaboration && <TextButton onClick={onEdit}>수정</TextButton>}>
      {collaboration ? (
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <Info label="미팅" value={collaboration.meeting_type === "offline_ok" ? `대면 가능 · ${collaboration.face_to_area}` : MEETING_LABELS.online} />
          <Info label="주당 시간" value={TIME_LABELS[collaboration.available_time]} />
          <Info label="희망 보상" value={collaboration.rewards.map((code) => REWARD_LABELS[code]).join(", ")} />
        </dl>
      ) : (
        <EmptyAction text="연구자가 요청 전에 가장 먼저 확인하는 정보예요" label="협업 조건 작성하기" onClick={onEdit} />
      )}
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function PortfolioCard({ profile, workName, onAdd, onEdit }: { profile: CareerProfile; workName: Map<string, string>; onAdd: () => void; onEdit: (id: number) => void }) {
  const portfolios = profile.portfolios;
  return (
    <Card title={portfolios.length ? `포트폴리오 ${portfolios.length}` : "포트폴리오"} badge="required" action={portfolios.length > 0 && <TextButton onClick={onAdd}>+ 추가</TextButton>}>
      {portfolios.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {portfolios.map((item) => (
            <article key={item.portfolio_id} className="flex flex-col rounded-card border border-line p-4">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 font-bold">{item.title}</h3>
                <button type="button" onClick={() => onEdit(item.portfolio_id)} className="-mr-2 -mt-1 h-8 shrink-0 rounded-button px-2 text-[13px] font-semibold text-muted hover:bg-page hover:text-ink">
                  수정
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">{item.role}</p>
              <div className="mt-3">
                <Tags items={item.able_work_ids.map((id) => workName.get(id) ?? id)} />
              </div>
              {item.skills.length > 0 && <p className="mt-3 text-xs text-faint">사용 기술 · {item.skills.join(", ")}</p>}
              <div className="mt-auto pt-4">
                {item.has_pdf ? (
                  <a href={portfolioPdfUrl(item.portfolio_id)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-button bg-page px-3 text-[13px] font-semibold text-ink hover:text-brand">
                    <span className="text-danger">PDF</span> 포트폴리오 PDF 보기{item.pdf_size ? ` · ${formatBytes(item.pdf_size)}` : ""}
                  </a>
                ) : (
                  <p className="text-[13px] text-faint">PDF 없음</p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyAction text="무엇을 만들었고 AI로 어떤 일을 했는지, 1개만 올려도 돼요" label="포트폴리오 추가하기" onClick={onAdd} />
      )}
    </Card>
  );
}

type HistoryRow = { id: number; title: string; detail: string };

function HistoryCard({ tab, hint, rows, onOpen }: { tab: HistoryTab; hint: string; rows: HistoryRow[]; onOpen: (id: number | null) => void }) {
  return (
    <Card title={HISTORY_LABELS[tab]} badge="optional" action={<TextButton onClick={() => onOpen(null)}>+ 추가</TextButton>}>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{row.title}</p>
                {row.detail && <p className="mt-0.5 text-xs text-faint">{row.detail}</p>}
              </div>
              <button type="button" onClick={() => onOpen(row.id)} className="h-8 shrink-0 rounded-button px-2 text-[13px] font-semibold text-muted hover:bg-page hover:text-ink">
                수정
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-faint">{hint}</p>
      )}
    </Card>
  );
}

function CompletionPanel({ profile }: { profile: CareerProfile }) {
  const required = requiredChecks(profile);
  const optional = optionalChecks(profile);
  const all = [...required, ...optional];
  const percent = Math.round((all.filter((check) => check.done).length / all.length) * 100);

  return (
    <aside className="rounded-card border border-line bg-card p-5 shadow-card lg:sticky lg:top-24">
      <p className="font-bold">프로필 완성도 {percent}%</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-page">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mb-2 mt-5 text-xs font-semibold text-muted">공개 필수</p>
      <CheckList checks={required} />
      <p className="mb-2 mt-5 text-xs font-semibold text-muted">선택 · 채우면 연구자가 더 믿고 요청해요</p>
      <CheckList checks={optional} />
    </aside>
  );
}

function CheckList({ checks }: { checks: readonly { label: string; done: boolean }[] }) {
  return (
    <ul className="space-y-2">
      {checks.map((check) => (
        <li key={check.label} className={`flex items-center gap-2 text-sm ${check.done ? "text-ink" : "text-faint"}`}>
          <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${check.done ? "bg-success text-white" : "border border-line"}`}>
            {check.done ? "✓" : ""}
          </span>
          {check.label}
          <span className="sr-only">{check.done ? "완료" : "아직"}</span>
        </li>
      ))}
    </ul>
  );
}

function LoadError({ message }: { message: string }) {
  const needsLogin = message === "로그인이 필요합니다";
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-danger">{message}</p>
      {needsLogin && (
        <Link href="/login" className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
          로그인하러 가기
        </Link>
      )}
    </div>
  );
}