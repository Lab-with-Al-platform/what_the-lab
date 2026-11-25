# WHAT THE LAB · 자유게시판 전체 인터페이스 및 연동 구조 개편
**2026-10-31 · Category-first navigation / My Community menu · PR #72 Feature 브랜치**

> **대상**: 자유게시판을 처음 보는 팀원, 기획·디자인·프론트엔드·백엔드·운영 담당자.  
> **실제 구현과 향후 권고를 분리**해 표시합니다. 아래 100개는 '검토 질문'이지 자동 테스트 100건을 의미하지 않습니다.

## A. 결정 요약 — 왜 이렇게 바꿨나?

**기존의 혼합형 내비게이션을 '공개 콘텐츠 탐색'과 '개인 계정 활동'으로 분리**했습니다.

- **왼쪽 고정 사이드바(데스크톱)**: 전체 대화 · 질문·도움 · 경험 공유 · 아이디어·제안 · 오류·문의 · 자유 이야기 · 공지
- **우측 상단 내 프로필 → MY COMMUNITY**: 내가 쓴 글·문의 · 저장한 글 · 내 글의 새 답변. **연구자·AI 전문가 모두 동일**.
- **모바일**: 사이드바 대신 `details` 접이식 카테고리. 개인 메뉴는 헤더 프로필 / 전체 계정 메뉴.
- **관리자 전용**: 별도 MANAGEMENT/COMMUNITY ADMIN 영역에 비공개 문의함·신고·숨김 관리. `is_admin` 확인은 여전히 서버가 담당.
- **유지**: 글쓰기·상태/태그/검색·정렬·미답변 체크·페이지·FAQ·답변 채택·공감·저장·비공개 문의·알림·관련 전문가 검색.

### UX 변경 전과 후

```text
변경 전
 ├─ 왼쪽: 전체 대화 / 내 글 / 저장 / 새 답변 / 관리자
 └─ 본문 위: 전체 / 질문·도움 / 경험 / 제안 / 오류 / 자유 / 공지 (가로 칩)

변경 후
 ├─ 왼쪽 데스크톱: 전체 대화 / 질문·도움 / 경험 / 제안 / 오류 / 자유 / 공지
 ├─ 본문: 검색 · 상태 · 정렬 · 미답변 → 글 목록
 ├─ 우측 상단 내 프로필 → MY COMMUNITY
 │   ├─ 내가 쓴 글·문의 (/community?scope=mine)
 │   ├─ 저장한 글 (/community?scope=saved)
 │   └─ 내 글의 새 답변 (/community?scope=notifications)
 └─ 모바일: 글 카테고리 접기식 / 내 활동은 헤더 계정 메뉴
```

## B. 데이터 흐름 · 실제 보안 경계

```text
사용자 클릭
   ├─ 카테고리 → /community?category=question
   │                  ↓ GET /api/v1/community/posts?scope=public&category=question
   │                  ↓ PostgreSQL community_private.posts (공개/비숨김만)
   │                  ↓ 제목·요약·태그·상태·글 목록
   │
   ├─ 프로필 → '내가 쓴 글·문의' → /community?scope=mine
   │                  ↓ 인증된 user_id로 소유 글만 서버 조회
   ├─ 프로필 → '저장한 글' → /community?scope=saved
   │                  ↓ 인증된 user_id + Bookmark 교집합
   ├─ 프로필 → '내 글의 새 답변' → /community?scope=notifications
   │                  ↓ GET /api/v1/community/notifications
   │                  ↓ 사용자의 새 답변 목록 (협업 알림 종과 분리)
   └─ 관리자 → inbox / moderation
                      ↓ is_admin=true 권한 검증 후 운영 데이터 조회
```

**URL 전환 규칙**
- 공개 카테고리 선택 시 `scope`를 반드시 제거. 관리자/개인 목록이 공개 탐색에 섞이지 않음.
- **공개 목록 내부 전환일 때만** `q`, `order`, `status`, `unanswered`를 유지. 개인/관리자 scope에서 공개 분류로 이동하면 민감할 수 있는 검색어와 필터를 지움.
- `page`는 초기화하여 잘못된 페이지로 이동 방지. 기존 세부 `tag`는 해제하여 다른 범주에서 의도치 않은 0건 방지.
- 서버 분류는 기존 `CATEGORIES`의 6개 코드와 동일. 어떤 새 사용자 역할이나 데이터베이스 테이블도 생성하지 않음.

