# 인사이트 표지 중복 해소·본문 분량 점검

확인일: 2026-10-19 · 브랜치: `feature/insight-foundation`

## 결과와 범위

31개 글에 쓰이던 이미지 경로를 비교해 8개 중복 그룹을 확인했습니다. 주제 연관성이 높은 기존 표지는 유지하고 18개 글에 전용 표지를 생성했습니다. 실제 그림을 열어 보니 파일명과 내용이 다른 경우가 있어 파일명만으로 결정하지 않았습니다. 기존 에셋 파일은 삭제하거나 덮어쓰지 않았습니다.

본문·성과 수치·출처·분류·URL은 이번 작업에서 변경하지 않았습니다. 목록, 홈 카드, 대표 카드, 상세, 관련 글에 같은 전용 표지를 전달합니다. 31개 글의 최종 이미지 경로와 파일 내용 해시가 모두 다른지 자동 검사합니다. 같은 이미지가 동일한 글의 목록과 상세에 반복되는 것은 정상입니다.

### 기존 이미지 보존·교체 판단

| 기존 중복 그룹 | 남긴 글 | 교체한 글과 이유 |
|---|---|---|
| 조직 사진 `histology.jpg` | 세포 이미지 분류 시나리오 | 멀티모달은 영상+표 결합, 의료 한계는 사람의 영상 검토가 핵심이므로 전용 표지 |
| 세포 렌더 `cells-render.jpg` | Cellpose 세포 분할 | 소량 라벨·SAM 해설은 잎 이미지의 점·상자·마스크로 구분 |
| 단백질 렌더 `protein-render.jpg` | AlphaFold 단백질 구조 | RFdiffusion은 구조 후보 설계, GNN은 노드·연결선으로 구분 |
| 피펫 사진 `protein.jpg` | 화학 합성 경로(실험실 맥락) | 분자 확산은 원자→구조, 과수 탐지는 사과·검출 영역으로 구분 |
| MatterGen 실험실 | MatterGen 실험 검증 사례 | 트렌드는 물성 조건→결정 후보라는 역설계 개념으로 구분 |
| 웹 통계 화면 `chart.jpg` | 없음 | 배터리·장비 로그·실험 최적화 모두 실제 핵심 주제와 맞지 않아 전부 교체 |
| 시험관 사진 `pexel-scope.jpg` | 없음 | 유체 계산과 대리모델의 차이가 드러나지 않아 둘 다 교체 |
| 수식 그림 `waves.jpg` | 없음 | 비문·범고래·문헌 검토·재현성·비공개 자료 모두 주제 직접 연관성이 낮아 전부 교체 |

### 생성 에셋

내장 `image_gen` 도구로 에셋마다 별도 생성했습니다. CLI/API 키 방식으로 전환하지 않았습니다. 전체 18개는 **1672×941 PNG**이며, 프로젝트의 `frontend/public/generated/` 안에 복사해 두었습니다. 생성 캐시만 참조하지 않습니다.

[프롬프트·원본 생성 경로·저장 경로·용도 기록](assets.json)

공통 프롬프트 원칙: 차분한 연구 에디토리얼, 글의 핵심 대상이 중앙 크롭에서도 인식됨, 제목·브랜드·수치·성과 주장 없음. 이미지 자체가 실제 논문 도판이나 측정 결과가 되지 않도록 요청하고 상세 캡션에도 **AI 생성 설명 이미지이며 실제 논문 도판·환자 영상·실험 결과가 아님**을 명시했습니다. 분자 결합, 유동, 결정 등의 그림은 정밀 구조도나 수치해석 결과로 사용하면 안 됩니다. AI 생성이라는 기록은 독점적 권리에 대한 법률 보증이 아닙니다.

