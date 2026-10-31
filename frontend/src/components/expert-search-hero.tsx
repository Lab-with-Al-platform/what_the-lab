/**
 * Dark Premium Match hero: visual-only; no ratings, AI recommendations,
 * or collaboration state are implied by its illustration.
 */
export function ExpertSearchHero() {
  return (
    <header className="relative isolate overflow-hidden rounded-[24px] bg-navy px-6 pb-14 pt-9 text-white sm:px-10 sm:pb-16 sm:pt-11 lg:min-h-[324px] lg:px-12 lg:pb-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_45%,rgba(119,92,230,0.32),transparent_45%),linear-gradient(115deg,#101c3c_15%,#1a2051_65%,#32215d)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 size-[390px] rounded-full border border-white/10 sm:size-[520px]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-8 top-12 hidden size-[300px] rounded-full border border-white/10 lg:block" />
      <div className="relative z-10 max-w-[680px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c5bcff]">Expert discovery · Research × AI</p>
        <h1 className="mt-4 text-[31px] font-bold leading-[1.22] tracking-[-0.035em] sm:text-[40px] lg:text-[43px]">
          연구에 맞는 <span className="text-[#c5baff]">AI 전문가</span>를<br className="hidden sm:block" /> 만나보세요.
        </h1>
        <p className="mt-4 max-w-[500px] text-[14px] leading-7 text-[#d7dcf1] sm:text-[15px]">
          필요한 AI 기술과 연구 분야로 전문가를 찾고, 수행 경험과 협업 조건을 충분히 살펴본 뒤 요청하세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#e7e7ff]">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">AI 기술 기반 탐색</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">연구 분야 필터</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">프로필 확인 후 협업 요청</span>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-5 bottom-9 hidden w-[340px] lg:block xl:right-12 xl:w-[370px]" aria-hidden="true">
        <svg viewBox="0 0 400 290" className="h-auto w-full" fill="none">
          <defs>
            <linearGradient id="expertHeroGlass" x1="120" y1="64" x2="310" y2="276" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F1EEFF" stopOpacity=".6"/>
              <stop offset="1" stopColor="#7974FF" stopOpacity=".15"/>
            </linearGradient>
            <linearGradient id="expertHeroWater" x1="150" y1="172" x2="280" y2="275" gradientUnits="userSpaceOnUse">
              <stop stopColor="#73D3FF" stopOpacity=".85"/>
              <stop offset=".55" stopColor="#655FFE" stopOpacity=".92"/>
              <stop offset="1" stopColor="#9271F3"/>
            </linearGradient>
            <clipPath id="expertHeroClip">
              <path d="M181 31H230V112L310 241C321 259 310 270 291 270H120C101 270 90 259 101 241L181 112V31Z"/>
            </clipPath>
            <filter id="expertHeroGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="13"/>
            </filter>
          </defs>
          <ellipse cx="211" cy="265" rx="155" ry="16" fill="#7265FF" fillOpacity=".35" filter="url(#expertHeroGlow)"/>
          <ellipse cx="213" cy="228" rx="176" ry="37" stroke="#B7A4FF" strokeOpacity=".48" strokeWidth="2" transform="rotate(-13 213 228)"/>
          <path d="M178 31H232" stroke="#E0DDFF" strokeWidth="9" strokeLinecap="round"/>
          <path d="M183 33V111L101 241C90 259 101 270 120 270H291C310 270 321 259 310 241L228 111V33" fill="url(#expertHeroGlass)" stroke="#C7C5FF" strokeWidth="4" strokeLinejoin="round"/>
          <g clipPath="url(#expertHeroClip)">
            <path d="M91 199C128 181 172 209 211 192C251 175 289 188 330 197V283H91V199Z" fill="url(#expertHeroWater)"/>
            <path d="M91 199C128 181 172 209 211 192C251 175 289 188 330 197" stroke="#C2EEFF" strokeWidth="3" strokeOpacity=".88"/>
            <circle cx="173" cy="219" r="6" fill="#DBF9FF" fillOpacity=".56"/>
            <circle cx="230" cy="236" r="3.5" fill="#DBF9FF" fillOpacity=".62"/>
            <circle cx="215" cy="162" r="5" stroke="#C6DBFF" strokeWidth="2" strokeOpacity=".8"/>
            <path d="M161 120L125 230" stroke="white" strokeWidth="8" strokeOpacity=".16" strokeLinecap="round"/>
          </g>
          <circle cx="313" cy="70" r="5" fill="#C9B8FF"/>
          <circle cx="102" cy="108" r="3.5" fill="#71DDFF"/>
          <path d="M338 112V134M327 123H349" stroke="#B4A5FF" strokeWidth="2" strokeLinecap="round"/>
          <path d="M73 183V197M66 190H80" stroke="#93DBFF" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-transparent via-[#8d78ff] to-transparent opacity-70" />
    </header>
  );
}
