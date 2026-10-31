"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeExpertBackHref } from "@/lib/expert-search-navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CollabRequestDialog } from "@/components/collab-request-dialog";
import { ExpertReviewSummary } from "@/components/expert-review-summary";
import { LabTrustIndicator } from "@/components/lab-trust-indicator";
import { getLocalExpertDemo, type DemoReview } from "@/lib/expert-local-demo";
import { getPublicExpertReviews, type PublicExpertRating } from "@/lib/reviews";
import { Modal } from "@/components/modal";
import { PageContainer } from "@/components/page-container";
import { Avatar } from "@/components/request-parts";
import { ApiError, requestApi } from "@/lib/api";
import { photoOrDefault } from "@/lib/collab-requests";
import { buildNames, countByCategory, monthDay, periodLabel, type ExpertCollaboration, type ExpertPublicProfile, type Names } from "@/lib/expert-search";
import { CAREER_LABELS, formatMonth, MEETING_LABELS, REWARD_LABELS, TIME_LABELS, type AbleWorkOption, type FieldCategory } from "@/lib/my-career";

type Role = "researcher" | "expert" | null; // null = 로그인 안 했거나 유형 미선택
type Tab = "work" | "portfolio" | "history";

const DONUT_COLORS = ["#4f7bea", "#22a699", "#f5a524", "#c2508a", "#8c94ab"]; // 도넛·범례 색 (분야 순서대로)

