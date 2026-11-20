"use client";

import { useEffect, useState } from "react";

// Tailwind 기준점과 같은 폭에서 한 줄에 보여 줄 카드 수를 바꿔요.
const WIDE = "(min-width: 1280px)"; // xl: 3장
const MEDIUM = "(min-width: 768px)"; // md: 2장

/** 화면 폭에 맞춰 한 줄 슬라이드에 보여 줄 카드 수(1·2·3)를 돌려줘요. */
export function useCardsPerView(): number {
  // 서버 렌더링과 첫 화면은 PC 기준 3장으로 맞추고, 브라우저에서 바로 실제 폭으로 고쳐요.
  const [count, setCount] = useState(3);

  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const medium = window.matchMedia(MEDIUM);
    const update = () => setCount(wide.matches ? 3 : medium.matches ? 2 : 1);
    update();
    wide.addEventListener("change", update);
    medium.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      medium.removeEventListener("change", update);
    };
  }, []);

  return count;
}