**권한을 UI에서만 판정하지 않습니다.** `backend/app/routers/community.py`의 `scope=public/mine/saved/inbox/moderation`과 `community/service.py`의 `readable(user)`가 공개·비공개·삭제·숨김 데이터를 검사합니다. 잘못된 URL을 열어도 운영 데이터가 보이면 안 됩니다.

## C. 변경 파일과 담당 영역

| 파일 | 이번 개편 적용 내용 |
|---|---|
| `frontend/src/lib/community-navigation.ts` | 6개 카테고리, 내 활동 3개, 관리자 2개를 공통 메뉴로 정의. 안전한 공개 URL 전환 |
| `frontend/src/components/community/community-ui.tsx` | 왼쪽 카테고리 내비게이션 + 관리자 별도 그룹 + 모바일 접이식 목록 |
| `frontend/src/components/community/community-board.tsx` | 본문 가로 카테고리 탭 제거, 현재 카테고리 제목·검색·필터 연결 |
| `frontend/src/components/community/community.module.css` | 라이트 디자인 세로 메뉴, 선택 상태, 반응형 2열 모바일 메뉴 |
| `frontend/src/components/site-header.tsx` | PC·모바일 상단 마이메뉴에 내 글·저장·새 답변 진입 연결 |
| `frontend/src/lib/faq.ts` | '저장한 글과 새 답변' FAQ에서 새 경로 설명 |
| `frontend/tests/community-navigation.test.cjs` | URL·메뉴 권한·반응형·기존 게시판 동작 회귀 자동 검사 |

**의도적으로 변경하지 않은 주요 시스템**: `backend/app/routers/community.py`, `community/service.py`, `community/models.py`, 기존 Postgres schema, 로그인 쿠키, 실제 협업 요청 및 LAB TRUST. 관리자 조건과 개인정보는 원래 서버 규칙을 유지.

## D. 100개 연쇄 질문·검증 근거

