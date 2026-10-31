import type { ReactNode } from "react";

/**
 * Dark Premium Match / adopted B reference.
 * The search action is inside the dark hero; filters and results follow on white.
 * The flask is decorative: it is NOT a fabricated expert trust level.
 */
export function ExpertSearchHero({ children }: { children: ReactNode }) {
  return (
    <header className="relative isolate overflow-hidden rounded-t-[22px] bg-navy px-5 pb-7 pt-9 text-white sm:px-9 sm:pt-12 lg:px-12 lg:pt-13">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_89%_36%,rgba(116,83,239,0.34),transparent_39%),linear-gradient(115deg,#0b1538_0%,#11183b_46%,#29205d_100%)]" />
      <svg aria-hidden="true" viewBox="0 0 960 470" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute -right-16 -top-10 h-[390px] w-[70%] opacity-30 sm:right-0">
        <defs>
          <linearGradient id="bWave" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#3f3a9d" stopOpacity="0"/>
            <stop offset=".65" stopColor="#9c64fb" stopOpacity=".9"/>
            <stop offset="1" stopColor="#b7a6ff" stopOpacity=".2"/>
          </linearGradient>
        </defs>
        {Array.from({ length: 17 }, (_, i) => (
          <path key={i} d={"M 110 " + (280 + i * 4) + " C 410 " + (120 + i * 3) + ", 500 " + (420 - i * 6) + ", 930 " + (85 + i * 7)} stroke="url(#bWave)" strokeWidth="1" fill="none" />
        ))}
      </svg>

      <div className="relative z-10 flex min-h-[216px] flex-col justify-center sm:min-h-[226px] lg:min-h-[235px]">
        <div className="max-w-[570px]">
          <p className="text-[12px] font-semibold tracking-[0.05em] text-[#d1cbfa] sm:text-sm">연구와 AI를 연결하는 전문가 네트워크</p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.18] tracking-[-0.035em] sm:text-[43px] lg:text-[47px]">AI 전문가 매칭</h1>
          <p className="mt-4 max-w-[390px] text-sm leading-7 text-[#d6dcf3] sm:text-[15px]">
            필요한 AI 역량을 가진 전문가를<br className="hidden sm:block" /> 빠르고 정확하게 찾아보세요.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute right-0 top-6 z-0 hidden w-[295px] lg:right-9 lg:top-5 lg:block lg:w-[350px] xl:right-20 xl:w-[370px]" aria-hidden="true">
        <svg viewBox="0 0 400 310" className="h-auto w-full" fill="none">
          <defs>
            <linearGradient id="expertHeroGlass" x1="130" y1="35" x2="295" y2="285" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FAF8FF" stopOpacity=".65"/>
              <stop offset=".35" stopColor="#ABADFF" stopOpacity=".22"/>
              <stop offset="1" stopColor="#7974FF" stopOpacity=".12"/>
            </linearGradient>
            <linearGradient id="expertHeroWater" x1="160" y1="205" x2="270" y2="280" gradientUnits="userSpaceOnUse">
              <stop stopColor="#89E8FF" stopOpacity=".96"/>
              <stop offset=".56" stopColor="#5468F5" stopOpacity=".95"/>
              <stop offset="1" stopColor="#9262F0"/>
            </linearGradient>
            <linearGradient id="expertHeroRim" x1="120" y1="48" x2="293" y2="265" gradientUnits="userSpaceOnUse">
              <stop stopColor="#E8E9FF"/>
              <stop offset=".46" stopColor="#7F95FF"/>
              <stop offset="1" stopColor="#D9B2FF"/>
            </linearGradient>
            <clipPath id="expertHeroClip">
              <path d="M181 36H231V115L310 245C323 265 310 282 289 282H122C101 282 88 265 101 245L181 115V36Z"/>
            </clipPath>
            <filter id="expertHeroGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="13"/>
            </filter>
          </defs>
          <ellipse cx="209" cy="282" rx="147" ry="14" fill="#7663FF" fillOpacity=".59" filter="url(#expertHeroGlow)"/>
          <ellipse cx="208" cy="243" rx="177" ry="39" stroke="#AF9BFF" strokeOpacity=".62" strokeWidth="3" transform="rotate(-12 208 243)"/>
          <path d="M181 34H231" stroke="url(#expertHeroRim)" strokeWidth="10" strokeLinecap="round"/>
          <path d="M181 36V115L101 245C88 265 101 282 122 282H289C310 282 323 265 310 245L231 115V36" fill="url(#expertHeroGlass)" stroke="url(#expertHeroRim)" strokeWidth="4" strokeLinejoin="round"/>
          <g clipPath="url(#expertHeroClip)">
            <path d="M91 203C135 185 171 210 215 196C260 182 285 199 332 202V297H91V203Z" fill="url(#expertHeroWater)"/>
            <path d="M91 203C135 185 171 210 215 196C260 182 285 199 332 202" stroke="#D5F8FF" strokeWidth="3" strokeOpacity=".98"/>
            <path d="M170 115L120 241" stroke="white" strokeWidth="9" strokeOpacity=".23" strokeLinecap="round"/>
            <circle cx="167" cy="235" r="5" fill="white" fillOpacity=".4"/>
            <circle cx="233" cy="245" r="3.5" fill="white" fillOpacity=".45"/>
            <circle cx="223" cy="175" r="5" stroke="#D8DAFF" strokeWidth="2" strokeOpacity=".75"/>
          </g>
          <path d="M180 36H231" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeOpacity=".7"/>
          <circle cx="328" cy="69" r="4" fill="#C9BAFF"/>
          <circle cx="101" cy="106" r="3" fill="#81E0FF"/>
        </svg>
      </div>

      <div className="relative z-10 mt-2">{children}</div>

      <div className="relative z-10 mt-4 grid gap-2 sm:grid-cols-3">
        <HeroBenefit icon="bolt" title="빠른 전문가 탐색" description="필요한 AI 역량을 기준으로" />
        <HeroBenefit icon="layers" title="정확한 필터링" description="기술과 연구 분야로 비교" />
        <HeroBenefit icon="profile" title="프로필 확인 후 요청" description="경험과 협업 조건을 검토" />
      </div>
    </header>
  );
}

function HeroBenefit({ icon, title, description }: { icon: "bolt" | "layers" | "profile"; title: string; description: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.065] px-4 py-3 backdrop-blur-sm">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#9d8aff]/15 text-[#d6caff]">
        {icon === "bolt" ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 5 13h6l-1 9 9-12h-6l.5-8Z"/></svg>
        ) : icon === "layers" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-[11px] text-[#C9CEE7]">{description}</span>
      </span>
    </div>
  );
}