/** 공개 전문가 상세. 협업·평가 / 포트폴리오 / 경력 탭과 요청 CTA를 제공합니다. */
export function ExpertProfileView({ expertId }: { expertId: string }) {
  const searchParams = useSearchParams();
  const backHref = safeExpertBackHref(searchParams.get("from"));
  const [profile, setProfile] = useState<ExpertPublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [ableWorks, setAbleWorks] = useState<AbleWorkOption[]>([]);
  const [categories, setCategories] = useState<FieldCategory[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [tab, setTab] = useState<Tab>("work");
  const [requesting, setRequesting] = useState(false); // 협업 요청 창
  const [copied, setCopied] = useState(false);
  const [demoReviews, setDemoReviews] = useState<DemoReview | null>(null);
  const [verifiedReviews, setVerifiedReviews] = useState<PublicExpertRating | null>(null);
  const [reviewApiError, setReviewApiError] = useState("");
  const [demoRequestInfo, setDemoRequestInfo] = useState(false);

  useEffect(() => {
    if (!/^\d+$/.test(expertId)) {
      setNotFound(true);
      return;
    }
    requestApi<ExpertPublicProfile>(`/experts/${expertId}`)
      .then((liveProfile) => {
        const sample = getLocalExpertDemo(liveProfile);
        setProfile(sample?.profile ?? liveProfile);
        setDemoReviews(sample?.reviews ?? null);
        if (!sample) {
          getPublicExpertReviews(liveProfile.user_id)
            .then((real) => { setVerifiedReviews(real); setReviewApiError(""); })
            .catch(() => setReviewApiError("실제 평가 데이터를 불러오지 못했습니다. 평가용 DB 마이그레이션이 적용됐는지 확인해 주세요."));
        } else {
          setVerifiedReviews(null);
          setReviewApiError("");
        }
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
        else setError(caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");
      });
    Promise.all([requestApi<AbleWorkOption[]>("/expert/able-works"), requestApi<FieldCategory[]>("/taxonomy/fields")])
      .then(([workList, categoryList]) => {
        setAbleWorks(workList);
        setCategories(categoryList);
      })
      .catch(() => undefined); // 이름표를 못 불러오면 칩만 비어 보여요
    requestApi<{ user_role: Role }>("/auth/me")
      .then((me) => setRole(me.user_role))
      .catch(() => setRole(null)); // 로그인 안 해도 프로필은 볼 수 있어요
  }, [expertId]);

  const names = useMemo<Names>(() => buildNames(ableWorks, categories), [ableWorks, categories]);

  async function copyLink() {
    try {
      // A shareable profile URL must not include the researcher's filters or research_id.
      await navigator.clipboard.writeText(new URL(`/experts/${profile?.user_id ?? expertId}`, window.location.origin).href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (notFound || error || !profile) {
    return (
      <PageContainer className="pt-6 pb-20">
        <div className="mx-auto max-w-[1120px]">
          <BackLink href={backHref} />
          {notFound || error ? (
            <div className="mt-6 rounded-2xl border border-[#e6e3f6] bg-card p-10 text-center">
              <p className="text-base font-bold">{notFound ? "공개된 전문가를 찾을 수 없어요" : "프로필을 불러오지 못했어요"}</p>
              <p className="mt-2 text-sm text-muted">{notFound ? "비공개로 바뀌었거나 없는 주소예요." : error}</p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">불러오는 중…</p>
          )}
        </div>
      </PageContainer>
    );
  }

  const collaborations = profile.collaborations ?? []; // 백엔드가 옛 버전이어도 화면은 열려요
  const finished = collaborations.filter((item) => !item.ongoing); // 서버가 완료된 협업만 공개합니다.
  const hasHistory = profile.careers.length + profile.educations.length + profile.certificates.length > 0;
  const hasNoCompletedHistory = finished.length === 0;
  const meta = [profile.affiliation, `AI 경력 ${CAREER_LABELS[profile.ai_career] ?? profile.ai_career}`].filter(Boolean).join(" · ");
  const availabilityNote = profile.engaged
    ? (profile.engaged_until ? `${monthDay(profile.engaged_until)} 종료 예정 · 새 일정 협의 필요` : "진행 중 · 새 일정 협의 필요")
    : "진행 중인 협업 없음 · 일정 협의 필요";
  const rewards = profile.collaboration ? profile.collaboration.rewards.map((code) => REWARD_LABELS[code]).join(", ") : "";
  const currentTab: Tab = tab === "history" && !hasHistory ? "work" : tab;
  const openCollaboration = () => {
    if (demoReviews) setDemoRequestInfo(true);
    else setRequesting(true);
  };

  return (
    <PageContainer className="pt-6 pb-32 lg:pb-20">
      <div className="mx-auto max-w-[1120px]">
        <BackLink href={backHref} />
        {demoReviews && (
          <div role="status" className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-[#c7d6f6] bg-[#f0f5ff] px-4 py-3 sm:px-5">
            <span className="shrink-0 rounded-full bg-[#233f89] px-3 py-1 text-[11px] font-bold tracking-[0.07em] text-white">LOCAL DEMO</span>
            <div className="min-w-0 flex-1 text-[12px] leading-6 text-[#415783]">
              <strong className="font-bold text-[#263d77]">화면 검수용 가상 프로필</strong>
              <p>평가·연구 이력·포트폴리오·학력·자격증은 시연을 위한 예시 데이터입니다. 실제 전문가의 검증된 실적이 아니며, 협업 요청도 전송되지 않습니다.</p>
            </div>
          </div>
        )}
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0 rounded-[20px] border border-[#e4e8f2] bg-white p-5 shadow-[0_12px_38px_rgba(26,41,77,0.045)] sm:p-7 lg:p-8">
            {/* 머리 */}
            <header className="flex gap-4 lg:gap-[18px]">
              <span className="hidden lg:block">
                <Avatar src={photoOrDefault(profile.user_photo, "expert")} size={80} />
              </span>
              <span className="lg:hidden">
                <Avatar src={photoOrDefault(profile.user_photo, "expert")} size={64} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <h1 className="break-all text-[23px] font-bold leading-9 tracking-[-0.025em] text-ink lg:text-[27px]">{profile.nickname}</h1>
                  {profile.engaged && <EngagedBadge until={profile.engaged_until} />}
                  {hasNoCompletedHistory && (
                    <span className="inline-flex min-h-6 items-center rounded-full bg-[#f1f3fa] px-2.5 py-1 text-[11px] font-medium text-[#7a849c]">
                      완료 협업 이력 없음
                    </span>
                  )}
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={copyLink}
                      aria-live="polite"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e1e6f0] bg-white px-3 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      <LinkIcon /> {copied ? "링크 복사됨" : "링크 복사"}
                    </button>
                    <Link href="/faq#private-post" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e1e6f0] bg-white px-3 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-brand" title="신고 또는 문의는 비공개 문의를 통해 접수할 수 있어요">
                      신고·문의
                    </Link>
                  </div>
                </div>
                <p className="mt-0.5 hidden text-[13px] leading-5 text-[#6b7285] lg:block">{meta}</p>
              </div>
            </header>
            <div className="mt-6">
              <LabTrustIndicator
                variant="profile"
                snapshot={reviewApiError ? null : verifiedReviews?.reputation}
                demoPreview={demoReviews ? Math.round((demoReviews.average - 1) * 25) : null}
              />
            </div>
            <div className="lg:pl-[98px]">
              <p className="mt-3 text-[15px] leading-[23px] text-[#2a3350]">{profile.introduce}</p>
              <p className="mt-2 text-[13px] leading-5 text-[#8c94ab] lg:hidden">{meta}</p>
              <dl className="mt-4 grid gap-2.5">
                <ChipRow label="도메인" items={profile.domain_ids.map((id) => names.fields.get(id) ?? "")} tone="teal" />
                <ChipRow label="할 수 있는 일" items={profile.able_work_ids.map((id) => names.works.get(id) ?? "")} tone="brand" />
              </dl>
            </div>

            {/* 모바일: 전문가 협업 데이터는 공개 요약만 제공합니다. */}
            <div className="mt-5 grid gap-4 lg:hidden">
              <FieldSummary finished={finished} names={names} />
              <Conditions profile={profile} />
            </div>

            {/* 탭 */}
            <div role="tablist" aria-label="전문가 프로필 정보" className="mt-8 flex gap-5 overflow-x-auto border-b border-[#e6e9f1] lg:gap-7 lg:px-1">
              <TabButton active={currentTab === "work"} onClick={() => setTab("work")} panelId="expert-work-tab" tabId="expert-work-button">
                이 서비스에서 한 연구 · 평가 <span className="ml-1 text-xs text-[#8d9ab4]">{finished.length}</span>
              </TabButton>
              <TabButton active={currentTab === "portfolio"} onClick={() => setTab("portfolio")} panelId="expert-portfolio-tab" tabId="expert-portfolio-button">
                포트폴리오 <span className="ml-1 text-xs text-[#8d9ab4]">{profile.portfolios.length}</span>
              </TabButton>
              {hasHistory && (
                <TabButton active={currentTab === "history"} onClick={() => setTab("history")} panelId="expert-history-tab" tabId="expert-history-button">
                  경력 · 학력 · 자격증
                </TabButton>
              )}
            </div>

            <div id="expert-work-tab" role="tabpanel" aria-labelledby="expert-work-button" hidden={currentTab !== "work"} className="pt-6">
              {currentTab === "work" && <WorkTab collaborations={finished} names={names} demoReviews={demoReviews} verifiedReviews={verifiedReviews} reviewApiError={reviewApiError} />}
            </div>
            <div id="expert-portfolio-tab" role="tabpanel" aria-labelledby="expert-portfolio-button" hidden={currentTab !== "portfolio"} className="pt-6">
              {currentTab === "portfolio" && <PortfolioTab profile={profile} names={names} />}
            </div>
            {hasHistory && <div id="expert-history-tab" role="tabpanel" aria-labelledby="expert-history-button" hidden={currentTab !== "history"} className="pt-6">
              {currentTab === "history" && <HistoryTab profile={profile} />}
            </div>}
          </article>

          {/* 오른쪽 협업 카드 (데스크톱) */}
          <aside className="hidden rounded-[20px] border border-[#e3e8f2] bg-white p-[22px] shadow-[0_14px_35px_rgba(26,41,77,0.06)] lg:sticky lg:top-24 lg:block">
            <h2 className="text-[17px] font-bold leading-[25px] tracking-[-0.02em] text-ink">{profile.nickname} 님과 협업하기</h2>
            <div className="mt-4">
              <FieldSummary finished={finished} names={names} />
            </div>
            <dl className="mt-[18px] grid grid-cols-[80px_1fr] gap-y-2.5 text-[13px] leading-[19px]">
              <dt className="text-[#8c94ab]">참여 상태</dt>
              {profile.engaged ? (
                <dd className="text-[#b26a00]">참여 중{profile.engaged_until ? ` · ${monthDay(profile.engaged_until)} 종료 예정` : ""}</dd>
              ) : (
                <dd className="text-success">참여 중인 협업 없음</dd>
              )}
              <dt className="text-[#8c94ab]">새 협업 일정</dt>
              <dd className="text-ink">요청 시 협의</dd>
            </dl>
            <div className="mt-4">
              <Conditions profile={profile} />
            </div>
            <button
              type="button"
              onClick={openCollaboration}
              className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#4f42db] text-[15px] font-bold text-white shadow-[0_7px_18px_rgba(79,66,219,0.20)] transition-colors hover:bg-[#3d33b8]"
            >
              <SendIcon />
              협업 요청
            </button>
            <p className="mt-2.5 text-center text-xs leading-[18px] text-[#8c94ab]">
              요청하면 {profile.nickname} 님에게
              <br />
              디스코드 DM으로 알려 드려요
            </p>
          </aside>
        </div>
      </div>

      {/* 모바일: 아래 고정 줄 */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-[#ecebf4] bg-white px-4 py-4 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className={`text-[12px] leading-[19px] ${profile.engaged ? "text-[#b26a00]" : "text-success"}`}>{availabilityNote}</p>
          {rewards && <p className="truncate text-xs leading-[18px] text-[#8c94ab]">{rewards}</p>}
        </div>
        <button type="button" onClick={openCollaboration} className="h-12 w-[150px] shrink-0 rounded-xl bg-[#4b3fd6] text-[15px] text-white">
          협업 요청
        </button>
      </div>

      {demoRequestInfo && (
        <Modal
          title="시연용 협업 요청"
          description="LOCAL DEMO · 실제 요청은 전송되지 않습니다"
          onClose={() => setDemoRequestInfo(false)}
          footer={
            <button type="button" onClick={() => setDemoRequestInfo(false)} className="min-h-11 rounded-lg bg-brand px-6 text-sm font-semibold text-white">
              확인
            </button>
          }
        >
          <div className="rounded-xl border border-[#d8e1f7] bg-[#f4f7ff] p-4 text-[13px] leading-6 text-[#526487]">
            <p className="font-semibold text-ink">이 프로필은 화면 검수용 가상 전문가입니다.</p>
            <p className="mt-2">실제 Discord 계정이나 협업 대상자가 없기 때문에 서버로 요청을 보내지 않습니다. 실제 전문가에서는 기존 협업 요청 모달이 정상 동작합니다.</p>
          </div>
        </Modal>
      )}
      {requesting && !demoReviews && <CollabRequestDialog expert={{ user_id: profile.user_id, nickname: profile.nickname }} role={role} names={names} onClose={() => setRequesting(false)} />}
    </PageContainer>
  );
}

/* ---------- 탭 내용 ---------- */

function WorkTab({ collaborations, names, demoReviews, verifiedReviews, reviewApiError }: {
  collaborations: ExpertCollaboration[]; names: Names; demoReviews?: DemoReview | null;
  verifiedReviews?: PublicExpertRating | null; reviewApiError?: string;
}) {
  return (
    <div className="space-y-5">
      {reviewApiError && !demoReviews && <div role="alert" className="rounded-xl border border-[#f1d9c9] bg-[#fffbf4] px-4 py-3 text-[12px] leading-5 text-[#9b683f]">{reviewApiError}</div>}
      <ExpertReviewSummary completedCount={collaborations.length} demo={demoReviews} verified={verifiedReviews} />
      {collaborations.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#e5eaf3] bg-[#f8faff] px-5 py-5 text-[13px] leading-6 text-muted">
          <InfoIcon />
          <div>
            <p className="font-semibold text-ink">아직 완료된 협업 기록이 없어요</p>
            <p className="mt-1">포트폴리오 탭에서 전문가가 등록한 프로젝트 경험을 확인할 수 있습니다.</p>
          </div>
        </div>
      ) : (
        <section aria-labelledby="completed-expert-projects">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="completed-expert-projects" className="text-base font-bold text-ink">완료한 협업 {collaborations.length}건</h2>
            <span className="text-[11px] text-faint">{demoReviews ? "시연용 가상 이력" : "완료된 협업 최근 최대 50건"}</span>
          </div>
          <ul className="mt-2 divide-y divide-[#edf0f5]">
            {collaborations.map((item, index) => (
              <li key={index} className="grid gap-y-2 py-5 first:pt-3 sm:grid-cols-[118px_minmax(0,1fr)] sm:gap-4">
                <p className="pt-0.5 text-[12px] leading-6 text-faint">{periodLabel(item)}</p>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-bold leading-6 text-ink">완료한 협업 연구</h3>
                    <span className="rounded-md bg-[#eaf6f1] px-2 py-1 text-[10px] font-semibold text-[#238464]">완료</span>
                    {item.category_ids.map((id) => (
                      <span key={id} className="rounded-md bg-[#eaf6f8] px-2 py-1 text-[10px] text-[#167d8c]">
                        {names.categories.get(id) ?? "기타 분야"}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-5 text-faint">
                    {demoReviews ? "LOCAL DEMO · 협업 이력·분야·기간 모두 가상의 시연 데이터입니다." : "연구 제목과 참여자 정보는 당사자 보호를 위해 공개되지 않습니다."}
                  </p>
                  {item.able_work_ids.length > 0 && (
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[68px_minmax(0,1fr)]">
                      <dt className="pt-1 text-faint">AI로 한 일</dt>
                      <dd><Chips items={item.able_work_ids.map((id) => names.works.get(id) ?? "")} tone="brand" /></dd>
                    </dl>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PortfolioTab({ profile, names }: { profile: ExpertPublicProfile; names: Names }) {
  return (
    <section aria-labelledby="expert-portfolios">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="expert-portfolios" className="text-[17px] font-bold text-ink">포트폴리오 {profile.portfolios.length}건</h2>
        <span className="text-xs text-faint">전문가 등록 정보 또는 LOCAL DEMO 시연 데이터</span>
      </div>
      {profile.portfolios.length === 0 ? (
        <p className="mt-4 rounded-xl bg-page p-5 text-sm text-muted">아직 등록된 포트폴리오가 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#edf0f5]">
          {profile.portfolios.map((item, index) => (
            <li key={item.portfolio_id} className="grid gap-y-2 py-5 first:pt-2 sm:grid-cols-[118px_minmax(0,1fr)] sm:gap-4">
              <p className="pt-0.5 text-xs leading-6 text-faint">프로젝트 {index + 1}</p>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-[15px] font-bold leading-6 text-ink">{item.title}</h3>
                  {item.has_pdf && (
                    <span title="PDF는 현재 소유자만 열람할 수 있습니다." className="inline-flex items-center gap-1 rounded-md bg-page px-2 py-1 text-[11px] text-muted">
                      <FileIcon /> PDF 보유 · 비공개
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid gap-x-3 gap-y-2.5 text-[13px] leading-5 sm:grid-cols-[70px_minmax(0,1fr)]">
                  <dt className="text-faint">AI로 한 일</dt>
                  <dd><Chips items={item.able_work_ids.map((id) => names.works.get(id) ?? "")} tone="brand" /></dd>
                  {item.skills.length > 0 && (
                    <>
                      <dt className="text-faint">사용 기술</dt>
                      <dd className="break-words text-ink">{item.skills.join(" · ")}</dd>
                    </>
                  )}
                  <dt className="text-faint">담당 역할</dt>
                  <dd className="break-words text-ink">{item.role}</dd>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11px] leading-5 text-faint">포트폴리오는 전문가의 직접 등록 정보이며, LOCAL DEMO에서는 가상 포트폴리오도 포함됩니다. 완료 협업 이력이나 검증된 평가와 구분해 확인하세요.</p>
    </section>
  );
}

function HistoryTab({ profile }: { profile: ExpertPublicProfile }) {
  const groups = [
    {
      label: "경력",
      rows: profile.careers.map((item) => ({
        key: item.career_id,
        when: `${formatMonth(item.start_month)} ~ ${item.end_month ? formatMonth(item.end_month) : "재직 중"}`,
        what: [item.company, item.job].filter(Boolean).join(" · "),
      })),
    },
    {
      label: "학력",
      rows: profile.educations.map((item) => ({ key: item.education_id, when: item.graduated_year ? `${item.graduated_year} 졸업` : "", what: `${item.school} · ${item.major}` })),
    },
    {
      label: "자격증",
      rows: profile.certificates.map((item) => ({ key: item.certificate_id, when: item.acquired_year ? `${item.acquired_year} 취득` : "", what: [item.name, item.issuer].filter(Boolean).join(" · ") })),
    },
  ].filter((group) => group.rows.length > 0); // 적은 것만 보여요

  return (
    <div className="lg:pt-3">
      {groups.map((group) => (
        <section key={group.label} className="grid gap-y-1 border-b border-[#eeeff4] py-5 first:pt-0 last:border-b-0 lg:grid-cols-[140px_1fr]">
          <h3 className="text-sm leading-6 text-[#3a4256]">{group.label}</h3>
          <dl className="grid gap-y-2.5">
            {group.rows.map((row) => (
              <div key={row.key} className="grid gap-x-4 sm:grid-cols-[150px_1fr]">
                <dt className="text-[13px] leading-6 text-[#8c94ab]">{row.when || "-"}</dt>
                <dd className="text-[15px] leading-6 text-ink">{row.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/* ---------- 오른쪽 카드 조각 ---------- */

/** 마친 연구 분야 도넛 + 함께한 연구에서 한 일 */
function FieldSummary({ finished, names }: { finished: ExpertCollaboration[]; names: Names }) {
  if (finished.length === 0) {
    return (
      <div className="flex gap-2.5 rounded-xl bg-[#f5f7fc] p-4 text-xs leading-[18px] text-[#6b7285]">
        <InfoIcon />
        <p>
          완료된 협업 분야 정보가 없어요
          <br />
          협업을 마치면 이곳에 기록됩니다.
        </p>
      </div>
    );
  }
  const counts = countByCategory(finished);
  const works = [...new Set(finished.flatMap((item) => item.able_work_ids))].map((id) => names.works.get(id)).filter(Boolean);
  return (
    <div className="rounded-xl bg-[#f5f7fc] p-4">
      <p className="mb-3 text-[11px] font-semibold text-[#7483a2]">최근 완료한 연구 분야 · 최대 50건 기준</p>
      <div className="flex items-center gap-5">
        <Donut total={finished.length} counts={counts.map((item) => item.count)} />
        <ul className="grid flex-1 gap-2 text-xs leading-[18px]">
          {counts.map((item, index) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <i className="size-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
              <span className="flex-1 text-[#3a4256]">{names.categories.get(item.id)}</span>
              <span className="text-ink">{item.count}건</span>
            </li>
          ))}
        </ul>
      </div>
      {works.length > 0 && (
        <div className="mt-4 border-t border-[#e3e7f1] pt-2.5">
          <p className="text-[11px] leading-4 text-[#8c94ab]">함께한 연구에서 한 일</p>
          <p className="mt-1 text-xs leading-[18px] text-[#3a4256]">{works.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

/** 도넛: 분야별 건수 비율. 가운데에 마친 연구 수. 한 연구가 분야 여러 개면 분야마다 셉니다. */
function Donut({ total, counts }: { total: number; counts: number[] }) {
  const radius = 44;
  const length = 2 * Math.PI * radius;
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  return (
    <div role="img" aria-label={`완료 협업 ${total}건의 연구 분야별 구성`} className="relative size-[104px] shrink-0">
      <svg viewBox="0 0 104 104" className="size-full -rotate-90">
        {counts.map((count, index) => {
          const part = (count / sum) * length;
          const circle = (
            <circle key={index} cx="52" cy="52" r={radius} fill="none" stroke={DONUT_COLORS[index % DONUT_COLORS.length]} strokeWidth="16" strokeDasharray={`${part} ${length - part}`} strokeDashoffset={-offset} />
          );
          offset += part;
          return circle;
        })}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-ink">{total}건</span>
    </div>
  );
}

function Conditions({ profile }: { profile: ExpertPublicProfile }) {
  const condition = profile.collaboration;
  return (
    <div className="rounded-xl border border-[#e6e1ff] bg-[#f8f7ff] px-[17px] py-[15px] text-[13px] leading-[19px]">
      <p className="text-[#3d33b8]">협업 조건</p>
      {condition ? (
        <dl className="mt-2.5 grid grid-cols-[114px_1fr] gap-y-[9px]">
          <dt className="text-[#8c94ab]">미팅</dt>
          <dd className="text-ink">
            {MEETING_LABELS[condition.meeting_type]}
            {condition.face_to_area ? ` · ${condition.face_to_area}` : ""}
          </dd>
          <dt className="text-[#8c94ab]">주당 시간</dt>
          <dd className="text-ink">{TIME_LABELS[condition.available_time]}</dd>
          <dt className="text-[#8c94ab]">희망 보상</dt>
          <dd className="text-ink">{condition.rewards.map((code) => REWARD_LABELS[code]).join(", ")}</dd>
        </dl>
      ) : (
        <p className="mt-2 text-[#8c94ab]">아직 적지 않았어요</p>
      )}
    </div>
  );
}

/* ---------- 작은 조각 ---------- */

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] leading-5 text-[#5e6678] hover:text-ink">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      AI 전문가 찾기로 돌아가기
    </Link>
  );
}

function EngagedBadge({ until }: { until: string | null }) {
  return (
    <span className="inline-flex h-6 items-center gap-[5px] rounded-[7px] bg-[#fff4e0] pr-[9px] pl-2 text-xs text-[#b26a00]">
      <i className="size-1.5 rounded-full bg-[#e08a2e]" />
      참여 중{until ? ` · ${monthDay(until)} 종료 예정` : ""}
    </span>
  );
}

function TabButton({ active, onClick, children, panelId, tabId }: { active: boolean; onClick: () => void; children: ReactNode; panelId: string; tabId: string }) {
  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-controls={panelId}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
        if (!tabs.length) return;
        const index = tabs.indexOf(event.currentTarget);
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        tabs[next]?.focus();
        tabs[next]?.click();
      }}
      className={`-mb-px shrink-0 border-b-2 px-1 pb-3 text-[13px] leading-5 transition-colors lg:text-[14px] lg:leading-[22px] ${active ? "border-[#4b3fd6] font-bold text-[#3d33b8]" : "border-transparent font-medium text-[#8c94ab] hover:text-[#5e6678]"}`}
    >
      {children}
    </button>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "brand" | "teal" }) {
  const shown = items.filter(Boolean);
  const color = tone === "brand" ? "bg-[#eeebff] text-[#4b3fd6]" : "bg-[#e3f4f6] text-[#0f7c8c]";
  return (
    <ul className="flex flex-wrap gap-[5px]">
      {shown.map((name) => (
        <li key={name} className={`rounded-[5px] px-2 py-[3px] text-xs leading-[18px] ${color}`}>
          {name}
        </li>
      ))}
    </ul>
  );
}

function ChipRow({ label, items, tone }: { label: string; items: string[]; tone: "brand" | "teal" }) {
  return (
    <div className="grid gap-2 lg:grid-cols-[88px_1fr] lg:items-start">
      <dt className="text-xs leading-6 text-[#8c94ab]">{label}</dt>
      <dd>
        <Chips items={items} tone={tone} />
      </dd>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8 2.5l-.6.6M8 6a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 6 11.5l.6-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M14 2 7 9M14 2l-4.5 12L7 9 2 6.5 14 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-[#8c94ab]" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M8 1.5H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

