"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Chip, INPUT_CLASS } from "@/components/modal";
import { MySpaceShell } from "@/components/my-space-shell";
import { SettingsInstitutionModal } from "@/components/settings-institution-modal";
import { SettingsPhotoModal } from "@/components/settings-photo-modal";
import { API_BASE_URL, ApiError, requestApi } from "@/lib/api";
import { photoOrDefault } from "@/lib/collab-requests";
import { CAREER_LABELS, JOB_LABELS } from "@/lib/my-career";
import {
  AFFILIATION_LIMIT,
  announceMeChanged,
  DEPARTMENT_LIMIT,
  dotDate,
  POSITION_OPTIONS,
  type ExpertBasic,
  type NotificationSetting,
  type ResearcherInfo,
  type SettingsMe,
} from "@/lib/profile-settings";

const toMessage = (caught: unknown) => (caught instanceof ApiError ? caught.message : "잠시 후 다시 시도해 주세요");

/** /settings/profile: 기본 정보 · 소속 인증 정보(연구회원) / 가입 정보(AI 전문가) · 알림 */
export function ProfileSettingsPage() {
  const [me, setMe] = useState<SettingsMe | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestApi<SettingsMe>("/auth/me")
      .then(setMe)
      .catch((caught) => setError(toMessage(caught)));
  }, []);

  if (error) return <Notice text={error} href="/login" action="로그인하러 가기" />;
  if (!me) return <p className="py-20 text-center text-sm text-faint">불러오는 중…</p>;
  if (!me.user_role || me.signup_step !== "done") return <Notice text="가입을 먼저 마쳐 주세요" href="/signup" action="가입 이어서 하기" />;

  const isResearcher = me.user_role === "researcher";
  return (
    <MySpaceShell role={me.user_role}>
      <h1 className="text-2xl font-bold">프로필 설정</h1>
      <p className="mt-1.5 text-sm text-muted">협업 상대에게 보이는 정보와 알림 받는 방법을 정해요.</p>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="설정 바로 가기">
        {[
          ["#basic", "기본 정보"],
          ["#cert", isResearcher ? "소속 인증 정보" : "가입 정보"],
          ["#noti", "알림"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-line bg-card px-3 py-1.5 text-[13px] text-muted hover:border-brand hover:text-brand">
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-2 grid max-w-[760px] gap-[18px]">
        <BasicSection me={me} onPhoto={(user_photo) => setMe({ ...me, user_photo })} />
        {isResearcher ? <ResearcherSection /> : <ExpertSection />}
        <NotificationSection />
      </div>
    </MySpaceShell>
  );
}

/* ---------- ① 기본 정보 ---------- */

function BasicSection({ me, onPhoto }: { me: SettingsMe; onPhoto: (photo: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const role = me.user_role === "expert" ? "expert" : "researcher";

  // [기본 이미지로]: 올린 사진을 지우고 기본 이미지로 돌아가요.
  async function resetPhoto() {
    setResetting(true);
    setResetError("");
    try {
      await requestApi("/me/photo", { method: "DELETE" });
      onPhoto(null);
      announceMeChanged(); // 헤더 사진도 바로 바뀌게
    } catch (caught) {
      setResetError(toMessage(caught));
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card id="basic" title="기본 정보" description="협업 상대에게 보이는 이름과 사진이에요.">
      <Row label="프로필 사진">
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 업로드한 사진(백엔드 주소) 또는 기본 사진 */}
          <img
            src={photoOrDefault(me.user_photo, role)}
            alt=""
            width={88}
            height={88}
            className="h-[88px] w-[88px] shrink-0 rounded-full border border-line bg-page object-cover"
          />
          <div>
            <p className="text-[13px] leading-5 text-faint">
              {me.user_photo ? "협업 상대에게 보이는 사진이에요" : "기본 이미지를 쓰고 있어요"}
              <br />
              JPG·PNG·WEBP, 5MB 이하 · 정사각형으로 맞춰 저장돼요
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="h-10 rounded-button border border-line px-3.5 text-[13px] font-semibold hover:bg-page">
                사진 바꾸기
              </button>
              {me.user_photo && (
                <button type="button" onClick={resetPhoto} disabled={resetting} className="h-10 rounded-button px-3 text-[13px] font-semibold text-muted hover:bg-page disabled:opacity-50">
                  기본 이미지로
                </button>
              )}
            </div>
            {resetError && <p className="mt-1.5 text-[13px] text-danger">{resetError}</p>}
          </div>
        </div>
      </Row>
      <Row label="닉네임">
        <span className="font-bold">{me.nickname}</span>
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-faint">
          <LockIcon />
          디스코드 계정 이름 · 바꿀 수 없어요
        </span>
      </Row>
      {editing && <SettingsPhotoModal current={me.user_photo} role={role} onClose={() => setEditing(false)} onSaved={onPhoto} />}
    </Card>
  );
}

/* ---------- ② 소속 인증 정보 (연구회원) ---------- */

function ResearcherSection() {
  const [info, setInfo] = useState<ResearcherInfo | null>(null);
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const save = useSave();

  useEffect(() => {
    requestApi<ResearcherInfo>("/researcher/profile")
      .then((data) => {
        setInfo(data);
        setDepartment(data.department ?? "");
        setPosition(data.position);
      })
      .catch((caught) => save.setMessage(toMessage(caught)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 불러와요
  }, []);

  const changed = info !== null && ((info.department ?? "") !== department.trim() || info.position !== position);

  return (
    <Card id="cert" title="소속 인증 정보" description="학교·연구기관 이메일로 인증한 소속이에요. 이메일 주소는 저장하지 않아요.">
      <Row label="소속 기관">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-bold">{info?.institution_name ?? "-"}</span>
          {info?.is_verified && (
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-bold text-success">✓ 인증됨{info.verified_at ? ` · ${dotDate(info.verified_at)}` : ""}</span>
          )}
          <button type="button" onClick={() => setChanging(true)} className="ml-auto h-10 rounded-button border border-line px-3.5 text-[13px] font-semibold hover:bg-page">
            기관 바꾸기
          </button>
        </div>
      </Row>
      <Row label="학과·부서" optional>
        <input value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={DEPARTMENT_LIMIT} placeholder="예: 생명과학부" className={`${INPUT_CLASS} max-w-[420px]`} />
      </Row>
      <Row label="직위" optional top>
        <div className="flex flex-wrap gap-2">
          {POSITION_OPTIONS.map((item) => (
            <Chip key={item.value} selected={position === item.value} onClick={() => setPosition(position === item.value ? null : item.value)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </Row>
      <SaveBar
        state={save}
        disabled={!changed}
        onSave={() =>
          save.run(async () => {
            const data = await requestApi<ResearcherInfo>("/researcher/profile", { method: "PUT", body: JSON.stringify({ department: department.trim() || null, position }) });
            setInfo(data);
          })
        }
      />
      {changing && info && (
        <SettingsInstitutionModal
          currentInstitution={info.institution_name ?? ""}
          onClose={() => setChanging(false)}
          onChanged={() => requestApi<ResearcherInfo>("/researcher/profile").then(setInfo)}
        />
      )}
    </Card>
  );
}

/* ---------- ② 가입 정보 (AI 전문가) ---------- */

function ExpertSection() {
  const [saved, setSaved] = useState<ExpertBasic | null>(null);
  const [form, setForm] = useState<ExpertBasic>({ current_job: "", ai_career: "", affiliation: "" });
  const save = useSave();

  useEffect(() => {
    requestApi<ExpertBasic>("/expert/basic")
      .then((data) => {
        setSaved(data);
        setForm({ ...data, affiliation: data.affiliation ?? "" });
      })
      .catch((caught) => save.setMessage(toMessage(caught)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 불러와요
  }, []);

  const changed =
    saved !== null && (saved.current_job !== form.current_job || saved.ai_career !== form.ai_career || (saved.affiliation ?? "") !== (form.affiliation ?? "").trim());

  return (
    <Card id="cert" title="가입 정보" description="전문가 찾기 카드와 상세 화면에 보여요.">
      <Row label="지금 하는 일" top>
        <div className="flex flex-wrap gap-2">
          {Object.entries(JOB_LABELS).map(([code, label]) => (
            <Chip key={code} selected={form.current_job === code} onClick={() => setForm({ ...form, current_job: code })}>
              {label}
            </Chip>
          ))}
        </div>
      </Row>
      <Row label="AI 관련 경력" top>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CAREER_LABELS).map(([code, label]) => (
            <Chip key={code} selected={form.ai_career === code} onClick={() => setForm({ ...form, ai_career: code })}>
              {label}
            </Chip>
          ))}
        </div>
      </Row>
      <Row label="소속" optional>
        <input
          value={form.affiliation ?? ""}
          onChange={(event) => setForm({ ...form, affiliation: event.target.value })}
          maxLength={AFFILIATION_LIMIT}
          placeholder="예: OO헬스케어"
          className={`${INPUT_CLASS} max-w-[420px]`}
        />
      </Row>
      <SaveBar
        state={save}
        disabled={!changed}
        onSave={() =>
          save.run(async () => {
            const data = await requestApi<ExpertBasic>("/expert/basic", { method: "PUT", body: JSON.stringify({ ...form, affiliation: (form.affiliation ?? "").trim() || null }) });
            setSaved(data);
          })
        }
      />
    </Card>
  );
}

/* ---------- ③ 알림 ---------- */

function NotificationSection() {
  const [setting, setSetting] = useState<NotificationSetting | null>(null);
  const [message, setMessage] = useState(""); // 저장·테스트 결과 문구
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestApi<NotificationSetting>("/notifications/settings")
      .then(setSetting)
      .catch((caught) => setMessage(toMessage(caught)));
    // [디스코드 알림 연결]을 마치고 돌아오면 주소 끝에 ?discord=connected|failed 가 붙어 와요.
    const result = new URLSearchParams(window.location.search).get("discord");
    if (result) setMessage(result === "connected" ? "디스코드 알림을 연결했어요" : "디스코드 서버에 참가하지 못했어요. 승인 화면에서 서버 참가를 허용해 주세요");
  }, []);

  if (!setting) return <Card id="noti" title="알림">{message ? <p className="text-sm text-danger">{message}</p> : <p className="text-sm text-faint">불러오는 중…</p>}</Card>;

  // 스위치는 누르는 즉시 저장해요.
  async function toggle(key: "discord_dm" | "notify_request" | "notify_workspace") {
    if (!setting) return;
    const next = { ...setting, [key]: !setting[key] };
    setSetting(next);
    try {
      setSetting(
        await requestApi<NotificationSetting>("/notifications/settings", {
          method: "PUT",
          body: JSON.stringify({ discord_dm: next.discord_dm, notify_request: next.notify_request, notify_workspace: next.notify_workspace }),
        }),
      );
    } catch (caught) {
      setSetting(setting); // 저장에 실패하면 원래대로
      setMessage(toMessage(caught));
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      setSetting(await requestApi<NotificationSetting>("/notifications/settings/test", { method: "POST" }));
      setMessage("테스트 DM을 보냈어요. 디스코드를 확인해 보세요");
    } catch (caught) {
      setMessage(toMessage(caught));
      requestApi<NotificationSetting>("/notifications/settings").then(setSetting).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const connectHref = `${API_BASE_URL}/auth/discord/connect`;
  const badge = {
    connected: <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-bold text-success">디스코드 연결됨</span>,
    not_connected: <span className="rounded-full bg-page px-2.5 py-0.5 text-[11px] font-bold text-muted">디스코드 연결 안 됨</span>,
    blocked: <span className="rounded-full bg-trend-soft px-2.5 py-0.5 text-[11px] font-bold text-trend">DM이 막혀 있어요</span>,
  }[setting.status];

  return (
    <Card id="noti" title="알림" badge={badge} description="사이트 위쪽 종 알림은 설정과 상관없이 항상 와요.">
      {!setting.available ? (
        <p className="mt-3.5 border-t border-line pt-4 text-sm text-muted">지금은 디스코드 알림을 쓸 수 없어요. 사이트 위쪽 종으로 알림을 확인해 주세요.</p>
      ) : setting.status === "not_connected" ? (
        <div className="mt-3.5 flex flex-col items-start gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">디스코드 DM으로 알림 받기</p>
            <p className="mt-0.5 text-[13px] leading-5 text-faint">
              LabBridge 디스코드 서버에 참가하면 봇이 DM으로 알려 드려요.
              <br />
              디스코드 승인 화면에서 &quot;서버 참가&quot;를 허용해 주세요.
            </p>
          </div>
          <a href={connectHref} className="inline-flex h-10 items-center gap-2 rounded-button bg-[#5865f2] px-4 text-[13px] font-semibold text-white">
            <DiscordIcon />
            디스코드 알림 연결
          </a>
        </div>
      ) : (
        <>
          <div className="mt-3.5 flex items-center gap-4 border-t border-line pt-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">디스코드 DM으로 받기</p>
              <p className="mt-0.5 text-[13px] text-faint">LabBridge 봇이 1:1 DM으로 보내요</p>
            </div>
            <Switch on={setting.discord_dm} label="디스코드 DM으로 받기" onClick={() => toggle("discord_dm")} />
          </div>
          <div className={`mt-2 grid gap-1 ${setting.discord_dm ? "" : "pointer-events-none opacity-40"}`}>
            <ToggleRow label="협업 요청" hint="요청 도착 · 수락 · 거절 · 취소 · 만료" on={setting.notify_request} onClick={() => toggle("notify_request")} />
            <ToggleRow label="협업공간" hint="협업 시작 · 일정 · 종료 · 평가 (준비 중)" on={setting.notify_workspace} onClick={() => toggle("notify_workspace")} />
          </div>
          {setting.status === "blocked" && (
            <p className="mt-3 rounded-button border border-[#ffd9cb] bg-[#fff6f2] px-3.5 py-3 text-[13px] leading-6 text-[#8a3a1f]">
              마지막 DM을 보내지 못했어요. 디스코드에서 LabBridge 서버 이름을 오른쪽 클릭 → <b>개인정보 보호 설정</b> → <b>다이렉트 메시지 허용</b>을 켠 뒤 다시 보내 보세요. 서버를 나갔다면 다시 연결해 주세요.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <span className="mr-auto text-[13px] text-faint">DM이 안 오면 테스트로 확인해 보세요</span>
            {setting.status === "blocked" && (
              <a href={connectHref} className="inline-flex h-10 items-center rounded-button border border-line px-3.5 text-[13px] font-semibold hover:bg-page">
                다시 연결
              </a>
            )}
            <button type="button" onClick={sendTest} disabled={busy} className="h-10 rounded-button border border-line px-3.5 text-[13px] font-semibold hover:bg-page disabled:opacity-50">
              {busy ? "보내는 중…" : "테스트 DM 보내기"}
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="mt-3 text-[13px] font-semibold text-brand">
          {message}
        </p>
      )}
    </Card>
  );
}

/* ---------- 공통 조각 ---------- */

/** 저장 버튼 상태: run(저장함수)을 부르면 저장 중·완료·실패 문구를 관리해요. */
function useSave() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function run(task: () => Promise<void>) {
    setSaving(true);
    setMessage("");
    try {
      await task();
      setFailed(false);
      setMessage("저장했어요");
    } catch (caught) {
      setFailed(true);
      setMessage(toMessage(caught));
    } finally {
      setSaving(false);
    }
  }
  return { saving, message, failed, run, setMessage };
}

function SaveBar({ state, disabled, onSave }: { state: ReturnType<typeof useSave>; disabled: boolean; onSave: () => void }) {
  return (
    <div className="mt-1.5 flex items-center justify-end gap-3 border-t border-line pt-4">
      {state.message && <p className={`mr-auto text-[13px] font-semibold ${state.failed ? "text-danger" : "text-success"}`}>{state.message}</p>}
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || state.saving}
        className="h-10 rounded-button bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:bg-line disabled:text-faint"
      >
        {state.saving ? "저장하는 중…" : "저장하기"}
      </button>
    </div>
  );
}

function Card({ id, title, badge, description, children }: { id: string; title: string; badge?: ReactNode; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card border border-line bg-card px-5 py-5 sm:px-6">
      <h2 className="flex flex-wrap items-center gap-2 text-base font-bold">
        {title}
        {badge}
      </h2>
      {description && <p className="mt-1 text-[13px] text-faint">{description}</p>}
      {children}
    </section>
  );
}

function Row({ label, optional, top, children }: { label: string; optional?: boolean; top?: boolean; children: ReactNode }) {
  return (
    <div className={`mt-3.5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:gap-4 ${top ? "sm:items-start" : "sm:items-center"}`}>
      <p className={`w-32 shrink-0 text-sm font-semibold ${top ? "sm:pt-2" : ""}`}>
        {label}
        {optional && <span className="ml-1 font-normal text-faint">(선택)</span>}
      </p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative h-[26px] w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-[#d6dae6]"}`}>
      <span className={`absolute top-[3px] size-5 rounded-full bg-white transition-all ${on ? "left-[21px]" : "left-[3px]"}`} />
    </button>
  );
}

function ToggleRow({ label, hint, on, onClick }: { label: string; hint: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-sm">{label}</span>
      <span className="text-xs text-faint">{hint}</span>
      <span className="ml-auto">
        <Switch on={on} label={label} onClick={onClick} />
      </span>
    </div>
  );
}

function Notice({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-muted">{text}</p>
      <Link href={href} className="mt-4 inline-flex h-10 items-center rounded-button bg-brand px-4 text-sm font-semibold text-white">
        {action}
      </Link>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.5.3 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.9 19.9 0 0 0 6-3c.4-5.2-.7-9.7-3.6-13.6ZM8.7 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}