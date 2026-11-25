import type { InsightArticle } from "./insights";

interface InsightCover {
  src: string;
  alt: string;
}

/** 공통 분야 사진보다 글별 표지를 우선합니다. 기존 이미지 원본은 지우지 않습니다. */
export const GENERATED_INSIGHT_COVERS: Record<string, InsightCover> = {
  "sensor-logs": { src: "/generated/trend-sensor-logging-v1.jpg", alt: "모터의 진동·온도 센서와 시계열 기록 장치를 표현한 AI 생성 이미지" },
  "fluid-simulation": { src: "/generated/case-fluid-channel-v1.jpg", alt: "계산 격자와 장애물 뒤 유동을 보여 주는 유체 시뮬레이션 AI 생성 개념 이미지" },
  "battery-life": { src: "/generated/case-battery-cycling-v1.jpg", alt: "충방전 시험 장치에 연결한 원통형 배터리와 전압 곡선을 표현한 AI 생성 이미지" },
  "protein-design": { src: "/generated/case-protein-design-v1.jpg", alt: "표적 단백질과 결합 후보 구조를 표현한 AI 생성 개념 이미지" },
  "metastasis-multimodal": { src: "/generated/case-multimodal-research-v1.jpg", alt: "조직 영상과 비식별 표 데이터를 함께 검토하는 멀티모달 연구 설계의 AI 생성 이미지" },
  "medical-imaging-limits": { src: "/generated/trend-medical-review-v1.jpg", alt: "설명용 흉부 영상과 분석 표시를 사람이 검토하는 AI 생성 이미지" },
  "few-shot-vision": { src: "/generated/trend-vision-prompts-v1.jpg", alt: "잎 이미지의 점·상자 입력과 분할 마스크를 비교한 AI 생성 개념 이미지" },
  "graph-neural-nets": { src: "/generated/trend-graph-messages-v1.jpg", alt: "노드와 연결선을 따라 이웃 정보를 전달하는 그래프 신경망의 AI 생성 개념 이미지" },
  "experiment-optimization": { src: "/generated/trend-experiment-search-v1.jpg", alt: "실험 후보와 다음 측정 지점을 고르는 최적화 과정을 표현한 AI 생성 이미지" },
  "surrogate-models": { src: "/generated/trend-surrogate-comparison-v1.jpg", alt: "정밀 계산 격자와 근사 결과를 나란히 보여 주는 대리모델 AI 생성 개념 이미지" },
  "diffusion-molecules": { src: "/generated/trend-molecule-denoising-v1.jpg", alt: "흩어진 원자 위치에서 분자 구조 후보를 만드는 확산모델의 AI 생성 개념 이미지" },
  "food-image-quality": { src: "/generated/trend-orchard-vision-v1.jpg", alt: "나뭇잎에 일부 가려진 사과의 위치를 찾는 과수 영상 분석 AI 생성 이미지" },
  "ancient-inscription": { src: "/generated/case-inscription-restoration-v1.jpg", alt: "손상된 고대 비문과 복원 후보를 표현한 AI 생성 설명 이미지" },
  "orca-audio": { src: "/generated/case-orca-acoustics-v1.jpg", alt: "수중 마이크로 범고래 소리를 수집하는 과정을 표현한 AI 생성 이미지" },
  "literature-review-llm": { src: "/generated/trend-literature-review-v1.jpg", alt: "논문 후보를 검색하고 원문을 대조하며 선별하는 AI 생성 설명 이미지" },
  "reproducibility-checklist": { src: "/generated/trend-reproducibility-records-v1.jpg", alt: "코드·데이터 버전과 반복 실험 기록을 함께 보관하는 AI 생성 설명 이미지" },
  "private-data-ai": { src: "/generated/trend-private-data-boundary-v1.jpg", alt: "연구실 내부 자료와 외부 AI 서비스 사이의 전송 경계를 표현한 AI 생성 개념 이미지" },
  "mattergen-material-design": { src: "/generated/trend-mattergen-inverse-design-v1.jpg", alt: "원하는 물성 조건에서 결정 구조 후보를 제안하는 역설계 AI 생성 개념 이미지" },
};

/** 본문·분류·URL을 건드리지 않고 표지 메타데이터만 덧붙입니다. */
export function applyInsightCover(article: InsightArticle): InsightArticle {
  const cover = GENERATED_INSIGHT_COVERS[article.slug];
  if (!cover) return article;
  return {
    ...article,
    coverSrc: cover.src,
    imageAlt: cover.alt,
    imageCaption: "글의 개념을 설명하기 위해 AI로 생성한 이미지입니다. 실제 논문 도판·환자 영상·실험 결과가 아닙니다.",
  };
}
