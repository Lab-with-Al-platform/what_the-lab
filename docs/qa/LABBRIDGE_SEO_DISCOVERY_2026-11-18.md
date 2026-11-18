# LabBridge 검색 노출 기반과 인사이트 정리 — 2026-11-18

기준: GitHub `develop`의 `954f096cd4dc45ef733c25b6ff8f3093c86b35c6`. 원본 저장소에는 AWS 관련 작업 브랜치가 체크아웃되어 있어 별도의 로컬 작업 사본 `feature/seo-discovery-foundation`에서 변경했다. AWS, 배포, 운영 DB와 환경 파일은 건드리지 않았다.

## 계획과 결과

1. P0: 실제 App Router 경로와 정적 빌드의 URL 처리를 조사하고, 대표 주소·색인 범위를 결정한다.
2. P0: 공개 페이지에만 제목·설명·대표 주소를 주고 `robots.txt`, `sitemap.xml`을 생성한다. 검색 제외 페이지가 자동으로 색인되지 않는지 검사한다.
3. P1: 시안 원고 24편을 출처와 대조한다. 근거가 있는 22편은 정식 해설로 다듬고, 실제 연구 원문이 확인되지 않은 2편은 공개 카탈로그에서 제외한다. 남은 29편에 본문과 일치하는 `Article`만 제공한다.
4. 단위 테스트, 일반 Next 빌드, 정적 빌드, 실제 생성 파일과 로컬 브라우저를 검증한다.

## 색인 정책

| 구분 | 적용 |
| --- | --- |
| 공개 안내 | 홈, 사례·트렌드 목록, 전문가 찾기 목록, FAQ, 게시판 이용 가이드 6개. 공개 도메인이 설정되면 자체 canonical, 제목, 설명을 내보낸다. |
| 공개 인사이트 | 사례 15편·트렌드 14편. 원고에서 근거 범위를 설명하고 안전한 HTTPS 출처 링크가 있는 글만 색인과 `Article`에 포함한다. 사이트맵 합계 35개. |
| 계정·협업·운영 | 로그인·가입·내 이력·연구·워크스페이스·요청·설정·관리자·미리보기는 기본 `noindex, nofollow`. 새 경로도 따로 공개할 때까지 기본값을 따른다. |
| 검색 결과·개별 전문가 | `/search`와 `/experts/[slug]`는 제외한다. 전문가 상세는 정적 빌드에서 같은 번호 자리 페이지를 쓰며, 서버에서 프로필별 공개 상태와 SEO 정보를 확인하지 않는다. |
| 게시판 | `/community`는 공개 목록과 개인·운영 범위를 같은 경로의 쿼리로 구분한다. 정적 HTML이 상태별 메타데이터를 다르게 보낼 수 없어서 가이드를 제외한 목록·상세·작성·편집을 전부 색인에서 제외한다. |
| 정책 설정 | `LABBRIDGE_SITE_URL`을 빌드 전에 공개 HTTPS 원점으로 지정한다(예: 도메인이 확정된 뒤 `https://labbridge.kr`). 값이 없거나 잘못되었거나 Vercel 미리보기면 사이트맵을 비우고 canonical·Article을 내보내지 않는다. 프리뷰/다른 호스팅은 해당 값을 생략한다. |

