import Link from "next/link";

/**
 * Exact design direction: adopted second concept is a LIGHT research-discovery dashboard.
 * The former dark/flask hero was an incorrect interpretation and must not be rendered here.
 */
export function ExpertSearchHero() {
  return (
    <header className="relative isolate mb-5 overflow-hidden rounded-2xl bg-white px-5 pb-7 pt-5 sm:px-8 sm:pb-9 sm:pt-7 lg:mb-6 lg:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[53%] overflow-hidden md:block">
        <svg viewBox="0 0 650 235" preserveAspectRatio="xMidYMid slice" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id="expertLightWave" x1="140" y1="0" x2="540" y2="220" gradientUnits="userSpaceOnUse">
              <stop stopColor="#eff3ff" stopOpacity="0" />
              <stop offset=".35" stopColor="#e8eafe" stopOpacity=".72" />
              <stop offset="1" stopColor="#8c9fe5" stopOpacity=".5" />
            </linearGradient>
            <linearGradient id="expertLightWave2" x1="310" y1="0" x2="570" y2="215" gradientUnits="userSpaceOnUse">
              <stop stopColor="#dee5fc" stopOpacity=".06" />
              <stop offset=".63" stopColor="#aabbed" stopOpacity=".75" />
              <stop offset="1" stopColor="#dbe3ff" stopOpacity=".12" />
            </linearGradient>
          </defs>
          <path d="M140 -30C305 -10 366 10 435 86C490 146 496 220 620 261H680V-30H140Z" fill="url(#expertLightWave)" />
          <path d="M340 -42C390 42 393 98 445 137C508 187 537 208 665 223" stroke="url(#expertLightWave2)" strokeWidth="44" />
          <path d="M394 -28C437 57 440 112 491 160C540 208 598 219 690 225" stroke="#f6f8ff" strokeWidth="14" opacity=".85"/>
          <path d="M430 -31C461 57 472 96 525 149C581 205 623 207 700 208" stroke="#9db0e6" strokeWidth="5" opacity=".25"/>
        </svg>
      </div>
      <div className="relative z-10">
        <nav aria-label="현재 위치" className="flex items-center gap-2 text-xs font-medium text-faint">
          <Link href="/" className="transition-colors hover:text-brand">홈</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page" className="text-muted">AI 전문가 찾기</span>
        </nav>
        <h1 className="mt-3 text-[30px] font-bold tracking-[-0.04em] text-ink sm:text-[36px] lg:text-[40px]">AI 전문가 찾기</h1>
        <p className="mt-2 max-w-[530px] text-[13px] leading-6 text-muted sm:text-sm">
          함께 연구할 최고의 AI 전문가를 만나보세요. 깊이 있는 연구와 새로운 가능성이 시작됩니다.
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-6 right-8 z-10 hidden text-right md:block">
        <p className="text-[11px] font-semibold tracking-[0.02em] text-[#66769b]">사람과 AI가 만드는<br/>더 큰 가능성</p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#98a4c1]">RESEARCH BEYOND TOGETHER</p>
        <div className="ml-auto mt-2 h-0.5 w-11 rounded-full bg-[#8c9fe5]" />
      </div>
    </header>
  );
}
