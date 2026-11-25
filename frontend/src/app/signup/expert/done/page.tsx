import type { Metadata } from "next";
import Link from "next/link";

import { ExpertWelcomeTitle } from "@/components/expert-welcome-title";

export const metadata: Metadata = { title: "가입 완료" };

// 프로필 공개까지 남은 일. 항목을 바꿀 때 여기만 고치면 됩니다.
const REMAINING_TASKS = [
  { title: "한 줄 소개", body: "어떤 일을 주로 하는지 한 문장으로", time: "30초" },
  { title: "협업 조건", body: "시작 시점, 미팅 방식, 시간", time: "1분" },
  { title: "포트폴리오 1개", body: "무엇을, 어떤 역할로, 언제 만들었는지", time: "3분" },
];

export default function ExpertSignupDonePage() {
  // TODO: 로그인 기능이 생기면 실제 디스코드 활동명으로 바꿉니다.
  const nickname = "neural_kim";

  return (
    <section className="mx-auto max-w-xl px-4 py-16 md:px-6">
      <div className="rounded-card border border-line bg-card p-8 shadow-card">
        <ExpertWelcomeTitle />
        <p className="mt-2 text-sm text-muted">아래 세 가지를 채우면 AI 전문가 찾기 목록에 보여요</p>

        <ol className="mt-6 divide-y divide-line rounded-button border border-line">
          {REMAINING_TASKS.map((task, index) => (
            <li key={task.title} className="flex items-center gap-4 px-4 py-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="mt-0.5 text-xs text-muted">{task.body}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-faint">{task.time}</span>
            </li>
          ))}
        </ol>

        {/* TODO: 디스코드 DM 전송 기능이 생기면, 실패했을 때는 DM 허용 안내를 보여 줍니다. */}
        <p className="mt-6 rounded-button bg-page px-4 py-3 text-xs text-muted">
          디스코드 DM으로 환영 메시지를 보냈어요. 협업 요청도 DM으로 알려 드려요.
        </p>

        <Link
          href="/my/profile"
          className="mt-6 flex h-12 items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover"
        >
          프로필 채우고 공개하기
        </Link>
        <Link href="/" className="mt-3 flex h-11 items-center justify-center text-sm text-muted hover:text-ink">
          나중에 할게요
        </Link>
      </div>
    </section>
  );
}