| 글 ID | 저장 파일 | 표지 의미 |
|---|---|---|
| `battery-life` | [case-battery-cycling-v1.png](../../../frontend/public/generated/case-battery-cycling-v1.png) | 충방전 시험 장치에 연결한 원통형 배터리와 전압 곡선을 표현한 이미지 |
| `protein-design` | [case-protein-design-v1.png](../../../frontend/public/generated/case-protein-design-v1.png) | 표적 단백질과 결합 후보 구조를 표현한 개념 이미지 |
| `metastasis-multimodal` | [case-multimodal-research-v1.png](../../../frontend/public/generated/case-multimodal-research-v1.png) | 조직 영상과 비식별 표 데이터를 함께 검토하는 멀티모달 연구 설계의 이미지 |
| `medical-imaging-limits` | [trend-medical-review-v1.png](../../../frontend/public/generated/trend-medical-review-v1.png) | 설명용 흉부 영상과 분석 표시를 사람이 검토하는 이미지 |
| `few-shot-vision` | [trend-vision-prompts-v1.png](../../../frontend/public/generated/trend-vision-prompts-v1.png) | 잎 이미지의 점·상자 입력과 분할 마스크를 비교한 개념 이미지 |
| `graph-neural-nets` | [trend-graph-messages-v1.png](../../../frontend/public/generated/trend-graph-messages-v1.png) | 노드와 연결선을 따라 이웃 정보를 전달하는 그래프 신경망의 개념 이미지 |
| `experiment-optimization` | [trend-experiment-search-v1.png](../../../frontend/public/generated/trend-experiment-search-v1.png) | 실험 후보와 다음 측정 지점을 고르는 최적화 과정을 표현한 이미지 |
| `surrogate-models` | [trend-surrogate-comparison-v1.png](../../../frontend/public/generated/trend-surrogate-comparison-v1.png) | 정밀 계산 격자와 근사 결과를 나란히 보여 주는 대리모델 개념 이미지 |
| `diffusion-molecules` | [trend-molecule-denoising-v1.png](../../../frontend/public/generated/trend-molecule-denoising-v1.png) | 흩어진 원자 위치에서 분자 구조 후보를 만드는 확산모델의 개념 이미지 |
| `food-image-quality` | [trend-orchard-vision-v1.png](../../../frontend/public/generated/trend-orchard-vision-v1.png) | 나뭇잎에 일부 가려진 사과의 위치를 찾는 과수 영상 분석 이미지 |
| `ancient-inscription` | [case-inscription-restoration-v1.png](../../../frontend/public/generated/case-inscription-restoration-v1.png) | 손상된 고대 비문과 복원 후보를 표현한 설명 이미지 |
| `orca-audio` | [case-orca-acoustics-v1.png](../../../frontend/public/generated/case-orca-acoustics-v1.png) | 수중 마이크로 범고래 소리를 수집하는 과정을 표현한 이미지 |
| `literature-review-llm` | [trend-literature-review-v1.png](../../../frontend/public/generated/trend-literature-review-v1.png) | 논문 후보를 검색하고 원문을 대조하며 선별하는 설명 이미지 |
| `reproducibility-checklist` | [trend-reproducibility-records-v1.png](../../../frontend/public/generated/trend-reproducibility-records-v1.png) | 코드·데이터 버전과 반복 실험 기록을 함께 보관하는 설명 이미지 |
| `private-data-ai` | [trend-private-data-boundary-v1.png](../../../frontend/public/generated/trend-private-data-boundary-v1.png) | 연구실 내부 자료와 외부 AI 서비스 사이의 전송 경계를 표현한 개념 이미지 |
| `mattergen-material-design` | [trend-mattergen-inverse-design-v1.png](../../../frontend/public/generated/trend-mattergen-inverse-design-v1.png) | 원하는 물성 조건에서 결정 구조 후보를 제안하는 역설계 개념 이미지 |
| `sensor-logs` | [trend-sensor-logging-v1.png](../../../frontend/public/generated/trend-sensor-logging-v1.png) | 모터의 진동·온도 센서와 시계열 기록 장치를 표현한 이미지 |
| `fluid-simulation` | [case-fluid-channel-v1.png](../../../frontend/public/generated/case-fluid-channel-v1.png) | 계산 격자와 장애물 뒤 유동을 보여 주는 유체 시뮬레이션 개념 이미지 |

## 짧아 보이는 글은 원문이 짧기 때문인가?

**그렇게 단정할 수 없습니다. 현재 로컬 원고를 짧게 편집한 영향이 큽니다.**

이전 28개 보강 원고는 대체로 본문 문단 합계 약 1,900~2,200자이고, 치주골 사례는 약 3,900자, MatterGen 사례는 약 5,000자입니다. 대부분 10개 섹션이지만 한 섹션에 한 문단이어서 목차 수에 비해 설명 깊이가 얕게 느껴질 수 있습니다. 비교 수치는 출처·편집자 문단을 포함하며 제목·용어 펼침·질문 목록·요약은 제외합니다. 읽는 시간은 편집 추정값이므로 분량 검증 지표가 아닙니다.

공개 초록·공식 연구 소개까지만 확인한 글도 있어, Methods·보충자료의 표본 구성·평가 조건·실패 사례를 임의로 적지 않았습니다. **내용을 확인하지 못했다는 것과 원문에 내용이 없다는 것은 다릅니다.** 이번 점검은 모든 원문을 다시 정독해 원문 분량을 비교한 작업이 아닙니다. 본문 각 글의 `출처와 확인 수준`을 우선 확인해야 합니다.

[31개 글의 문단 분량·섹션 수·용어 수·확인 범위](content-audit.json)

### 다음 내용 보강의 우선 후보

| 글 | 보완할 방향 | 먼저 필요한 확인 |
|---|---|---|
| 그래프 신경망 | 표 데이터와 그래프의 차이, 이웃 정보 전달 예, 그래프로 만들면 안 되는 상황 | 현재 개념 해설의 범위를 유지하며 구체적 예시와 실패 조건을 구분 |
| 대리모델·유체 계산 | 정확 계산과 근사의 차이, 학습 범위를 벗어난 입력, 오차 검증 순서 | FNO 원문 Methods와 벤치마크 조건. 모든 형상에 일반화된다는 설명 금지 |
| 상추·케일 | 촬영-직접 측정 연결, 표본 분리, 조건별 오차, 재현 절차 | 원문 전체 재접근. 이전 초록 기록 외 숫자를 추정해서 채우지 않음 |
| 분자 확산모델 | 원자 위치와 결합의 차이, 생성→유효성→합성→활성 검증의 간극 | EDM 원문·보충자료의 자료와 평가 정의 확인 |
| 소량 라벨·SAM | 전이 학습과 프롬프트 분할의 서로 다른 작업 흐름, 잘 안 되는 연구 영상 예 | 원문 적용 범위와 내 데이터 평가를 구분. 소량 라벨 성능 보장 금지 |