| 번호 | 검토 질문 | 설계 판단 / 해법 | 상태 | 코드·자료 |
|---:|---|---|---|---|
| **01. 화면 구조와 정보 설계** |  |  |  |  |
| 1 | 왜 가로 카테고리를 왼쪽으로 옮기나? | 가로 칩과 검색 필터의 경쟁을 줄이고 게시판 탐색 정보를 한 지점에 모은다. | 구현 | `community-board.tsx / community-ui.tsx` |
| 2 | 카테고리와 개인 활동을 왜 분리하나? | 카테고리는 공개 대화를 분류하고, 내 글·저장은 사용자별 보호된 조회 범위이기 때문이다. | 구현 | `community-navigation.ts` |
| 3 | 왼쪽 사이드바에는 어떤 정보가 남나? | 전체 대화 및 6개 공개 분류, 안내·도움말, 관리자라면 관리 전용 메뉴를 둔다. | 구현 | `CommunitySidebar` |
| 4 | 가로 탭이 중복으로 남아 있지는 않나? | 본문 상단 글 종류 탭을 삭제하고 사이드바의 단일 카테고리 탐색으로 통합한다. | 구현 | `community-board.tsx` |
| 5 | 카테고리 순서는 어떤 기준으로 정하나? | 질문→경험→제안→오류·문의→자유→공지의 기존 서버 분류 순서를 유지해 익숙함을 보전한다. | 구현 | `community.CATEGORIES` |
| 6 | 왜 글쓰기 진입 카드는 보존하나? | 사용자의 첫 과업은 게시판 탐색뿐 아니라 질문·제안·비공개 문의 작성이기도 하기 때문이다. | 구현 | `community-board.tsx entryGrid` |
| 7 | 빈 게시판에서 가상의 글을 만들지 않나? | 실제 API가 반환한 0건을 있는 그대로 보여 주며 작성 유도와 샘플 콘텐츠를 분리한다. | 기존 유지 | `community-board.tsx empty` |
| 8 | 카테고리 제목도 본문과 맞나? | 공개 글 목록 제목을 활성 카테고리명으로 바꿔 탐색 중인 범주를 명시한다. | 구현 | `communityCategoryLabel` |
| 9 | 도움말·이용 가이드는 사라지지 않나? | 기존 /faq, /community/guidelines 및 공개 질문 유도 링크를 보존한다. | 기존 유지 | `community-ui.tsx` |
| 10 | 기능 범위가 협업 요청까지 확대되나? | 아니다. 게시판 댓글/답변이 연구자→전문가 직접 협업 요청을 자동 생성하지 않도록 유지한다. | 기존 유지 | `docs/community/README.md` |
| **02. 검색·필터·URL 상태** |  |  |  |  |
| 11 | 카테고리를 누르면 실제 데이터가 바뀌나? | 내부 /community?category=... 링크가 기존 GET /community/posts 의 category 조건으로 전달된다. | 구현 | `community-board.tsx + backend routers/community.py` |
| 12 | 선택한 카테고리를 새로고침해도 유지하나? | 카테고리 선택을 컴포넌트 내부 임시 상태가 아니라 URL 쿼리로 보존한다. | 구현 | `communityCategoryHref` |
| 13 | '전체 대화'로 돌아오려면? | category 쿼리를 제거해 공개 전체 목록을 조회한다. | 구현 | `communityCategoryHref` |
| 14 | 비공개 문의함에서 카테고리를 클릭하면? | scope=inbox를 제거해 공개 목록으로 이동시키며 비공개 범위를 카테고리에 끼워 넣지 않는다. | 구현 | `communityCategoryHref` |
| 15 | 내가 쓴 글 화면에서 카테고리를 클릭하면? | scope=mine을 제거하고 공개 카테고리를 연다. 개인 목록 필터와 혼동하지 않는다. | 구현 | `communityCategoryHref` |
| 16 | 기존 검색어는 카테고리 전환 시 사라지나? | q는 보존해 탐색의 맥락을 유지한다. | 구현 | `communityCategoryHref` |
| 17 | 정렬과 상태 필터는? | 공개 목록 내부에서만 order·status·unanswered를 유지한다. 개인/관리자 scope에서는 공개 전환 시 초기화한다. | 구현 | `communityCategoryHref` |
| 18 | 왜 페이지 번호는 지우나? | 이전 카테고리의 8페이지가 새 카테고리에서는 존재하지 않을 수 있으므로 page를 초기화한다. | 구현 | `communityCategoryHref` |
| 19 | 왜 이전 태그를 제거하나? | 타 범주의 세부 태그 조건으로 신규 카테고리 결과가 이유 없이 비는 것을 예방한다. | 구현 | `communityCategoryHref` |
| 20 | 비정상 category 값이 들어오면? | 서버는 미지원 카테고리를 422로 거절하며 화면에는 재선택 가능한 합법 분류를 계속 제공한다. | 기존 유지 | `backend/app/routers/community.py` |
| **03. 내 프로필·개인 활동 메뉴** |  |  |  |  |
| 21 | 이동할 항목은 정확히 무엇인가? | 내가 쓴 글·문의, 저장한 글, 내 글의 새 답변 세 가지이다. | 구현 | `COMMUNITY_ACTIVITY_LINKS` |
| 22 | 왜 계정 메뉴로 옮기나? | 여러 게시판 공용 분류와 다른, 본인의 계정·기록 관리 목적이기 때문이다. | 구현 | `site-header.tsx` |
| 23 | 연구자와 전문가 모두 접근하나? | 역할별 기존 메뉴 뒤에 동일한 MY COMMUNITY 링크를 추가한다. | 구현 | `site-header.tsx` |
| 24 | PC에서는 어느 위치인가? | 헤더 우측 닉네임·사진 클릭 → 계정 드롭다운 내 별도 MY COMMUNITY 그룹이다. | 구현 | `site-header.tsx` |
| 25 | 모바일은 어떻게 접근하나? | 헤더 계정 메뉴가 기본 경로이며 햄버거 전체 메뉴에도 동일한 링크를 넣는다. | 구현 | `site-header.tsx` |
| 26 | 로그인하지 않으면 개인 메뉴가 보이나? | 비로그인 상태에서는 기존 Discord 로그인 CTA가 표시되며 개인 링크를 보여 주지 않는다. | 구현 | `site-header.tsx` |
| 27 | 가입 중인 사용자에게도 내 글 링크를 보여 주나? | signup_step=done이 아니면 가입 이어하기 중심으로 표시해 잘못된 권한 기대를 피한다. | 구현 | `site-header.tsx` |
| 28 | 해당 링크를 누르면 DB가 바뀌나? | 기존 읽기 전용 scope 조회로 이동하며 단순 메뉴 클릭은 데이터 쓰기를 실행하지 않는다. | 기존 유지 | `backend/app/routers/community.py` |
| 29 | 계정 메뉴를 눌러 다른 페이지로 가면 닫히나? | 클릭 후 setProfileOpen(false), 모바일은 setMenuOpen(false)를 실행한다. | 구현 | `site-header.tsx` |
| 30 | 내 활동 항목을 아예 삭제했나? | 아니다. 메뉴의 진입 위치만 변경하고 기존 URL과 목록/알림 기능은 유지한다. | 구현 | `community-navigation.ts` |
| **04. 개인정보·로그인·공개 범위** |  |  |  |  |
| 31 | 비회원도 공개 글을 볼 수 있나? | 공개/숨기지 않은 게시글만 읽게 하는 기존 서버 규칙을 보존한다. | 기존 유지 | `community/service.py readable` |
| 32 | 비공개 문의 제목이 공개 카테고리에 나타나나? | public scope는 visibility=public과 hidden=false를 서버에서 강제한다. | 기존 유지 | `routers/community.py posts` |
| 33 | 내가 쓴 비공개 글은 어디서 보나? | 로그인 당사자만 scope=mine에서 자신의 공개·비공개 글을 본다. | 기존 유지 | `routers/community.py posts` |
| 34 | 다른 사람의 scope=mine을 URL로 위조하면? | user ID는 JWT 기반 서버 사용자에서 가져오며 URL 임의 ID를 신뢰하지 않는다. | 기존 유지 | `community/access.py` |
| 35 | 저장한 비공개 글이 타 계정에 노출되나? | 서버 조회는 소유 북마크와 readable(user) 교집합으로 제한한다. | 기존 유지 | `community/service.py` |
| 36 | 알림에 다른 사람의 댓글이 섞이나? | 새 답변 API가 인증된 회원의 notification 레코드만 조회하도록 구현돼 있다. | 기존 유지 | `routers/community.py notifications` |
| 37 | 전문가와 연구자의 계정 역할이 접근 보안의 근거인가? | 게시판 일반 권한은 계정 인증·소유권이 우선이며 운영자 기능만 공통 is_admin을 요구한다. | 기존 유지 | `community/access.py` |
| 38 | 헤더의 메뉴 숨김만으로 권한을 보장하나? | 아니다. API는 별도로 401·403·404를 판정한다. UI 숨김은 UX 보조다. | 기존 유지 | `community/access.py` |
| 39 | 삭제된 글 제목·본문은 노출될 수 있나? | 삭제 상태 조회 차단과 제목/본문 비우기 등 기존 서버 규칙을 유지한다. | 기존 유지 | `routers/community.py` |
| 40 | 클라이언트가 민감 데이터를 저장해 두나? | 기존 no-store API, 로컬 스토리지 미저장 원칙을 유지한다. 실제 보존정책은 별도 결정해야 한다. | 기존 유지 | `docs/community/README.md` |
| **05. 관리자·신고·운영** |  |  |  |  |
| 41 | 기존 관리자 기능은 사라지나? | 비공개 문의함과 신고·숨김 관리를 별도 MANAGEMENT 그룹으로 보존한다. | 구현 | `CommunitySidebar` |
| 42 | 관리자 메뉴는 일반 이용자도 볼 수 있나? | 사이드바는 community/me.is_admin, 계정 메뉴는 auth/me.is_admin일 때만 렌더링한다. | 구현 | `community-ui.tsx / site-header.tsx` |
| 43 | 관리자 페이지에 URL 직접 접근할 수 있나? | 서버가 is_admin을 별도로 확인하므로 일반 계정은 403을 받는다. | 기존 유지 | `routers/community.py` |
| 44 | 관리자 메뉴가 개인 메뉴와 섞이나? | MY COMMUNITY와 COMMUNITY ADMIN을 계정 드롭다운에서 명확히 분리한다. | 구현 | `site-header.tsx` |
| 45 | 관리자 비공개 문의가 공개 검색에 노출되나? | inbox 조회는 별도 권한 범위이며 공개 category 이동 시 scope를 강제로 해제한다. | 구현+기존 유지 | `communityCategoryHref + routers/community.py` |
| 46 | 공지 작성은 일반 회원도 할 수 있나? | 아니다. 서버의 공지 작성 is_admin 요구 및 공개 범위 조건을 유지한다. | 기존 유지 | `community/service.py validate_content` |
| 47 | 신고 후 자동 삭제가 발생하나? | 기존 운영 검토·숨김/복구 정책을 유지하며 신고만으로 자동 삭제하지 않는다. | 기존 유지 | `community/routers.py` |
| 48 | 관리자에서 공개 카테고리로 나올 수 있나? | 어느 관리 scope에서든 카테고리 선택 시 공개 목록으로 전환된다. | 구현 | `communityCategoryHref` |
| 49 | 관리자에게 게시글 작성자 정보가 더 보이나? | 기존 관리자 권한 범위만 유지하고 새 개인정보 API나 표시 항목은 추가하지 않는다. | 기존 유지 | `backend/app/community/service.py` |
| 50 | 운영 담당자가 필요한가? | 실제 비공개 문의·신고 대응에는 담당·SLA·보존/삭제 정책 확정이 필요하다. | 운영 필요 | `docs/community/BENCHMARK_AND_GROWTH.md` |
| **06. 글쓰기·댓글·알림** |  |  |  |  |
| 51 | 게시판 메뉴 개편으로 글쓰기 동선이 끊기나? | 상단 글쓰기 버튼과 질문/아이디어/비공개 문의 진입 카드를 유지한다. | 구현 | `community-board.tsx entryGrid` |
| 52 | 기존 글 작성의 카테고리 선택과 일치하나? | 기존 CATEGORIES와 동일한 여섯 종류를 사용한다. | 구현 | `community.CATEGORIES + community-navigation.ts` |
| 53 | 비공개 문의가 글쓰기에서 공개로 전환되나? | 기존 private visibility 파라미터·작성 화면 선택·서버 조건을 보존한다. | 기존 유지 | `community-composer.tsx` |
| 54 | 게시글을 열고 수정할 수 있나? | 기존 /community/{id}, /edit 경로와 서버 소유권 규칙을 변경하지 않는다. | 기존 유지 | `community-detail.tsx` |
| 55 | 댓글·답변 채택·공감은 유지되나? | 내비게이션 이동 외에는 기존 상세/댓글/리액션 코드 수정하지 않는다. | 기존 유지 | `community-detail.tsx` |
| 56 | 저장 목록은 실제 북마크와 연결되나? | scope=saved는 기존 Bookmark 사용자의 선택 데이터만 반환한다. | 기존 유지 | `routers/community.py` |
| 57 | '내 글의 새 답변'은 알림 종으로 옮겼나? | 아니다. MY COMMUNITY 메뉴에서 게시판 알림을 조회하며 협업 알림 종과 분리한다. | 구현 | `site-header.tsx` |
| 58 | '모두 읽음' 처리는 유지되나? | 기존 /community/notifications/read 쓰기 API와 에러 피드백을 보존한다. | 기존 유지 | `community-board.tsx readAll` |
| 59 | 저장과 댓글 이벤트를 Discord DM으로 발송하나? | 아니다. 게시판 알림은 서비스 내부에서만 다루며 외부 전송을 추가하지 않았다. | 기존 유지 | `faq.ts` |
| 60 | 글 삭제 후 목록에 남을 수 있나? | 기존 서버의 삭제·조회 규칙을 유지한다. 새 로컬 캐시를 도입하지 않는다. | 기존 유지 | `community/service.py` |
| **07. 프로젝트 전체와의 연결** |  |  |  |  |
| 61 | 게시판 글 태그로 전문가 검색이 가능한가? | 기존 공개 태그→/experts?q=... 이동을 유지한다. | 기존 유지 | `community-detail.tsx / community-integration.test.cjs` |
| 62 | 게시판 질문에서 협업이 자동 확정되나? | 아니다. 등록 연구 선택→전문가 상세 요청→요청관리의 직접 요청 B 경로를 유지한다. | 기존 유지 | `README.md` |
| 63 | AI 연구 사례로부터 질문을 시작할 수 있나? | 기존 사례/트렌드 CTA가 공개 콘텐츠 링크만 게시판 작성 화면에 전달한다. | 기존 유지 | `community-composer.tsx` |
| 64 | 개인 연구 원문이 게시판으로 자동 입력되나? | 아니다. 비공개 연구 데이터 자동 유입 금지 원칙을 유지한다. | 기존 유지 | `docs/community/README.md` |
| 65 | 사이트 헤더의 자유게시판·FAQ 링크는 그대로인가? | 전역 NAV_ITEMS를 수정하지 않고 프로필 개인 메뉴만 추가했다. | 구현 | `site-header.tsx` |
| 66 | 로그인은 Discord OAuth를 그대로 쓰나? | 기존 JWT 쿠키 및 /auth/me 재사용, 새 계정/비밀번호 흐름을 만들지 않는다. | 기존 유지 | `site-header.tsx` |
| 67 | 프로필 수정 후 메뉴가 낡게 보이나? | 기존 ME_CHANGED_EVENT 구독을 그대로 두고 사용자 데이터 리로드 흐름을 유지한다. | 기존 유지 | `site-header.tsx` |
| 68 | LAB TRUST 별점과 게시판 반응이 섞이나? | 이번 게시판 필터·메뉴 수정은 reputation_store 또는 collaboration_review를 건드리지 않는다. | 구현 범위 | `reputation_store.py` |
| 69 | 협업 알림과 게시판 알림을 혼동하나? | 상단 종은 협업·서비스 알림, MY COMMUNITY의 새 답변은 별도 목록으로 유지한다. | 기존 유지 | `NotificationBell / CommunityBoard` |
| 70 | FAQ 진입은 옮긴 메뉴를 설명하나? | ‘저장한 글과 새 답변’ FAQ에서 상단 프로필·모바일 메뉴 위치를 안내하도록 업데이트했다. | 구현 | `frontend/src/lib/faq.ts` |
| **08. 모바일·접근성·디자인** |  |  |  |  |
| 71 | 390px 화면에서 세로 메뉴가 콘텐츠를 밀어내나? | 767px 이하에서는 카테고리 목록을 접는 details+summary로 바꾼다. | 구현 | `community.module.css` |
| 72 | 모바일 카테고리가 가로로 스크롤하나? | 열었을 때만 2열 그리드로 보여 주어 긴 가로 스크롤을 제거한다. | 구현 | `mobileCategoryLinks` |
| 73 | PC에서는 고정 사이드바인가? | 1200px 이상에서 기존 sticky top 90px 동작을 유지한다. | 기존 유지 | `community.module.css` |
| 74 | 카테고리 선택을 키보드로 할 수 있나? | 진짜 a 링크를 사용하고 aria-current=page로 선택 상태를 전달한다. | 구현 | `CommunitySidebar` |
| 75 | 모바일 메뉴를 키보드로 열 수 있나? | 네이티브 details/summary로 엔터·스페이스 동작을 제공한다. | 구현 | `CommunitySidebar` |
| 76 | 텍스트 없이 색으로만 선택 상태를 표시하나? | 활성 배경·글자 굵기·aria-current를 함께 사용하며 점은 장식이다. | 구현 | `sideActive / sideIndicator` |
| 77 | 시각적 언어가 프로젝트 톤과 맞나? | 기존 brand purple, soft blue, glass-like 라운드 카드 계열을 활용한다. | 구현 | `community.module.css` |
| 78 | 모바일 헤더 계정 메뉴에 내 활동이 있나? | 상단 프로필 및 모바일 전체 메뉴에 같은 링크 배열을 렌더링한다. | 구현 | `site-header.tsx` |
| 79 | 드롭다운 높이가 화면을 넘으면? | 데스크톱 드롭다운에 viewport 기준 최대 높이와 세로 스크롤을 적용했다. | 구현 | `site-header.tsx` |
| 80 | 실기기·스크린리더로 접근성을 확인했나? | 정적·자동화 테스트는 수행하지만 390/768/1440 실제 브라우저·VoiceOver/NVDA 실검증은 별도 필요하다. | 실사용 QA 필요 | `docs/community/README.md` |
| **09. 데이터·성능·오류·견고성** |  |  |  |  |
| 81 | 이번 UI 수정 때문에 DB 마이그레이션이 필요한가? | 아니다. 카테고리와 scope는 기존 테이블·API를 그대로 사용한다. | 구현 | `backend/app/routers/community.py` |
| 82 | 카테고리마다 새 API를 만들어야 하나? | 아니다. 기존 GET /community/posts?category=...를 재사용한다. | 구현 | `backend/app/routers/community.py` |
| 83 | 새 메뉴를 열 때 불필요하게 사용자 API를 추가 호출하나? | 헤더는 기존 /auth/me를 재사용하고 경로 이동마다 강제 재조회하지 않는다. | 기존 유지 | `site-header.tsx` |
| 84 | 게시판은 읽기 응답을 캐시하나? | 기존 communityApi의 cache:no-store 유지, 보호된 목록이 브라우저 캐시에 남지 않도록 한다. | 기존 유지 | `frontend/src/lib/community.ts` |
| 85 | 다른 계정으로 전환 후 이전 글 목록이 잠깐 보일 수 있나? | viewerKey와 AbortController 기반 기존 결과 초기화·요청 취소를 유지한다. | 기존 유지 | `community-board.tsx` |
| 86 | 페이지를 바꾸다가 목록이 빈 페이지가 되면? | 기존 페이지/빈 상태와 첫 페이지 안내를 유지하고 카테고리 전환 시 page를 지운다. | 구현 | `CommunityBoard + communityCategoryHref` |
| 87 | API가 네트워크 오류를 내면? | 기존 오류 메시지·다시 불러오기 CTA를 유지한다. | 기존 유지 | `community-board.tsx` |
| 88 | 200자를 넘는 검색어가 URL에 들어오면? | 서버의 q 길이 제한을 유지하고 화면 입력에서도 maxLength=200을 사용한다. | 기존 유지 | `community-board.tsx` |
| 89 | 삭제·신고·저장 한도는 유지되나? | 서버의 쓰기 제한·중복 토큰·행 잠금 규칙은 수정하지 않는다. | 기존 유지 | `community/service.py` |
| 90 | 사용자가 몰려도 탐색마다 N+1 요청을 새로 만드나? | 카테고리는 기존 단일 게시글 목록 요청을 사용하며 카테고리별 개수 조회는 추가하지 않는다. | 구현 | `community-board.tsx` |
| **10. 회귀 테스트·출시·운영 기준** |  |  |  |  |
| 91 | 게시판 분류 6개와 서버 값이 일치하나? | 신규 테스트가 카테고리 키·라벨을 서버 서비스 정의와 비교한다. | 자동 검증 | `community-navigation.test.cjs` |
| 92 | 사이드바에서 개인정보 메뉴 3개가 완전히 없어졌나? | 신규 SSR 테스트로 일반·관리자 사이드바에 개인 메뉴 텍스트가 없는지 확인한다. | 자동 검증 | `community-navigation.test.cjs` |
| 93 | PC 프로필 메뉴 세 항목이 있나? | 공유 상수를 desktop 드롭다운에 매핑했는지 테스트한다. | 자동 검증 | `community-navigation.test.cjs` |
| 94 | 모바일에도 같은 세 항목이 있나? | 동일 상수를 모바일 메뉴에도 매핑했는지 검사한다. | 자동 검증 | `community-navigation.test.cjs` |
| 95 | 관리자 이외가 관리 메뉴를 볼 수 있나? | SSR 관리자/일반 회원 출력을 비교해 메뉴 조건을 테스트하고 서버 403은 기존 테스트로 검사한다. | 자동 검증 | `community-navigation.test.cjs + backend/tests/test_community.py` |
| 96 | URL 필터 조합·범위 유출이 없나? | mine/inbox/saved 등에서 공개 카테고리로 이동하는 경우 scope 제거를 매트릭스로 확인한다. | 자동 검증 | `community-navigation.test.cjs` |
| 97 | 반응형 스타일이 회귀하지 않나? | PC 세로 목록·모바일 접기식 네비게이션 CSS 및 SSR 마크업을 점검한다. | 자동 검증 | `community-navigation.test.cjs` |
| 98 | 기존 댓글·북마크·알림 기능 테스트는? | 전체 frontend 및 backend community 테스트를 별도로 지속 실행하고 새로운 API 없이 유지한다. | 검증 | `frontend/tests/community.test.cjs` |
| 99 | 기존 CI 중 무관한 실패는 어떻게 기록하나? | 인사이트 이미지 관련 2건은 수정 범위와 분리해 보고하고, 신규 메뉴 테스트 실패와 혼동하지 않는다. | 검증 | `GitHub Actions workflow` |
| 100 | 언제 PR을 develop에 병합하나? | Draft PR #72의 전체 빌드·개인 계정 E2E·다양한 뷰포트·운영 승인 후 팀이 결정한다. | 릴리스 게이트 | `PR #72` |

