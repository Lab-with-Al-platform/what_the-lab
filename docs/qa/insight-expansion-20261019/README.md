# 인사이트 나머지 28개 글 보강

확인일: 2026-10-19 · 작업 브랜치: `feature/insight-foundation`

## 요청과 반영 범위

치주골 소실 사례의 읽기 깊이를 기준으로 나머지 사례 15개, 트렌드 13개를 보강했습니다. 총 31개 중 이미 보강한 치주골·MatterGen 사례·MatterGen 트렌드 3개는 객체 전체 비교 테스트로 보존했습니다. Co-Scientist·AlphaEvolve는 기존에 검토한 6개 섹션을 그대로 두고 데이터 준비, 역할, 작은 시험, 출처 섹션만 추가했습니다.

- 사례: 연구 배경 → 기존 병목 → 데이터 → 방법 → 검증 → 역할 → 작은 시험 → 한계 → 도입 질문 → 출처.
- 트렌드: 쉬운 작동 원리, 입력 조건, 확인된 근거, 연구에 적용할 때의 조건을 중심으로 설명합니다.
- 글마다 용어 풀이를 3개 이상 제공합니다. 원문 설명과 편집자의 해석·적용 제안·주의 판단을 기존 노트 UI로 구분합니다.
- 기존 URL, 사례/트렌드 구분, 이미지, 필터 연결은 유지했습니다. 등록일과 원 연구 발표일을 구분하고 읽는 시간은 편집 추정치로 표시합니다.
- `cancer-cell-classification`, `metastasis-multimodal`은 검증할 실제 성과 근거가 없으므로 **설명용 연구 시나리오**임을 제목·안내·자료 구분에 명시했습니다. 기존 예시 기관·DOI·성과 수치는 최종 화면 데이터에서 제거했습니다. 이 두 글은 실제 협업 성공 사례가 아닙니다.

## 구현 구조

- `frontend/src/lib/insight-case-details.ts`: 사례별 원고와 출처.
- `frontend/src/lib/insight-trend-details.ts`: 트렌드별 원고와 출처.
- `frontend/src/lib/insight-enrichment.ts`: 주제별 원고를 기존 글 화면의 섹션·용어·노트 형식으로 조립합니다.
- `frontend/src/lib/insights.ts`: 기존 글 목록을 조립 함수에 연결합니다. 보강 대상이 아니면 기존 객체를 반환합니다.
- `frontend/tests/insight-reading.test.cjs`: 보존, 내용 깊이, 출처, 시나리오 표시, 용어 참조, 편집자 노트 검사를 포함합니다.

같은 문장을 모든 글에 붙이지 않고 주제별 데이터·방법·검증 조건을 작성했습니다. UI 컴포넌트와 백엔드는 이번 보강에서 수정하지 않았습니다. 현재 표시 경로는 정적 로컬 콘텐츠이며 DB 글을 게시하거나 동기화한 작업이 아닙니다.

## 출처와 확인 수준

공개 초록, 공식 연구기관 소개, 공개 지침과 프로젝트 자료를 중심으로 확인했습니다. **모든 논문의 Methods·보충자료 전체를 검토하거나 실험을 재현한 것은 아닙니다.** 역할 배분·작은 시험·도입 질문은 LabBridge의 편집 제안이며 원 연구의 실험 결과로 취급하지 않습니다. 과거 연구를 최신 성능 순위로 소개하지 않습니다.

### 사례 자료

