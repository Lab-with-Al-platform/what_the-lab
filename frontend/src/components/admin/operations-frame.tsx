"use client";

import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";
import { useAdminChrome } from "./admin-shell";
import styles from "./admin-workspace.module.css";

const ToolsContext = createContext<ReactNode>(null);

function ModeSwitch() {
  const chrome = useAdminChrome();
  if (!chrome.showMode) return null;
  return <div className={styles.viewSwitch} aria-label="관리자 데이터 모드"><button type="button" aria-pressed={!chrome.demo} onClick={() => chrome.setDemo(false)}>실데이터</button><button type="button" aria-pressed={chrome.demo} onClick={() => chrome.setDemo(true)}>디자인 데모</button></div>;
}

/** 제목은 사이드 메뉴 박스와 같은 높이에서 시작하고, 기간 버튼은 탭 줄로 내립니다. */
export function OperationsFrame({ title, description, tools, children }: { title: string; description?: string; tools?: ReactNode; children: ReactNode }) {
  const chrome = useAdminChrome();
  const withTabs = Children.toArray(children).some((child) => isValidElement(child) && child.type === ScreenTabs);
  const toolRow = tools || chrome.showMode ? <>{tools}<ModeSwitch /></> : null;
  return <ToolsContext.Provider value={withTabs ? toolRow : null}>
    <header className={styles.pageHeader}>
      <div className={styles.pageTitle}><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
      {withTabs ? null : toolRow ? <div className={styles.pageTools}>{toolRow}</div> : null}
    </header>
    {children}
  </ToolsContext.Provider>;
}

/** 카드·그래프와 목록을 나누고, 기간 버튼은 탭 하단 선보다 조금 위에 둡니다. */
export function ScreenTabs({ value, onChange }: { value: "dashboard" | "list"; onChange: (value: "dashboard" | "list") => void }) {
  const tools = useContext(ToolsContext);
  return <div className={styles.screenTabs}>
    <div className={styles.tabList} role="tablist" aria-label="화면 구성">
      <button type="button" role="tab" aria-selected={value === "dashboard"} onClick={() => onChange("dashboard")}>대시보드</button>
      <button type="button" role="tab" aria-selected={value === "list"} onClick={() => onChange("list")}>상세 목록</button>
    </div>
    {tools ? <div className={styles.pageTools}>{tools}</div> : null}
  </div>;
}

/** 주소에 목록 조건이 있으면 상세 목록을, 없으면 대시보드를 엽니다. */
export function screenView(params: { get(name: string): string | null }, detailKeys: string[] = []): "dashboard" | "list" {
  const chosen = params.get("view");
  if (chosen === "dashboard" || chosen === "list") return chosen;
  return detailKeys.some((key) => Boolean(params.get(key))) ? "list" : "dashboard";
}
