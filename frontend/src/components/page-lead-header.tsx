import type { ReactNode } from "react";
import styles from "./page-lead-header.module.css";

type PageLeadHeaderProps = {
  kicker: string;
  title: string;
  lead: string;
  artSrc?: string;
  artKind?: "photo" | "banner";
  actions?: ReactNode;
  children?: ReactNode;
};

/**
 * 전문가 찾기·자유게시판·FAQ가 같은 헤더를 쓰게 합니다.
 * 오른쪽 그림만 바꾸고, 위아래 선과 왼쪽 여백은 세 화면이 같습니다.
 */
export function PageLeadHeader({
  kicker,
  title,
  lead,
  artSrc,
  artKind = "photo",
  actions,
  children,
}: PageLeadHeaderProps) {
  const hasBody = Boolean(actions || children);
  return (
    <header className={styles.header}>
      <div className={`${styles.hero} ${hasBody ? styles.heroWithBody : ""}`}>
        <div className={styles.copy}>
          <p className={styles.kicker}>{kicker}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
          {children}
        </div>
      </div>
      {artSrc ? (
        <div className={styles.art} data-art={artKind} aria-hidden="true">
          <img src={artSrc} alt="" />
        </div>
      ) : null}
    </header>
  );
}
