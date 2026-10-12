import type { Metadata } from "next";

export const metadata: Metadata = { title: "로그인" };


// 백엔드의 디스코드 로그인 시작 주소. 서버가 회원이면 홈(/), 아니면 /signup으로 보내 줍니다.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const DISCORD_LOGIN_URL = `${API_BASE_URL}/auth/discord/login`;

// "왜 디스코드인가요?" 안내 문구. 문구만 바꿀 때 이 목록만 고치면 됩니다.
const WHY_DISCORD = [
  { title: "협업 알림을 DM으로 바로 받아요", body: "요청 도착, 수락, 일정 알림을 놓치지 않아요" },
  { title: "비밀번호를 따로 만들지 않아도 돼요" },
  { title: "개인정보는 꼭 필요한 것만 받아요" },
];

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  // 주소에 ?error=... 가 있으면 실패 화면(02)으로 보여 줍니다.
  const { error } = await searchParams;
  const hasError = Boolean(error);

  return (
    <section className="mx-auto max-w-md px-4 py-20 md:px-6">
      <div className="rounded-card border border-line bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">
          로그인하고 연구 협업을
          <br />
          시작해 보세요
        </h1>
        <p className="mt-2 text-sm text-muted">AI 전문가와 연구팀을 잇는 협업 공간</p>

        {hasError && (
          <div role="alert" className="mt-6 rounded-button bg-danger-soft px-4 py-3 text-sm text-danger">
            디스코드 승인이 완료되지 않았어요.
            <br />
            다시 로그인해 주세요.
          </div>
        )}

        <a
          href={DISCORD_LOGIN_URL}
          className="mt-6 flex h-12 items-center justify-center rounded-button bg-brand text-sm font-semibold text-white hover:bg-brand-hover"
        >
          {hasError ? "디스코드로 다시 로그인" : "디스코드로 로그인"}
        </a>

        <div className="mt-4 text-center">
          <p className="text-sm font-semibold">회원이 아니신가요? 3초면 가입 끝!</p>
          <p className="mt-1 text-xs text-muted">같은 버튼으로 승인만 하면 바로 가입돼요</p>
        </div>

        {!hasError && (
          <div className="mt-8 rounded-button bg-page p-5">
            <p className="text-sm font-semibold">왜 디스코드인가요?</p>
            <ul className="mt-3 space-y-3">
              {WHY_DISCORD.map((item) => (
                <li key={item.title} className="text-sm">
                  <p>{item.title}</p>
                  {item.body && <p className="mt-0.5 text-xs text-muted">{item.body}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-faint">
          {hasError
            ? "문제가 계속되면 디스코드 앱에서 로그인 상태를 확인해 주세요"
            : "디스코드 계정이 없다면 디스코드에서 먼저 만들어 주세요"}
        </p>
      </div>
    </section>
  );
}