같은 길이로 맞추는 것이 목표는 아닙니다. 연구자가 ‘입력은 무엇이고, AI는 무엇을 하며, 어떤 검증이 필요한지’를 이해할 만큼 설명하고, 사례는 실제 조건·결과를, 트렌드는 쉬운 원리·예시·오해 방지를 중심으로 보완하는 것이 다음 단계입니다. 사용자 질문은 원인 확인이므로 이번에는 본문을 추가로 늘리거나 새 성과를 만들지 않았습니다.

## 코드 흐름

1. `insight-covers.ts`에서 글 ID별 전용 경로·alt를 관리합니다.
2. `applyInsightCover()`가 기존 글의 표지 필드만 덧붙입니다.
3. 공통 `CoverArt`는 전용 `src`가 있으면 사용하고, 없으면 기존 주제 사진으로 돌아갑니다.
4. 모든 글 표시 컴포넌트에서 같은 필드를 전달해 목록·상세가 어긋나지 않게 합니다.

초보자 관점에서 `src ?? 기본사진`은 ‘전용 표지가 없을 때만 기본 사진을 쓰라’는 뜻입니다. `cover`라는 분야 분류를 18개 더 늘리지 않고 전용 경로만 분리해 기존 분류와 필터를 유지합니다.

## 검증과 미검증

- 콘텐츠·표지 자동 테스트 **14개 통과**. 실제 이미지 파일 해시 중복, 31개 경로, 생성 캡션, 공통 표지 폴백, 모든 소비 컴포넌트의 전달 여부 포함.
- 타입 검사 통과. 변경 파일 ESLint 오류 0, 기존 이미지 최적화 권고 2건 유지.
- 전체 프로덕션 빌드 **53개 페이지 생성 통과**. 기존 미사용 nickname·img 최적화 권고 경고는 유지.
- 브라우저 상세 **31개 글 × 1440/768/390px = 93개 조건 통과**. 응답 200, 제목·섹션 수 유지, 전용 이미지 경로·AI 생성 캡션 확인, 이미지 로딩 실패·가로 넘침·브라우저 실행 오류 없음.
- 홈과 사례·트렌드 각 3페이지를 실제 페이지 버튼으로 이동해 전용 표지 **18개가 목록에 모두 전달됨**을 확인했습니다. URL의 page 변수로 페이지가 바뀐다고 가정하지 않았습니다. 기존 용어 click/Enter/Space와 모바일 목차 이동·접힘도 통과했습니다.
- [측정 결과](measurements.json), [반복 검증 스크립트](verify-covers.cjs), [본문 분량 기록](content-audit.json).
- 대표 상세 화면: [MatterGen PC](mattergen-material-design-1440.png) · [MatterGen 모바일](mattergen-material-design-390.png) · [비문 태블릿](ancient-inscription-768.png) · [과수 모바일](food-image-quality-390.png) · [유체 태블릿](fluid-simulation-768.png).
- 목록 비교: [사례 PC](cases-list-1440.png) · [사례 태블릿](cases-list-768.png) · [사례 모바일](cases-list-390.png) · [트렌드 PC](trends-list-1440.png) · [트렌드 태블릿](trends-list-768.png) · [트렌드 모바일](trends-list-390.png). 뒤쪽 목록: [사례 2](cases-page2-1440.png) · [사례 3](cases-page3-1440.png) · [트렌드 2](trends-page2-1440.png) · [트렌드 3](trends-page3-1440.png).

이번 UI 검수는 P0 랜딩·상세의 헤더·배경·본문 읽기 폭·카드 비율을 유지하는지와 새 표지의 주제·크롭을 중심으로 확인합니다. 전체 디자인을 새로 구현하거나 모든 버튼·로그인·실기기 접근성을 재검수한 것은 아닙니다. PNG 원본을 우선 보존했으며 배포용 압축·지연 로딩·전송 성능 최적화는 별도 과제입니다.

백엔드·DB·로그인·관리자·챗봇·배포·커밋·push는 변경하지 않았습니다. 빌드와 개발 서버의 공유 폴더 충돌을 피하기 위해 제가 띄운 프론트 서버만 잠시 멈춘 뒤 다시 시작했습니다.

## 로컬 확인

- http://localhost:3000/cases
- http://localhost:3000/trends
- http://localhost:3000/trends/mattergen-material-design
- http://localhost:3000/cases/mattergen-experimental-validation

브라우저에서 기존 그림이 남아 있다면 강력 새로고침으로 다시 확인합니다. 새 표지는 새 파일명을 사용하므로 이전 파일을 덮어쓰는 방식은 사용하지 않았습니다.
