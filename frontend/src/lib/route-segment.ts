"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** 주소 `/a/b/c`에서 position번째(0부터) 조각을 꺼내요. 예: /workspace/4 의 1번 → "4". 없거나 깨진 값이면 null. */
export function readPathSegment(pathname: string, position: number): string | null {
  const segment = pathname.split("/").filter(Boolean)[position];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null; // `%E0%A4` 처럼 잘못된 주소
  }
}

/**
 * 브라우저 주소에서 번호 조각을 읽어요 (정적 빌드는 번호 0 화면 하나만 있어서, lib/static-route.ts).
 * 화면이 처음 그려질 때는 null이에요. 미리 만든 HTML과 첫 화면이 같아야 React 경고(hydration 불일치)가 나지 않아서예요.
 */
export function usePathSegment(position: number): string | null {
  const pathname = usePathname(); // 다른 번호로 화면 이동했을 때 다시 읽기 위한 신호
  const [segment, setSegment] = useState<string | null>(null);

  useEffect(() => {
    setSegment(readPathSegment(window.location.pathname, position));
  }, [pathname, position]);

  return segment;
}
