export interface InsightEvidence {
  type: "원 연구" | "대표 연구" | "공식 지침" | "공식 연구 자료" | "저자 해설";
  /** 본문과 먼저 대조한, 이 자료로 답할 수 있는 질문과 넘지 말아야 할 범위입니다. */
  takeaway: string;
}

// 원문 링크 유무만으로 검색에 소개하지 않습니다. 글마다 본문을 뒷받침하는 근거를 적습니다.
export const INSIGHT_EVIDENCE: Readonly<Partial<Record<string, InsightEvidence>>> = {
  "lettuce-biomass-estimation": {
    type: "원 연구",
    takeaway: "사진에서 얻은 크기 정보로 생체중을 추정했습니다. 논문에서 선택한 촬영 각도 조합은 케일과 상추가 달랐으므로, 다른 작물에 같은 모형을 적용하려면 다시 확인해야 합니다.",
  },
  "periodontal-bone-loss-analysis": {
    type: "원 연구",
    takeaway: "파노라마 X-ray에서 치아와 뼈 관련 위치를 검출하고 측정 규칙을 적용한 연구입니다. 소규모 평가에서의 전문의 비교를 모든 환자에 대한 진단 성능으로 해석할 수는 없습니다.",
  },
  "concrete-crack-segmentation": {
    type: "원 연구",
    takeaway: "PIDNet을 다른 균열 분할 모델과 비교한 연구입니다. 논문 초록과 본문의 IoU 값이 일치하지 않아 단일 정확도 수치 인용은 보류합니다.",
  },
  "microscope-cell-drawing": {
    type: "원 연구",
    takeaway: "Cellpose 논문의 대상은 현미경 이미지에서 개별 세포의 경계를 나누는 일입니다. 자동으로 나눈 경계가 내 실험의 계수·면적 측정에 맞는지는 별도로 확인해야 합니다.",
  },
  "eeg-behavior": {
    type: "원 연구",
    takeaway: "EEGNet은 정해진 뇌-컴퓨터 인터페이스 과제에서 신호를 분류했습니다. 미리 정의한 과제를 구분한 결과이므로 일상에서 사람의 생각이나 행동을 읽는 근거로 쓸 수 없습니다.",
  },
  "protein-structure": {
    type: "원 연구",
    takeaway: "AlphaFold2 논문은 CASP14에서 단백질 구조 예측 결과를 실험 구조와 비교했습니다. 구조 추정의 정확성은 그 단백질이 실제로 어떤 기능을 하는지 입증하는 것과 별개입니다.",
  },
  "battery-life": {
    type: "원 연구",
    takeaway: "초기 충방전에서 얻은 전압 곡선의 특징을 사용해 용량 저하가 뚜렷하기 전 사이클 수명을 추정했습니다. 학습에 쓰지 않은 전지와 운전 조건에는 별도 검증이 필요합니다.",
  },
  "weather-graph": {
    type: "원 연구",
    takeaway: "GraphCast는 전 지구 기상 상태의 변화를 학습해 중기 예보를 만들고 비교 평가했습니다. 전 지구 지표에서의 결과만으로 특정 지역의 극한 현상 예측을 보장할 수 없습니다.",
  },
  "protein-design": {
    type: "원 연구",
    takeaway: "RFdiffusion 논문은 계산으로 만든 단백질 구조 후보 가운데 일부를 실험으로 확인했습니다. 모델이 후보를 냈다는 사실만으로 기능이나 실험 성공을 판단할 수 없습니다.",
  },
  "fluid-simulation": {
    type: "원 연구",
    takeaway: "FNO 논문은 정의된 방정식과 데이터에서 입력 조건을 해로 바꾸는 관계를 학습하고 다른 격자 해상도를 시험했습니다. 학습 범위 밖의 형상·경계 조건까지 같은 정확도를 보장하지 않습니다.",
  },
  "retrosynthesis": {
    type: "원 연구",
    takeaway: "논문은 합성 경로 후보를 찾는 문제에 신경망과 탐색을 활용했습니다. 후보 경로의 제안과 각 반응을 실제 실험에서 검증하는 일은 별개입니다.",
  },
  "ancient-inscription": {
    type: "원 연구",
    takeaway: "Ithaca는 고대 그리스 비문의 누락 문자, 작성 시기와 지리적 기원 후보를 제시합니다. 예측 점수는 역사 연구자가 문맥과 다른 자료를 검토할 때 참고하는 정보입니다.",
  },
  "solar-panels": {
    type: "원 연구",
    takeaway: "DeepSolar는 영상에서 태양광 설비를 찾아 미국의 설비 분포 데이터를 구축했습니다. 이 연구의 관측 시점과 탐지 범위가 현재 설비 현황 전체를 뜻하지는 않습니다.",
  },
  "orca-audio": {
    type: "원 연구",
    takeaway: "ORCA-SPOT은 긴 수중 녹음에서 범고래 소리가 있을 법한 구간을 찾아 사람이 들을 범위를 좁힙니다. 소리의 의미나 어느 개체가 냈는지는 탐지 결과만으로 알 수 없습니다.",
  },
  "research-agent": {
    type: "원 연구",
    takeaway: "Co-Scientist 논문은 가설 제안과 우선순위 평가에 여러 에이전트를 사용했습니다. 시스템이 매긴 우선순위와 연구자가 실험으로 확인한 근거는 서로 다른 단계입니다.",
  },
  "mattergen-material-design": {
    type: "대표 연구",
    takeaway: "MatterGen은 요구 물성을 조건으로 새 결정 구조 후보를 제안합니다. 후보를 만들어 내는 단계와 계산 또는 실제 합성으로 가능성을 확인하는 단계는 구분해야 합니다.",
  },
  "mattergen-experimental-validation": {
    type: "원 연구",
    takeaway: "논문은 계산 평가와 선정 후보의 합성·측정 사례를 별도로 보고합니다. 계산 지표나 한 후보의 결과를 생성한 모든 구조의 합성 성공률로 읽을 수 없습니다.",
  },
  "alphaevolve-algorithm-discovery": {
    type: "원 연구",
    takeaway: "공식 백서는 코드 후보를 만들고 자동으로 채점해 반복 개선하는 방식을 설명합니다. 이 방법을 쓰려면 좋은 답을 구분할 평가 기준부터 마련해야 합니다.",
  },
  "literature-review-llm": {
    type: "공식 지침",
    takeaway: "Cochrane Handbook은 검색 전략의 기록과 문헌 선정의 근거를 요구합니다. 이 글은 그 원칙을 LLM 보조 검토에 적용하며, 특정 LLM의 정확도를 측정한 결과는 제시하지 않습니다.",
  },
  "surrogate-models": {
    type: "대표 연구",
    takeaway: "FNO의 수치 실험은 정해진 조건에서 계산 결과의 근사값을 학습할 수 있는 예를 보여 줍니다. 빠르다는 이유만으로 오차를 점검하거나 정밀 계산과 비교하는 단계를 생략할 수 없습니다.",
  },
  "few-shot-vision": {
    type: "대표 연구",
    takeaway: "SAM 원 논문의 중심은 점·상자 등 입력으로 원하는 영역을 분할하는 것입니다. 적은 라벨로 분류 모델을 추가 학습하는 접근과는 평가 대상부터 다릅니다.",
  },
  "diffusion-molecules": {
    type: "대표 연구",
    takeaway: "EDM 논문은 원자의 종류와 3차원 위치를 함께 표현한 분자 후보를 평가했습니다. 계산으로 생성한 구조만으로 합성 가능성이나 약효를 증명할 수는 없습니다.",
  },
  "sensor-logs": {
    type: "공식 연구 자료",
    takeaway: "NASA 저장소의 예지보전 자료는 일부 장비에서 상태 변화와 고장까지 이르는 기록을 제공합니다. 내 장비에 쓰려면 같은 운전 조건과 시간 순서가 갖춰졌는지 먼저 살펴야 합니다.",
  },
  "experiment-optimization": {
    type: "대표 연구",
    takeaway: "BoTorch 논문은 이미 얻은 측정값을 바탕으로 다음 평가 후보를 고르는 베이지안 최적화 틀을 설명합니다. 실험 횟수 절감은 측정 비용·노이즈·비교 기준에 따라 달라집니다.",
  },
  "reproducibility-checklist": {
    type: "공식 지침",
    takeaway: "NeurIPS 체크리스트는 실험을 재현할 단서와 결과의 불확실성을 보고하도록 안내합니다. 다른 학회에 제출할 때는 해당 학회의 요구 사항도 따로 확인해야 합니다.",
  },
  "graph-neural-nets": {
    type: "저자 해설",
    takeaway: "Distill의 원저자 해설은 노드와 연결을 표현하고 이웃의 정보를 모으는 원리를 보여 줍니다. 어떤 연결을 만들지는 연구 문제에서 정하는 가정이며, 연결만으로 인과관계를 증명할 수 없습니다.",
  },
  "private-data-ai": {
    type: "공식 지침",
    takeaway: "NIST의 생성형 AI 위험 프로필은 개인정보와 외부 공급업체에서 생기는 위험을 다룹니다. 특정 서비스에 미공개 자료를 올려도 되는지는 소속 기관의 규정과 계약 조건을 별도로 확인해야 합니다.",
  },
  "food-image-quality": {
    type: "대표 연구",
    takeaway: "과수 영상 논문은 나무에 달린 과실의 위치를 찾는 연구입니다. 영상에서 과실이 보이는지와 내부 품질·안전성을 판단할 수 있는지는 다른 문제입니다.",
  },
  "medical-imaging-limits": {
    type: "공식 지침",
    takeaway: "CLAIM은 의료 영상 AI 논문에 데이터의 출처, 평가 방법, 한계를 설명하도록 안내하는 보고 지침입니다. 체크리스트를 따랐다는 사실이 임상 효용이나 승인 여부를 입증하지는 않습니다.",
  },
};
