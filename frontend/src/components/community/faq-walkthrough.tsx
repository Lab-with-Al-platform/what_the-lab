"use client";

import Link from "next/link";
import { useState } from "react";
import type { FaqGuide } from "@/lib/faq";
import styles from "./faq-visual.module.css";

/**
 * Screenshot-free, source-grounded help visualization.
 * Each focus label is drawn from actual product UI. No fabricated accounts,
 * statuses, ratings or operational data is shown.
 */
export function FaqWalkthrough({ guide, faqId }: { guide: FaqGuide; faqId: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = guide.steps[activeIndex] ?? guide.steps[0];
  const panelId = `faq-guide-${faqId}`;

  return (
    <section className={styles.guide} aria-label={`${guide.title} 단계별 화면 안내`}>
      <div className={styles.guideHeading}>
        <div>
          <p className={styles.guideEyebrow}>STEP-BY-STEP GUIDE <span aria-hidden="true">/</span> 서비스 화면 안내</p>
          <h3>{guide.title}</h3>
        </div>
        <span className={styles.stepBadge}>{guide.steps.length}단계</span>
      </div>
      <div className={styles.guideLayout}>
        <ol className={styles.steps} aria-label="안내 단계 선택">
          {guide.steps.map((step, index) => (
            <li key={`${faqId}-step-${index}`} className={styles.stepItem}>
              <button
                type="button"
                className={`${styles.stepButton} ${activeIndex === index ? styles.stepSelected : ""}`}
                onClick={() => setActiveIndex(index)}
                aria-pressed={activeIndex === index}
                aria-controls={panelId}
              >
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.stepBody}>
                  <span className={styles.stepScreen}>{step.screen}</span>
                  <strong>{step.heading}</strong>
                </span>
                <span className={styles.stepChevron} aria-hidden="true">↗</span>
              </button>
            </li>
          ))}
        </ol>

        <div id={panelId} className={styles.stage} aria-live="polite" aria-atomic="true">
          <div className={styles.stageChrome} aria-hidden="true">
            <span className={styles.chromeDots}><i /><i /><i /></span>
            <span className={styles.stagePath}>{current.screen}</span>
            <span className={styles.chromeMark}>WHAT THE LAB</span>
          </div>
          <div className={styles.stageContent}>
            <div className={styles.stageMeta}>
              <span className={styles.stageIndex}>STEP {String(activeIndex + 1).padStart(2, "0")}</span>
              <span className={styles.stageRule} aria-hidden="true" />
              <span>화면에서 찾을 위치</span>
            </div>
            <h4>{current.heading}</h4>
            <p className={styles.stageDescription}>{current.detail}</p>
            <div className={styles.focusCard}>
              <span className={styles.focusOverline}>LOOK FOR THIS</span>
              <div className={styles.focusAction}>
                <span className={styles.focusPulse} aria-hidden="true" />
                <strong>{current.focus}</strong>
                <span aria-hidden="true">↗</span>
              </div>
              <span className={styles.focusHint}>실제 서비스에 표시되는 화면명·버튼명 기준</span>
            </div>
            <div className={styles.stageFooter}>
              <span>화면 안내도 · 실제 캡처 아님</span>
              <Link href={current.href} className={styles.stageLink}>
                해당 메뉴로 이동 <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.guideFootnote}>
        <span className={styles.noteGlyph} aria-hidden="true">i</span>
        <p>{guide.note}</p>
      </div>
    </section>
  );
}