| 글 | 근거 | 확인 범위와 주의 |
|---|---|---|
| 상추 생체중 | [원 논문 DOI](https://doi.org/10.12791/ksbec.2025.34.4.485) | 이번 원문 재접속 실패. 기존 10월 16일 초록 확인 기록의 R²·ImageJ 범위를 유지하며 새 성과를 주장하지 않음 |
| 콘크리트 균열 | [학술지 PDF](https://ki-it.com/xml/43459/43459.pdf) | 공개 학술지 정보·기존 초록 기록 범위. IoU, 속도, 모델 크기는 해당 평가 조건에 한정 |
| 세포 분류 시나리오 | [CLAIM 2020](https://pubs.rsna.org/doi/10.1148/ryai.2020200029) | 검토 기준의 근거일 뿐 특정 세포 분류 실험의 성공 근거가 아님 |
| 현미경 세포 분할 | [Cellpose](https://www.nature.com/articles/s41592-020-01018-x) | 2021년 원 연구 공개 초록과 모델 설명 |
| 뇌파 분류 | [EEGNet](https://arxiv.org/abs/1611.08024) | 공개 초록의 BCI 과제 범위. 일반적인 행동·의도 판독으로 확대하지 않음 |
| 단백질 구조 | [AlphaFold 2](https://www.nature.com/articles/s41586-021-03819-2) | 공개 초록·모델 설명. 구조와 기능·결합의 실험 검증을 구분 |
| 배터리 수명 | [Severson 등, 2019](https://www.nature.com/articles/s41560-019-0356-8) | 공개 초록. 100회 사이클 회귀 오차와 5회 사이클 이진 분류 오차를 구분 |
| 날씨 예측 | [GraphCast 공식 소개](https://deepmind.google/blog/graphcast-ai-model-for-faster-and-more-accurate-global-weather-forecasting/) | 공식 연구 소개의 예측 범위·평가 조합 비교. 날씨 정확도 90%로 바꾸지 않음 |
| 단백질 설계 | [IPD 공식 소개](https://www.ipd.uw.edu/2022/12/a-diffusion-model-for-protein-design/) | RFdiffusion 원 연구 소개와 공개 초록. 후속 All-Atom·최신 버전과 혼동하지 않음 |
| 유체 대리모델 | [FNO](https://arxiv.org/abs/2010.08895) | 공개 초록의 PDE 예제·해상도 전이. 임의 형상·조건 일반화로 확대하지 않음 |
| 역합성 | [Segler 등, 2018](https://www.nature.com/articles/nature25978) | 원 논문 초록·공개 설명. DOI는 10.1038/nature25978 |
| 고대 비문 | [Ithaca 공식 소개](https://deepmind.google/blog/predicting-the-past-with-ithaca/) | 전사된 고대 그리스어 텍스트의 복원·시대·지역 추정. 이미지 OCR과 구분 |
| 태양광 지도 | [DeepSolar 프로젝트](https://web.stanford.edu/group/deepsolar/ds) | 2018년 프로젝트의 영상 기반 위치·규모 추정. 현재 발전량 통계가 아님 |
| 범고래 음향 | [ORCA-SPOT](https://www.nature.com/articles/s41598-019-47335-w) | 공개 초록과 평가 설명. 시간 기반 PPV와 AUC를 탐지율로 바꾸지 않음 |
| 암 멀티모달 시나리오 | [CLAIM 2020](https://pubs.rsna.org/doi/10.1148/ryai.2020200029) | 영상·표 데이터 설계의 검토 기준. 실제 전이 예측 성과 보고가 아님 |

### 트렌드 자료

| 글 | 근거 | 확인 범위와 주의 |
|---|---|---|
| Co-Scientist | [원 논문](https://www.nature.com/articles/s41586-026-10644-y) | 기존 6개 섹션 보존. 이번에는 공개 출판 메타정보·공식 검색 설명을 확인했으며 전체 본문 재검토로 주장하지 않음 |
| AlphaEvolve | [공개 백서](https://arxiv.org/abs/2506.13131) | 공개 초록과 기존 검토된 6개 섹션 보존 |
| 문헌 검토와 LLM | [Cochrane Handbook 4장](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04) | 검색·선정의 방법론. LLM 성능을 입증하는 비교 시험이 아님 |
| 대리모델 | [FNO](https://arxiv.org/abs/2010.08895) | 공개 초록과 사례 예시. 실제 물리 검증 대체로 해석하지 않음 |
| 적은 예시와 영상 AI | [Segment Anything](https://arxiv.org/abs/2304.02643) | 공개 초록. 프롬프트 분할과 소량 학습 분류를 구분 |
| 분자 확산모델 | [EDM](https://arxiv.org/abs/2203.17003) | ICML 2022 공개 초록. 생성과 합성·활성 검증을 구분 |
| 센서 로그 | [NASA PCoE 데이터](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/) | 공식 저장소 설명. C-MAPSS 시뮬레이션과 실제 센서를 구분 |
| 실험 최적화 | [BoTorch](https://arxiv.org/abs/1910.06403) | 공개 초록과 도구 개념. 현장 안전 제약과 측정은 연구자 책임 |
| 재현성 | [NeurIPS 체크리스트](https://neurips.cc/public/guides/PaperChecklist) | 공식 체크리스트의 재현·보고 항목 |
| 그래프 신경망 | [Distill GNN 해설](https://distill.pub/2021/gnn-intro/) | 메시지 전달의 공개 기술 해설. 새 성능 실험이 아님 |
| 비공개 데이터 | [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) | 2024년 생성형 AI 위험관리 문서의 개인정보·보안 항목. 법률 판단이나 특정 서비스의 현재 약관 확인이 아님 |
| 식품·과수 영상 | [Deep Fruit Detection](https://arxiv.org/abs/1610.03677) | 과수원 검출의 공개 초록. 개수·위치 검출과 품질·식품 안전 판정을 구분 |
| 의료 영상의 한계 | [CLAIM 2020](https://pubs.rsna.org/doi/10.1148/ryai.2020200029) | 2020년 보고 지침. 임상 허가·최신 지침 전체를 확인한 것이 아님 |

## 검증

- 글 구조·보존·용어·노트 자동 테스트 11개 통과.
- TypeScript 타입 검사와 보강 데이터 파일 4개의 ESLint 검사 통과.
- 전체 프론트 프로덕션 빌드 53개 페이지 생성 통과. 기존 미사용 `nickname` 및 `<img>` 최적화 권고 경고는 남아 있으며 이번 콘텐츠 작업에서 수정하지 않았습니다.
- 로컬 브라우저: 31개 상세 URL × 1440/768/390px = 93개 조건. 응답 200, 제목·섹션 수, 가로 넘침 없음, 이미지 로딩, 브라우저 실행 오류 없음 확인.
- 재시작한 개발 서버에서도 동일한 93개 조건을 다시 통과했습니다. `localhost`와 `127.0.0.1` 모두 응답 200을 확인했습니다. 127.0.0.1 검사 시 개발 서버가 향후 Next 버전의 `allowedDevOrigins` 설정 관련 경고를 출력했으나 현재 리소스 로딩·화면 검사는 통과했습니다. 이 작업에서 서버 설정은 변경하지 않았습니다.
- 배터리 글의 용어 풀이 클릭·Enter·Space, 모바일 목차의 역할 섹션 이동·목차 접힘 확인.
- 아래 대표 4개 글을 3개 폭으로 캡처했습니다. 모든 글의 전체 본문을 눈으로 읽은 검수나 모든 필터 조합·로그인 상태·실제 DB 게시 검증은 아닙니다.

| 대표 글 | PC 1440 | 태블릿 768 | 모바일 390 |
|---|---|---|---|
| 세포 분류 시나리오 | [화면](cancer-cell-classification-1440.png) | [화면](cancer-cell-classification-768.png) | [화면](cancer-cell-classification-390.png) |
| 배터리 수명 | [화면](battery-life-1440.png) | [화면](battery-life-768.png) | [화면](battery-life-390.png) |
| 영상 AI 해설 | [화면](few-shot-vision-1440.png) | [화면](few-shot-vision-768.png) | [화면](few-shot-vision-390.png) |
| 비공개 데이터 해설 | [화면](private-data-ai-1440.png) | [화면](private-data-ai-768.png) | [화면](private-data-ai-390.png) |

[측정 결과](measurements.json) · [반복 검증 스크립트](verify-reading.cjs) · [용어 조작](battery-life-glossary-390.png) · [모바일 목차 이동](battery-life-roles-390.png)

## 로컬 실행과 작업 경계

기존 localhost:3000 개발 서버와 별도 127.0.0.1 검증 서버가 함께 실행 중이었습니다. 빌드 이후 기존 서버가 500을 반환하여 사용자의 재시작 허용을 받고, 실행 경로를 확인한 이 프로젝트의 프론트 프로세스만 종료하고 개발 서버를 하나로 재시작했습니다. 공유 빌드 폴더의 영향 가능성이 있어 빌드와 개발 서버를 동시에 실행하지 않았습니다. 백엔드와 DB는 종료하거나 변경하지 않았습니다.

샌드박스에서는 빌드 폴더 생성·서버 바인딩·Chromium 실행이 제한되어, 허용된 별도 실행 권한으로 로컬 빌드와 브라우저 검사를 수행했습니다.

로컬 확인:

- http://localhost:3000/cases/battery-life
- http://localhost:3000/trends/few-shot-vision
- http://localhost:3000/cases/cancer-cell-classification

로그인·관리자·챗봇·DB 전환·DB 게시·유료 API·커밋·push·PR 병합·배포는 수행하지 않았습니다. 이전 미커밋 변경과 기존 PDF 보고서는 보존했습니다.
