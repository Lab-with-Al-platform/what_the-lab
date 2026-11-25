# V2 최종 검증 4회

검증 기준일: 2026-10-25. 아래는 실제 실행 범위이며 실제 운영 환경의 무결점 배포를 보증하지 않습니다.

## 1차 — 전체 자료·파일·공통 계약

- 원본 729개 파일 재개방·추출본 바이트 대조: 오류 0. 텍스트 358·이미지 358·PDF 11·XLSX 2. 회의 HTML도 전체 확인.
- 모든 Python 원본 AST, JSON 파싱, 이미지 전체 픽셀, 모든 PDF 페이지 텍스트·렌더, XLSX 모든 시트·수식 셀 검사. `SOURCE_FILE_AUDIT.csv`.
- 기존 JWT·회원 BIGINT·공통 DB·Next 경로·디자인 토큰·프로필/전문가 검색·인사이트 관리자 경계를 대조. `SOURCE_COMPATIBILITY.md`.
- `npm run check:community-links`: 실제 공개 원고 31개의 제목·종류·경로 전체 일치.

## 2차 — 권한·입력·데이터 무결성

- Python 3.13.16, 원본 uv.lock 고정 설치. 백엔드 전체 `pytest -q`: **197 passed, 3 skipped**.
- 생략 3개는 전용 native PostgreSQL이 필요한 기존 인사이트 동시성 1개와 새 게시판 동시성 2개. 이들을 통과했다고 표시하지 않습니다.
- 별도 PGlite 0.5.11 / PostgreSQL 18.6 WASM 엔진: 실제 Alembic 전체 6개 이력 → `20261025_06` 적용. 8개 표 RLS, 세 브라우저 역할의 직접 SELECT 거부, BIGINT 가상 회원, 한국어 JSON 태그, FastAPI+psycopg CRUD, 같은 글 댓글만 채택하는 FK 실행 확인.
- 이 PostgreSQL 호환 엔진은 단일 연결입니다. native Supabase 다중 서버 동시성·pooler·실제 회원 데이터 검증을 대신하지 않습니다.
- 프론트 `npm test`: **45 passed**. 기존 인사이트 검사 포함. 안전한 본문·FAQ·날짜·캐시·실제 공개 원고·HTTP 환경 UUID 등 검사.

## 3차 — 실제 화면·사용 흐름·반응형

실제 Next.js와 FastAPI를 격리된 SQLite·가상 JWT 회원으로 연결했습니다. 실제 Discord 또는 운영 계정을 사용하지 않았습니다. QA 계정 선택 경로·가상 데이터 입력 코드는 배포 묶음에서 제외합니다.

실제 화면에서 공개 글 입력·나가기 확인·계속 작성·등록 확인·등록 후 상세 이동, 내 글·비공개 문의, 다른 회원의 비공개 URL 차단, 공개 댓글·공감·저장, 관리자 비공개 답변을 확인했습니다. 작성자의 새 답변 알림·모두 읽음·해결 답변 채택, FAQ 검색(비공개 8건)·앵커 자동 펼침·검색 조건 없는 공유 링크 복사도 확인했습니다.

목록·FAQ·작성·상세 4화면 × 390/768/1440px: 실제 내용과 H1이 렌더된 뒤 documentElement의 scrollWidth=clientWidth를 확인했습니다. 세 폭의 내부 client 폭은 스크롤바 제외 375/753/1425px이며 모두 넘침이 없습니다. 실제 모바일 기기의 터치·가상 키보드/스크린리더 검증과 구분합니다. 1440/390px 캡처와 12개 폭별 수치는 패키지 verification/에 동봉합니다. 768px은 DOM 레이아웃 검사를 통과했지만 브라우저 캡처가 빈 화면/시간 초과로 실패하여 시각 캡처 검수를 미완료로 기록합니다. 실제 기기 확인은 별도 필요합니다.

발견·수정: HTTP 미리보기에서 crypto.randomUUID 미지원으로 작성 화면이 중단되던 문제를 Web Crypto getRandomValues 기반 v4 token으로 수정. 문서 제목의 브랜드 중복, 모바일 태그 조작 공간, 확인창 모드를 함께 보강했습니다.

## 4차 — 타입·린트·프로덕션 빌드·적용 묶음

- TypeScript, 신규 frontend ESLint 경고 0, 신규 backend Ruff 통과.
- Next 프로덕션 빌드: 전체 61개 정적 생성 완료. 기존 가입 페이지 미사용 nickname 1건 및 헤더 img 2건 경고는 기존 코드에 남아 있습니다.
- 적용기 독립 검사 8개: 읽기 전용 비교, 적용/백업/재적용, V1 허용, 팀 변경 중단, 공통 계약 drift, 심볼릭 링크·패키지 변조 거부, 실패 복구, 복구 중 동시 수정 보존 통과.
- 원본 ZIP에서 새로 푼 사본과 V1 사본에 각각 dry-run 무변경, 52개 파일 적용 해시 일치, 비대상 파일 보존, 재적용 무변경, 공통 인증 파일 drift 시 전체 중단을 확인했습니다. 최종 ZIP의 CRC·누락·전체 소스 바이트 대조도 패키징 검사에 포함합니다.

## 공개 출시 전에 실제 환경에서 확인할 항목

1. 실제 Supabase 백업 후 04/05/06 revision·서버 DB 역할·RLS·직접 API 차단 확인. 전용 native PostgreSQL 두 연결 검사 실행.
2. HTTPS 프론트/API/OAuth callback·Secure 쿠키·정확한 Origin·프록시 설정, 실제 두 회원과 관리자 로그인/만료/로그아웃 확인.
3. 개인정보 처리·보존 기간·탈퇴 시 데이터 처리·신고 운영 담당, DB 백업 복구 및 호스팅 장애 대응 확인.
4. 실제 iOS/Android 및 스크린리더·확대 화면에서 입력/대화상자/탐색 확인. iframe 폭 검사는 실제 기기와 같지 않습니다.

실제 외부 배포·원격 DB 적용·계정 권한 승격·초대 메시지 발송은 실행하지 않았습니다.

## 검증 도구·출처

- HTTP 환경 token 생성: [Web Cryptography Level 2](https://www.w3.org/TR/webcrypto/) 및 [MDN getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).
- PostgreSQL 호환 실행의 한계: [PGlite Socket 공식 문서](https://pglite.dev/docs/pglite-socket). 단일 연결 다중화는 native PostgreSQL 동시 트랜잭션과 다릅니다.
- 실제 앱 QA를 위해 관리형 미리보기의 실행 인수를 변환하는 별도 실행기를 사용했습니다. 앱 소스는 98개 frontend·52개 backend 파일 바이트 대조 후 테스트했으며, 실행기·가상 로그인 경로·가상 DB·런타임/의존성 복사본은 납품 소스에 포함하지 않습니다.