- 기존에는 루트에 제목 템플릿·공통 설명과 일부 관리자/게시판 `noindex`만 있었고, 글 상세에는 제목·요약만 있었다. 이제 `site-seo.ts`의 공개 목록을 메타데이터와 사이트맵이 함께 사용한다. 예를 들어 `/cases?topic=AM-03`의 대표 주소는 `/cases`다.
- `robots.txt`는 사이트맵 위치와 API 크롤링 제한만 알린다. 비공개 페이지의 `noindex`를 로봇이 읽어야 하므로 페이지 경로를 차단하지 않는다. 실제 보호는 기존 로그인·서버 권한 검사에 맡긴다. [Google의 noindex 설명](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- Next 메타데이터 파일은 `force-static`으로 출력한다. 정적 주소 규칙이 `robots.txt`를 페이지 이동용 .txt로 오인하지 않도록 저장소의 템플릿에 예외를 넣었다. AWS에는 적용하지 않았다.
- `Article`은 제목, 요약, 한국어, 대표 주소, 본문의 출처 링크로 시작한다. 본문에서 실제 확인할 수 있는 값만 보낸다. FAQ 스키마, 검색 결과, 프로필, 게시판·관리자에는 구조화 데이터를 달지 않았다. 근거 없는 `lastmod`, 노출 순위 약속, 특정 AI 크롤러 정책도 추가하지 않았다. [Google Article 안내](https://developers.google.com/search/docs/appearance/structured-data/article) · [AI 검색 안내](https://developers.google.com/search/docs/appearance/ai-features)

## 공개 원고의 근거와 편집 원칙

원고 31편을 대조했다. 기존 실증·해설 7편은 보존하고, 기존에 원문 중심으로 보강된 시안 22편은 출판 형태로 정리했다. 각 상세 상단에 출처 종류와 **출처로 확인할 수 있는 범위**를 표시해 원문에 나온 일, LabBridge의 해석, 추가 검증이 필요한 일을 구분한다. 문헌 검토·실험 최적화 등 공식 지침 또는 대표 연구를 바탕으로 쓴 글은 기술·연구 방법 해설로 명시했다. 기존 글마다 URL과 키워드 분류는 유지했다. 일부 제목·요약은 원문 범위에 맞게 좁혔다. 논문 서지, 공개 초록·본문 또는 공식 연구 자료를 대조했으며 모든 원문의 실험을 재현하거나 분야 전문가의 최종 검토를 받은 것은 아니다.

| 필드 | 공개 기준 |
| --- | --- |
| 출처·DOI | 장식용 링크가 아니라 글의 설명을 뒷받침하는 논문 또는 공식 자료를 연결한다. 제목 옆과 본문에서 독자가 확인할 수 있고 기계용 정보에도 같은 출처를 쓴다. |
| 작성자 | 실제 LabBridge 작성자 이름과 개인/단체 유형을 확인한 뒤 `editorial.author`에 기록한다. 원 논문 저자·연구기관을 기사 작성자로 사용하지 않는다. |
| 발행일 | 기존 `publishedOn`은 목록 정렬에만 유지한다. 확인된 LabBridge 기사 발행일만 `editorial.publishedOn`으로 화면과 JSON-LD에 보인다. |
| 검토일 | 편집 검토 기록에 근거가 있을 때만 `editorial.reviewedOn`에 기록하고 본문에 표시한다. 이를 수정일이라고 추정하지 않는다. 현재 공개 카탈로그에서 기사 작성자·기사 발행일·검토일은 확인된 값을 구별할 수 없어 채우지 않았다. 이번 작업일은 이 보고서에만 기록한다. |

공개 제외:

- `/cases/cancer-cell-classification`: 특정 세포 분류 성과를 입증하는 원 논문을 식별할 수 없었다. 연결되었던 CLAIM은 의료영상 AI 연구의 보고 지침이다.
- `/cases/metastasis-multimodal`: 글의 전이 조기 예측 연구를 뒷받침하는 원 논문이 없었다. 동일한 [CLAIM 원 지침](https://pubs.rsna.org/doi/full/10.1148/ryai.2020200029)은 방법 참고 자료다.
- 제거한 주소는 목록·통합검색·글 연결 목록·사이트맵·정적 HTML에서 사라진다. 기존 게시판 DB의 글은 삭제하지 않았다. 기존 정적 주소 규칙은 없는 파일을 `/404.html`로 보낸다. HTTP 상태를 바꾸는 운영 작업은 범위 밖이다.

근거가 있어 정식 해설로 전환한 22편:

| 글 주소의 마지막 부분 | 확인에 사용한 자료 |
| --- | --- |
| `microscope-cell-drawing` | [원 논문 또는 공식 자료](https://www.nature.com/articles/s41592-020-01018-x) |
| `eeg-behavior` | [원 논문 또는 공식 자료](https://pubmed.ncbi.nlm.nih.gov/29932424/) |
| `protein-structure` | [원 논문 또는 공식 자료](https://www.nature.com/articles/s41586-021-03819-2) |
| `battery-life` | [원 논문 또는 공식 자료](https://www.nature.com/articles/s41560-019-0356-8) |
| `weather-graph` | [원 논문 또는 공식 자료](https://deepmind.google/research/publications/22598/) |
| `protein-design` | [원 논문 또는 공식 자료](https://doi.org/10.1038/s41586-023-06415-8) |
| `fluid-simulation` | [원 논문 또는 공식 자료](https://arxiv.org/html/2010.08895v3) |
| `retrosynthesis` | [원 논문 또는 공식 자료](https://www.nature.com/articles/nature25978) |
| `ancient-inscription` | [원 논문 또는 공식 자료](https://doi.org/10.1038/s41586-022-04448-z) |
| `solar-panels` | [원 논문 또는 공식 자료](https://www.sciencedirect.com/science/article/pii/S2542435118305701) |
| `orca-audio` | [원 논문 또는 공식 자료](https://www.nature.com/articles/s41598-019-47335-w) |
| `literature-review-llm` | [원 논문 또는 공식 자료](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04) |
| `surrogate-models` | [원 논문 또는 공식 자료](https://arxiv.org/html/2010.08895v3) |
| `few-shot-vision` | [원 논문 또는 공식 자료](https://arxiv.org/html/2304.02643v1) |
| `diffusion-molecules` | [원 논문 또는 공식 자료](https://arxiv.org/abs/2203.17003) |
| `sensor-logs` | [원 논문 또는 공식 자료](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/) |
| `experiment-optimization` | [원 논문 또는 공식 자료](https://arxiv.org/abs/1910.06403) |
| `reproducibility-checklist` | [원 논문 또는 공식 자료](https://neurips.cc/public/guides/PaperChecklist) |
| `graph-neural-nets` | [원 논문 또는 공식 자료](https://distill.pub/2021/gnn-intro/) |
| `private-data-ai` | [원 논문 또는 공식 자료](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) |
| `food-image-quality` | [원 논문 또는 공식 자료](https://arxiv.org/abs/1610.03677) |
| `medical-imaging-limits` | [원 논문 또는 공식 자료](https://pubs.rsna.org/doi/full/10.1148/ryai.2020200029) |

## 검증 기록

| 확인 | 결과 |
| --- | --- |
| 변경 전 프론트엔드 테스트 | 182개 통과 |
| 변경 후 프론트엔드 테스트 | 187개 통과. 색인 설정·미설정·미리보기·출처 스키마, 시안 제외와 주소 규칙을 포함한다. |
| 린트·타입 | 새 오류 없음. 린트 기존 경고 3건(가입 완료 페이지의 미사용 변수, 기존 홈 이미지 2건). 두 빌드의 타입 검사 통과. |
| 게시판 글 연결 목록 | 29개 제목·종류·URL이 공개 원고와 일치. |
| 일반 Next 빌드와 로컬 HTTP | 통과. 도메인 미지정일 때 홈·글·개인 경로에 `noindex`, 빈 사이트맵, 대표 주소/Article 없음. 제외한 두 글은 HTTP 404. |
| 정적 빌드와 산출물 검사 | 통과. 사이트맵 35개, Article 29개, `noindex` HTML 32개. robots와 sitemap의 MIME과 URL, 검색 필터의 대표 주소, 비공개 경로·제외한 두 글의 `noindex`를 로컬 HTTP에서 확인했다. 기존 정적 미리보기는 빠진 글에도 404 화면을 HTTP 200으로 제공한다. |
| 브라우저 화면 | Cellpose 기사·트렌드 목록을 1440×900, 768×1024, 390×844에서 각각 캡처했다. P0 상세 시안의 제목→메타→요약 흐름과 비교했고, 기존 공통 로고 이미지가 390px에서 두 화면 모두 16px 가로로 넘치는 문제를 확인했다. 이 변경은 공통 로고를 수정하지 않는다. 캡처 6장은 작업 공간 `output/labbridge-seo-qa`에 있다. |

Windows의 기존 빌드 출력 폴더에서 `EPERM` 오류가 나면 해당 작업 사본의 생성 폴더를 비운 상태에서 재실행해야 할 수 있다. 최종 일반·정적 빌드는 모두 완료했다.

로컬에서 같은 설정을 재현하려면 `frontend`에서 아래 명령을 실행한다. `.example` 주소는 검증용이며 실제 접속하지 않는다.

```powershell
$env:LABBRIDGE_SITE_URL = 'https://labbridge.example'
npm.cmd run build:static
node scripts/check-seo-output.cjs
npm.cmd run check:community-links
```

운영 배포 이후에만 실제 도메인, HTTP 상태·캐시·리디렉션, 검색 콘솔의 색인과 캐노니컬 선택 결과를 확인할 수 있다. 로그인, 회원 데이터, DB 이력과 게시물은 이번 로컬 QA에서 운영 상태로 검증하지 않았다.
