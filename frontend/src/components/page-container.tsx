import type { HTMLAttributes, ReactNode } from "react";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** 헤더·본문·푸터가 같은 가로 폭을 쓰게 하는 그릇입니다. */
export function PageContainer({ children, className = "", ...rest }: PageContainerProps) {
  return (
    <div className={`page-container ${className}`} {...rest}>
      {children}
    </div>
  );
}
