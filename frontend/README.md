# WHAT THE LAB · Frontend (Next.js)

웹 프론트엔드는 Next.js 15 · React 19 · TypeScript · Tailwind CSS 4를 사용합니다. 이 문서는 2026-11-02 현재 `feature/expert-search-dark-profile-first-20261031` 브랜치를 기준으로 합니다. `develop` 병합 및 실제 운영 배포 상태와는 구분해 주세요.

## 실행 및 검증

```bash
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run lint
npm run build
```

- 로컬 웹: `http://localhost:3000`
- API 주소: `NEXT_PUBLIC_API_BASE_URL` (미지정 시 `http://localhost:8000/api/v1`)
- 실시간 전문가 검색과 자유게시판 검색은 백엔드 및 DB가 실행되어 있어야 결과가 나옵니다. 데이터가 없다고 임의 결과를 만들어 표시하지 않습니다.

## 통합검색 (2026-11-02)

- 진입: 전역 헤더 검색창 또는 `/search?q=키워드`.
- 고정 순서: **관련 인사이트 → 전문가 찾기 → 자유게시판 → FAQ**.
- 인사이트: `src/lib/insights.ts`의 사례·트렌드 공개 목록(시안용 콘텐츠 포함)을 서버에서 검색합니다.
- 전문가: 기존 `GET /api/v1/experts`의 **공개·활성 전문가**만 노출하며 상세 프로필로 이동합니다.
- 자유게시판: `GET /api/v1/community/posts?scope=public&q=` API로 공개·비숨김 게시글만 조회합니다. 로그인 여부/관리자 여부로 비공개 범위를 넓히지 않습니다.
- FAQ: `src/lib/faq.ts`를 검색하고 개별 답변 앵커로 연결합니다.
- 구현: `src/app/search/page.tsx`, `src/components/unified-search.tsx`, `src/lib/global-search.ts`.
- 테스트: `tests/global-search.test.cjs`; [100개 설계 점검](../docs/qa/global-search-100-question-review-20261102.md).

## 주요 화면

| 화면 | URL | 현재 동작 |
|---|---|---|
| 인사이트 사례 | `/cases` | 공개 사례 목록·상세 |
| 인사이트 트렌드 | `/trends` | 공개 트렌드 목록·상세 |
| 전문가 찾기 | `/experts` | 실제 API 검색·기술/분야 필터·공개 프로필 |
| 통합검색 | `/search` | 네 영역 교차검색 및 원본 화면 연결 |
| 자유게시판 | `/community` | 공개 게시글/로그인 기반 활동 |
| FAQ | `/faq` | 질문·답변 검색 및 앵커 이동 |

## 개발 원칙

- 목록은 비교에 필요한 공개 정보만, 상세 페이지는 추가 맥락을 제공합니다.
- 로딩·빈 결과·실패를 서로 구분하고 색만으로 상태를 표현하지 않습니다.
- API 데이터 계약과 검색 허용 범위를 임의로 확대하지 않습니다.
- **협업 요청은 전문가 상세 프로필에서** 시작하며 통합검색 결과는 요청을 자동 생성하지 않습니다.
- 실제 DB 기반 검색과 시안 인사이트 데이터를 구분합니다.
