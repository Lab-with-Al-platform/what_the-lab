"use client";

import { useState } from "react";
import type { DiscordGuide, DiscordScene } from "@/lib/faq-discord";
import styles from "./faq-discord-guide.module.css";

const SURFACES: Record<DiscordScene["surface"], string> = {
  channel: "협업 채널 · 참여자가 함께 보는 메시지",
  private: "개인 화면 · 조작한 사람에게만 표시",
  dm: "봇 DM · 수신 조건에 따라 전달",
  website: "WHAT THE LAB · 사이트 화면 안내",
};

/** Illustrative controls are text, so readers cannot mistake them for live Discord actions. */
function SceneCard({ scene }: { scene: DiscordScene }) {
  return (
    <figure className={styles.canvas}>
      <div className={styles.canvasHeader}>
        <span className={styles.channelMark} aria-hidden="true">{scene.surface === "dm" ? "@" : "#"}</span>
        <div><strong>{scene.surface === "website" ? "사이트에서 확인" : scene.surface === "dm" ? "서비스 봇과의 DM" : "협업-번호"}</strong><span>{SURFACES[scene.surface]}</span></div>
        <span className={styles.example}>예시</span>
      </div>
      <div className={styles.canvasBody}>
        <div className={styles.sceneType}>{scene.view === "form" ? "입력창 안내" : scene.view === "panel" ? "관리 메뉴 안내" : scene.view === "list" ? "목록 안내" : scene.view === "notice" ? "상태 안내" : "메시지 안내"}</div>
        <div className={styles.card}>
          <h5>{scene.heading}</h5>
          <p className={styles.sceneText}>{scene.text}</p>
          {scene.fields && (
            <dl className={styles.fields}>
              {scene.fields.map(field => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {scene.actions && (
            <div className={styles.exampleActions} aria-label="실제 화면에서 찾을 버튼·명령어·링크 이름">
              {scene.actions.map(label => <span key={label}>{label}</span>)}
            </div>
          )}
        </div>
      </div>
      <figcaption>설명용 시연 화면 · 실제 Discord 캡처 아님 · 입력·전송되지 않음</figcaption>
    </figure>
  );
}

export function FaqDiscordGuide({ guide, faqId }: { guide: DiscordGuide; faqId: string }) {
  const [index, setIndex] = useState(0);
  const scene = guide.scenes[index];
  const panelId = `discord-guide-${faqId}`;
  return (
    <section className={styles.guide} aria-label={`${guide.title} Discord 사용 안내`}>
      <header className={styles.heading}>
        <div><span className={styles.eyebrow}>DISCORD GUIDE</span><h3>{guide.title}</h3></div>
        <span className={styles.provenance}>설명용 안내도</span>
      </header>
      <p className={styles.prerequisite}><strong>먼저 확인</strong>{guide.prerequisite}</p>
      <ol className={styles.stepList} aria-label="Discord 안내 단계">
        {guide.scenes.map((step, stepIndex) => (
          <li key={step.title}>
            <button type="button" aria-pressed={index === stepIndex} aria-controls={panelId} onClick={() => setIndex(stepIndex)}>
              <span>{String(stepIndex + 1).padStart(2, "0")}</span>{step.title}
            </button>
          </li>
        ))}
      </ol>
      <div id={panelId} className={styles.stage}>
        <div className={styles.stageTitle} aria-live="polite" aria-atomic="true">
          <span>{index + 1} / {guide.scenes.length}</span><h4>{scene.title}</h4>
        </div>
        <SceneCard scene={scene} />
        <div className={styles.outcome}><strong>이 단계 다음에는</strong><p>{scene.outcome}</p></div>
        <nav className={styles.pager} aria-label="안내 단계 이동">
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 이전 단계</button>
          <span>안내만 전환돼요</span>
          <button type="button" disabled={index === guide.scenes.length - 1} onClick={() => setIndex(index + 1)}>다음 단계 →</button>
        </nav>
      </div>
      <aside className={styles.reflection} aria-label="사이트와 연결되는 방식">
        <strong>사이트와 어떻게 이어지나요?</strong>
        <ul>{guide.reflection.map(line => <li key={line}>{line}</li>)}</ul>
      </aside>
      <p className={styles.caution}>{guide.caution}</p>
    </section>
  );
}