## E. 인수 기준 및 실제 출시 전 남은 작업

**수정 완료의 판단 기준**
1. **PC 1440px**: 왼쪽에 7개 세로 카테고리, 상단 가로 칩이 없음. MY COMMUNITY는 프로필 드롭다운에만 있음.
2. **태블릿 768px**: 카테고리가 세로 목록으로 남아도 본문·오른쪽 안내와 겹치지 않음.
3. **모바일 390px**: 카테고리가 접이식으로 보이고, 열린 상태에서 2열 선택. 전체 메뉴/프로필에서 내 활동 접근.
4. **URL**: `/community?scope=mine&page=6&tag=old&q=내부연구명`에서 '질문·도움'을 고르면 검색어까지 제거한 `/community?category=question`으로 이동. 공개 목록 안에서만 `q`·정렬 등을 유지.
5. **서버**: 다른 계정의 비공개 문의/저장/알림은 JWT·소유권·관리자 검사로 보호. 기존 권한 테스트 통과.
6. **원래 기능**: 공개 게시글 글쓰기·검색·미답변·답변 채택·공감·저장·알림·FAQ·사례/전문가 링크 정상.
7. **지표**: 팀원과 파일럿 사용자가 원하는 분류/개인 내역에 도달하는 횟수와 시간을 과업 단위로 관찰. 전환율 개선은 아직 입증되지 않음.

**운영/실사용 검증 필요**
- 실제 브라우저에서 390·768·1440px의 메뉴 열림/닫힘, 긴 닉네임, 스크린리더, 고대비/키보드 포커스 확인.
- **서로 다른 로그인 계정 2명 + 운영자 1명**으로 내 글·비공개 문의·북마크·새 답변·운영 접근 교차 검증.
- 접속 환경에 따라 `/auth/me`, `/community/me`가 잘 연결되는지 및 공유 DB의 실제 자료 읽기 검증.
- Github Actions 전체 프론트 테스트의 기존 인사이트 이미지 관련 2건을 별도 이슈로 관리하며, 새 메뉴 직접 테스트와 구분.
- 기능이 검증되기 전 **Draft PR #72 유지**, `develop` 직접 수정/공유 PostgreSQL 마이그레이션 없음.

## F. 후속 개선 후보 (이번 작업 완료로 표현하지 않음)

- 신규 게시글이 충분히 쌓인 다음 카테고리별 개수·미답변 개수 서버 API 및 캐싱 검토. 현재 0건에서 임의 숫자 표시 금지.
- MY COMMUNITY 안의 *미확인 답변 개수* 표시: 인증 사용자별 가벼운 count API와 폴링 정책, 개인정보 노출 경계가 필요하므로 현 단계 제외.
- 비공개 문의의 문의 담당·응답 SLA, 신고 재심사/보존기간, 콘텐츠 접근성 실측.
- 모바일 다양한 OS·웹뷰·접근성 스크린리더에 대한 사용자 관찰 후 카테고리 메뉴 폴딩 동작 보완.
- 전역 헤더의 JS 번들 영향·카테고리 이동 UX 계측(정성+정량)을 확인한 후에만 추가 최적화.
