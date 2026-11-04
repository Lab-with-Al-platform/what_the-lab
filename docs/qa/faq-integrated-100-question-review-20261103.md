# WHAT THE LAB · 통합 서비스 FAQ 재설계 — 100개 연쇄 검토 질문

**기준 코드:** `integration/develop-feature-20261103` (2026-11-03)  
**FAQ 개발 브랜치:** `feature/faq-integrated-help-20261103`  
**원칙:** 기존 FAQ의 문구를 진실의 근거로 쓰지 않고, 통합 서비스의 화면·API·DB 구현을 기준으로 검증합니다. 원격 Discord/Google/API 및 기존 로컬 DB 마이그레이션은 FAQ 수정만으로 운영 가능 상태가 되지 않습니다.

## 결정 요약

- FAQ 20개 → **37개**, 카테고리 5개 → **8개**. 기존 해시 ID 20개 전부 보존.
- 기술 설명보다 실제 사용자 질문 중심으로 구조화. 특히 **신규 직접 협업 요청과 협업 내부 작업 요청**, **평가 작성과 공개 LAB TRUST**, **서비스 종 알림과 게시판 답변 알림**을 분리.
- 핵심 복합 작업에는 20개의 **단계별 선택형 화면 안내도**를 제공. 실제 캡처·실데이터 시연을 가장하지 않으며 Discord 외부 화면 캡처를 포함하지 않음.
- 모든 FAQ에는 최소 1개의 실제 서비스 경로 링크, 키워드, 가독성 높은 1~3개 문단을 제공.
- 외부 서비스 Google Calendar와 Discord 연동은 **서버 설정·협업 상태·외부 서비스 조건에 따른 선택적 기능**으로 설명.
- 이 FAQ 개편 PR은 DB를 수정하거나 `develop` 혹은 `integration` 브랜치를 직접 덮어쓰지 않음.

## 기능별 화면 → 데이터 연동 검토

| 화면 동선 | 기능 | 관련 데이터/API | 문구 설계의 핵심 |
|---|---|---|---|
| 홈 → 통합검색 → 원본 | 공개 인사이트·전문가·글·FAQ 검색 | `global-search.ts`, 전문가/게시판 공개 조회 | 비공개 정보 미노출 |
| 내 연구 → 전문가 상세 → 요청관리 | 연구 선택·협업 요청/수락/확정 | `collaboration_request`, `collab_requests` | 일반/긴급 요청의 확정 시점 차이 |
| 협업 공간 → 진행 중·완료 | 프로젝트 1:1 생명주기 | `collaboration`, `workspace_store` | 종료 후 읽기 전용 |
| 협업 달력 → 일정창 | 종류·반복·시각·변경 알림 | `collaboration_schedule`, `workspace` API | 협업 기간·반복 조건·Google 분리 |
| 협업 상세 → 요청 | 받은/보낸 작업·기한 협의·이력 | `collaboration_task`, `collaboration_task_event` | 역할별 작업 권한 차이 |
| 알림 종 → 협업/평가 상세 | 요청·작업·일정·평가 준비 알림 | `notification`, `notification_store` | 30일/50건, 정확한 상세 링크 |
| 협업 완료 → 평가 → 전문가 상세 | 참여자 후기·LAB TRUST | `collaboration_review`, `reputation_store` | 30일/48시간/7일·공개 대상 제한 |
| 게시판 → 공개/비공개 → MY COMMUNITY | 질문·저장·채택·신고 | community API | 개인정보/댓글 공개 범위 |

## 검증 질문 100개

### 01 · 사용자 여정과 용어의 일관성

**Q001. 왜 FAQ는 기능 나열이 아니라 사용자 행동 순서로 구성하는가?**

사용자가 보고 싶은 것은 기능명이 아니라 현재 다음에 누를 버튼이다. 최초 탐색→직접 요청→수락→협업 공간→평가 순서를 따른다.

근거 코드: `frontend/src/components/site-header.tsx` · `frontend/src/components/requests-page.tsx`

**Q002. 연구회원과 AI 전문가의 첫 화면이 다른가?**

역할에 따라 내 연구·내 이력·받은 요청 등이 달라진다. 하나의 FAQ에서 두 역할을 혼동해 안내하지 않는다.

근거 코드: `frontend/src/components/my-space-shell.tsx` · `frontend/src/components/requests-page.tsx`

**Q003. 새 기능의 공통 시작 지점은 어디인가?**

로그인 후 요청/협업 관련 진입은 헤더 메뉴와 각 작업 화면을 통해 이루어진다. 실제 링크를 모든 FAQ에 붙였다.

근거 코드: `frontend/src/components/site-header.tsx`

**Q004. 게시판 댓글이 협업 요청을 생성하는가?**

아니다. 게시글·댓글과 직접 협업 요청은 별도의 데이터 흐름으로 유지된다.

근거 코드: `frontend/src/components/community/community-detail.tsx` · `backend/app/routers/collab_requests.py`

**Q005. 협업 요청과 협업 내부 작업 요청을 혼동할 가능성이 높은가?**

매우 높다. 두 화면 모두 ‘요청’이라는 말을 쓰므로 대상을 구분한 FAQ와 단계형 비교 가이드를 만들었다.

근거 코드: `frontend/src/components/sent-requests.tsx` · `frontend/src/components/workspace-detail-work.tsx`

**Q006. 사용자가 가입만 하면 모든 화면을 볼 수 있는가?**

아니다. 역할과 실제 협업 참여 여부에 따른 접근 권한이 있다. 비인가 사용자에게 제공되지 않는 버튼을 고정적으로 약속하지 않는다.

근거 코드: `backend/app/workspace_store.py` · `backend/app/routers/workspace_tasks.py`

**Q007. 미완성 기능을 완성된 기능처럼 서술할 위험은?**

소스에서 컴포넌트 UI만 보이는 동작과 운영 연결이 가능한 동작을 분리했다. 연동 기능은 서버 활성화·외부 계정 상태를 조건으로 명시한다.

근거 코드: `frontend/src/components/workspace-detail-head.tsx` · `backend/app/routers/google.py`

**Q008. 현행 FAQ를 기능의 진실 원천으로 삼았는가?**

아니다. 질문 ID와 화면 구조·기존 링크는 보존하고 답변 의미는 각 UI·API·DB 구현에서 재검토했다.

근거 코드: `frontend/src/lib/faq.ts` · `frontend/src/components/community/faq-page.tsx`

**Q009. 왜 모든 FAQ에 시각 자료를 넣지 않았는가?**

단순 정책·설명형 FAQ에 그림을 추가하면 정보량이 불필요하게 늘어난다. 버튼 순서·권한·상태 변화가 복잡한 문항에만 UI 가이드를 배치했다.

근거 코드: `frontend/src/lib/faq.ts` · `frontend/src/components/community/faq-walkthrough.tsx`

**Q010. FAQ의 최종 범위와 분류는?**

총 37문항, 8분류, 20개 단계형 시각 가이드다. 기존 20개 해시 ID는 모두 유지했다.

근거 코드: `frontend/src/lib/faq.ts` · `frontend/tests/faq-integrated-help.test.cjs`

### 02 · 가입·프로필 공개·검색

**Q011. Discord 인증이 회원가입 완료를 보장하는가?**

아니다. 가입 역할 및 입력 단계가 분리되어 있다.

근거 코드: `frontend/src/components/signup-role-form.tsx` · `frontend/src/components/researcher-verify-form.tsx`

**Q012. 연구회원의 기관 이메일은 언제 필요한가?**

연구회원 가입 과정에서 소속 인증을 진행한다. 인증번호는 외부 공개 문의에 남기지 않도록 안내했다.

근거 코드: `frontend/src/components/researcher-verify-form.tsx`

**Q013. AI 전문가의 프로필은 작성 즉시 공개되는가?**

아니다. 필수 작성 항목을 완료한 뒤 ‘요청 받기’ 스위치를 켜야 한다.

근거 코드: `frontend/src/components/my-career-profile.tsx`

**Q014. 공개된 프로필을 다시 비공개로 바꿀 수 있는가?**

해당 공개 스위치를 끌 수 있다. 공개 상태와 정보 수정은 서로 다른 기능이다.

근거 코드: `frontend/src/components/my-career-profile.tsx`

**Q015. 프로필 사진과 소속 정보는 어디에서 관리하는가?**

기본 프로필 설정에서 관리하고, 전문 기술·포트폴리오는 내 이력에서 관리한다.

근거 코드: `frontend/src/components/profile-settings-page.tsx` · `frontend/src/components/my-career-profile.tsx`

**Q016. 통합검색은 모든 사적 정보를 검색하는가?**

아니다. 공개된 인사이트·전문가·게시판 글·FAQ를 분리해서 검색한다.

근거 코드: `frontend/src/components/unified-search.tsx`

**Q017. 홈 돋보기와 전문가 필터는 같은 기능인가?**

홈 돋보기는 4개 출처를 한꺼번에 찾고, 전문가 필터는 공개 전문가 세부조건을 좁힌다.

근거 코드: `frontend/src/components/site-header.tsx` · `frontend/src/components/expert-search.tsx`

**Q018. 검색 결과에서 원본 화면으로 돌아갈 수 있는가?**

각 출처별 원본 링크를 유지했다. FAQ는 /faq#ID 앵커를 통해 질문을 직접 연다.

근거 코드: `frontend/src/components/unified-search.tsx` · `frontend/src/components/community/faq-page.tsx`

**Q019. 통합검색 중 일부 서버 API가 실패하면?**

서비스별 오류를 구분하는 설계이므로 결과가 없다는 것과 서버 오류를 동일하게 설명하지 않는다.

근거 코드: `frontend/src/components/unified-search.tsx`

**Q020. 시연용 전문가 점수는 실제 평가인가?**

아니다. LOCAL DEMO는 별도 표시되며 공개 지수·협업 요청 실데이터와 혼동되지 않아야 한다.

근거 코드: `frontend/src/components/expert-profile-view.tsx` · `frontend/src/lib/expert-local-demo.ts`

### 03 · 직접 협업 요청과 수락

**Q021. 연구를 등록하지 않아도 전문가에게 요청할 수 있는가?**

연구회원이 협업 요청에 사용할 연구를 먼저 준비해야 한다. 지정한 연구가 없으면 등록·지정 안내가 나타난다.

근거 코드: `frontend/src/components/sent-requests.tsx` · `frontend/src/components/collab-request-dialog.tsx`

**Q022. 연구가 여러 개일 때 어떤 요청이 보이는가?**

보낸 요청 화면은 지정한 연구별로 목록을 나눠 보여준다. 지정 변경은 데이터 삭제가 아니다.

근거 코드: `frontend/src/components/sent-requests.tsx`

**Q023. 전문가는 요청을 어디에서 받는가?**

요청관리의 받은 요청에서 확인한다. 계정 역할이 다르면 탭과 액션도 달라진다.

근거 코드: `frontend/src/components/received-requests.tsx`

**Q024. 요청을 수락하려면 어떤 정보를 확인하는가?**

연구 내용·데이터 공유 조건·기간을 확인하고 동의해야 수락할 수 있도록 UI가 구성돼 있다.

근거 코드: `frontend/src/components/received-requests.tsx`

**Q025. 수락하면 모든 요청에서 협업이 곧바로 시작되는가?**

아니다. 일반 요청은 수락 이후 연구회원 선택 단계가 남는다.

근거 코드: `frontend/src/components/sent-requests.tsx`

**Q026. 긴급 요청의 예외는?**

긴급 요청은 전문가 수락 즉시 협업이 시작될 수 있다. 일반 요청 흐름을 그대로 복사해 안내하면 잘못된다.

근거 코드: `frontend/src/components/received-requests.tsx` · `backend/app/routers/collab_requests.py`

**Q027. 전문가는 기간을 조정해 수락할 수 있는가?**

일반 요청에서 기간을 조정해 수락하는 흐름이 있다. 연구회원은 조정된 기간을 확인한다.

근거 코드: `frontend/src/components/received-requests.tsx` · `frontend/src/components/sent-requests.tsx`

**Q028. 연구회원이 수락 요청을 확정하지 않으면?**

선택 기한이 지나면 만료될 수 있다. FAQ는 요청 상태의 유효 기간을 설명한다.

근거 코드: `frontend/src/components/received-requests.tsx` · `backend/app/request_store.py`

**Q029. 요청이 거절되거나 취소된 뒤에도 시작 버튼이 보여야 하는가?**

아니다. 상태와 취소 사유에 따라 액션이 달라진다.

근거 코드: `frontend/src/components/sent-requests.tsx`

**Q030. 협업 요청이 완료되면 다음 화면은?**

확정된 협업이 /workspace 목록에 생성되어야 한다. FAQ에서 협업 요청과 협업 작업 단계를 연결했다.

근거 코드: `backend/app/workspace_store.py` · `frontend/src/components/workspace-home.tsx`

### 04 · 협업 공간과 생명주기

**Q031. 협업 공간은 팀 프로젝트 무제한 인원인가?**

아니다. 하나의 협업은 연구회원 1명과 AI 전문가 1명의 1:1 단위다.

근거 코드: `frontend/src/components/workspace-home.tsx`

**Q032. 협업 공간의 ‘진행 중’은 어떤 상태를 포함하나?**

시작 전(waiting)과 진행 중(active)을 모두 묶는다.

근거 코드: `frontend/src/components/workspace-home.tsx`

**Q033. ‘완료’ 탭에는 무엇이 들어가나?**

정상 완료·중도 종료·시작 전 취소 등 진행 중이 아닌 협업이 분류된다.

근거 코드: `frontend/src/components/workspace-home.tsx`

**Q034. 협업 완료 기록은 수정할 수 있는가?**

종료된 협업은 일정과 작업 기록을 읽을 수 있지만 수정하지 못한다.

근거 코드: `frontend/src/components/workspace-detail-page.tsx` · `backend/app/workspace_store.py`

**Q035. 협업 시작 시 합의 내용은 어디에 저장되나?**

시작 시 원래 연구 및 요청에서 합의 내용을 복사해 collaboration.agreement에 남긴다.

근거 코드: `backend/app/workspace_store.py`

**Q036. 협업 기간 내에서만 일정이 가능한 이유는?**

협업 종료일 이후의 새 일정을 막아 서비스 상태와 달력 범위가 일치하도록 한다.

근거 코드: `frontend/src/components/workspace-schedule-dialog.tsx` · `backend/app/workspace_rules.py`

**Q037. 협업 종료일이 지나면 어떤 작업이 발생하는가?**

진행 중 협업이 완료로 바뀌고 열린 작업에는 종료 이력이 추가된다.

근거 코드: `backend/app/workspace_store.py`

**Q038. 협업 종료에 대한 평가 알림은 언제 생성되나?**

상태 변경된 협업의 request_id를 기반으로 평가 준비 알림을 만든다.

근거 코드: `backend/app/workspace_store.py` · `backend/app/notification_store.py`

**Q039. 종료·작업기록·알림이 일부만 저장되는 위험은?**

관련 변경을 트랜잭션 안에 묶었다. 실제 동시성/운영 DB 적용은 별도 검증 대상이다.

근거 코드: `backend/app/workspace_store.py` · `backend/app/db.py`

**Q040. 완료 목록에서 평가 버튼은 모든 상태에 존재하는가?**

아니다. done·ended_early에만 평가 버튼이 나타나며 canceled에는 표시하지 않는다.

근거 코드: `frontend/src/components/workspace-home.tsx`

### 05 · 협업 공유 달력과 일정

**Q041. 협업 달력에는 무엇이 표시되는가?**

협업 일정과 기한이 있는 작업 요청을 함께 보여준다.

근거 코드: `frontend/src/components/workspace-home.tsx` · `frontend/src/components/workspace-calendar.tsx`

**Q042. 진행 중 협업 여러 개를 어떻게 구분하는가?**

협업별로 달력 표시를 켜고 끌 수 있다. 이는 필터일 뿐 데이터를 삭제하지 않는다.

근거 코드: `frontend/src/components/workspace-home.tsx`

**Q043. 일정 종류는 무엇인가?**

미팅·작업 기간·결과물 마감·기타의 네 종류다.

근거 코드: `frontend/src/lib/workspace.ts`

**Q044. 일정은 꼭 하루짜리인가?**

아니다. 여러 날 이어지는 기간형 일정도 입력할 수 있다.

근거 코드: `frontend/src/components/workspace-schedule-dialog.tsx`

**Q045. 매주 반복은 모든 일정에 가능한가?**

아니다. 새로 만드는 하루짜리 미팅에만 반복 옵션이 표시된다.

근거 코드: `frontend/src/components/workspace-schedule-dialog.tsx`

**Q046. 반복은 언제까지 이어지는가?**

협업 종료일까지의 범위를 기준으로 한다.

근거 코드: `frontend/src/components/workspace-schedule-dialog.tsx`

**Q047. 일정의 시작·끝 시각은 모든 종류에서 받는가?**

하루짜리 미팅·기타에서만 시각을 입력하도록 UI가 제한한다.

근거 코드: `frontend/src/components/workspace-schedule-dialog.tsx`

**Q048. 일정 삭제는 나의 개인 캘린더에서만 사라지는가?**

아니다. 협업 공동 일정이므로 상대방 서비스 달력에서도 사라진다.

근거 코드: `frontend/src/components/workspace-schedule-view.tsx`

**Q049. 종료된 협업의 일정은 어디에서 보나?**

진행 중 달력에서는 제외되고 종료 협업 상세의 기록으로 남는다.

근거 코드: `frontend/src/components/workspace-home.tsx`

**Q050. 모바일에서 달력과 할 일의 순서는?**

반응형 UI가 지금 할 일/요청/다가오는 일정을 먼저 보여줄 수 있다. FAQ에서는 메뉴명을 중심으로 안내한다.

근거 코드: `frontend/src/components/workspace-home.tsx`

### 06 · 협업 안의 작업 요청과 이력

**Q051. 작업 요청은 누가 생성할 수 있는가?**

진행 중 협업의 실제 참여자가 상대방에게 요청을 남긴다.

근거 코드: `backend/app/routers/workspace_tasks.py`

**Q052. 작업 요청은 협업 요청과 다른 테이블인가?**

그렇다. 협업 요청은 collaboration_request, 내부 작업은 collaboration_task 및 event에 저장한다.

근거 코드: `backend/app/routers/collab_requests.py` · `backend/app/routers/workspace_tasks.py`

**Q053. 받은 작업의 완료 권한은 누구에게 있는가?**

해당 작업을 맡은 사람만 완료할 수 있다.

근거 코드: `backend/app/routers/workspace_tasks.py`

**Q054. 작업 요청을 취소하는 사람은?**

원래 요청을 보낸 사람만 취소할 수 있다.

근거 코드: `backend/app/routers/workspace_tasks.py`

**Q055. 작업 기한을 수정하는 사람은?**

기한 변경은 보낸 사람 권한이며 받은 사람은 ‘기한 얘기하기’로 요청한다.

근거 코드: `frontend/src/components/workspace-detail-work.tsx`

**Q056. 기한 협의가 도착하면 보낸 사람은 무엇을 할 수 있는가?**

기한 변경 또는 지금 기한 유지로 답한다.

근거 코드: `frontend/src/components/workspace-detail-work.tsx`

**Q057. 완료를 잘못 눌렀다면?**

완료한 사람이 되돌리기를 사용할 수 있다.

근거 코드: `frontend/src/components/workspace-detail-work.tsx`

**Q058. 완료되었으나 수정이 필요하면?**

작업을 보낸 사람이 이유를 적고 다시 요청할 수 있다.

근거 코드: `frontend/src/components/workspace-detail-work.tsx`

**Q059. 이력에 작업 생성·기한 협의·완료가 남는가?**

collaboration_task_event에 순서대로 기록되고 상세 UI에서 보여준다.

근거 코드: `backend/app/workspace_detail.py` · `frontend/src/lib/workspace-detail.ts`

**Q060. 협업이 끝났는데 작업이 남으면?**

열린 작업은 ended 이벤트로 종료 처리 사유를 남기며 새 작업은 금지된다.

근거 코드: `backend/app/workspace_store.py`

### 07 · 사이트 알림·Discord·Google 연동

**Q061. 사이트 알림 종은 단순 협업 요청 알림만 있는가?**

아니다. 작업·일정·마감·평가 준비 등 여러 유형을 다룬다.

근거 코드: `backend/app/notification_store.py`

**Q062. 상단 종 알림과 ‘내 글의 새 답변’은 같은가?**

아니다. 각각 협업 알림과 게시판 알림 흐름이다.

근거 코드: `frontend/src/components/notification-bell.tsx` · `frontend/src/components/site-header.tsx`

**Q063. 알림의 조회 기간과 개수는?**

최근 30일, 최대 50건으로 제한된다.

근거 코드: `backend/app/notification_store.py`

**Q064. 작업 알림을 클릭하면 어디로 가는가?**

/workspace/{id}#task-{taskId}로 연결한다.

근거 코드: `backend/app/notification_store.py`

**Q065. 평가 준비 알림은 어디로 가는가?**

/workspace/{id}#review 경로로 연결한다.

근거 코드: `backend/app/notification_store.py`

**Q066. Discord DM은 사이트 알림과 같은 보장 수준인가?**

아니다. DM 동의와 서버 가입·허용 여부 및 봇 설정에 따라 수신이 달라진다.

근거 코드: `backend/app/notification_sender.py` · `frontend/src/components/profile-settings-page.tsx`

**Q067. 협업 확정 뒤 Discord 전용 채널이 자동 준비되는가?**

그 기능이 구현되어 있으며 채널 생성 상태가 pending일 수 있다. 정상 동작은 봇 설정·서버 정책에 좌우된다.

근거 코드: `backend/app/collab_channel.py` · `frontend/src/components/workspace-collab-list.tsx`

**Q068. Google Calendar는 회원의 전체 캘린더를 읽는가?**

아니다. Google 로그인과 이메일 확인 후 별도 협업 캘린더를 공유한다.

근거 코드: `backend/app/routers/google.py`

**Q069. Google Calendar에 연결했다면 어디에서 수정하는가?**

원본 일정 수정은 WHAT THE LAB의 협업 공간에서 수행한다.

근거 코드: `backend/app/routers/google.py` · `frontend/src/components/workspace-detail-head.tsx`

**Q070. Google 연동 버튼이 모든 계정에 무조건 보이는가?**

아니다. google_enabled와 협업 진행 상태를 확인해 조건부 렌더링한다.

근거 코드: `frontend/src/components/workspace-detail-head.tsx` · `frontend/src/components/workspace-home.tsx`

### 08 · 종료 후 리뷰와 LAB TRUST

**Q071. 누가 협업 평가를 쓸 수 있는가?**

협업에 실제 참가한 연구회원과 AI 전문가다.

근거 코드: `backend/app/review_store.py`

**Q072. 진행 중 협업을 미리 평가할 수 있는가?**

아니다. 정상 종료 또는 중도 종료 이후에만 작성 가능하다.

근거 코드: `backend/app/review_store.py`

**Q073. 평가 기간은?**

종료 후 30일 이내다.

근거 코드: `frontend/src/components/collaboration-review-card.tsx` · `backend/app/review_store.py`

**Q074. 평가 항목은 몇 개인가?**

4개 항목을 각각 1~5점으로 입력하고 짧은 후기는 선택 사항이다.

근거 코드: `frontend/src/components/collaboration-review-card.tsx`

**Q075. 이미 제출한 평가는 무제한 수정할 수 있는가?**

아니다. 제출 후 48시간 이내 한 번만 수정 가능하다.

근거 코드: `backend/app/review_store.py`

**Q076. 상대방의 피드백은 언제 보이는가?**

협업 종료 7일이 지난 뒤 해당 당사자에게만 보이도록 한다.

근거 코드: `frontend/src/components/collaboration-review-card.tsx`

**Q077. 연구회원에 대한 개인 평가가 전문가 공개 지수에 들어가는가?**

아니다. 지수는 연구회원이 AI 전문가에게 남긴 공개 가능 평가를 사용한다.

근거 코드: `backend/app/reputation_store.py`

**Q078. 중도 종료 평가가 공개 LAB TRUST에 반영되는가?**

아니다. 정상 완료된 협업 평가만 공개 지수 계산 대상이다.

근거 코드: `backend/app/reputation_store.py`

**Q079. 새 전문가가 점수를 표시받는 최소 표본은?**

평가 최소 3건과 독립 연구회원 최소 2명이 필요하다.

근거 코드: `frontend/src/components/lab-trust-indicator.tsx` · `backend/app/reputation_store.py`

**Q080. 신고된 후기는 자동으로 점수에서 삭제되는가?**

아니다. 신고는 검토 요청이며 운영 판단에 따른 공개 여부를 별도로 관리한다.

근거 코드: `backend/app/review_store.py`

### 09 · 게시판·개인정보·신뢰 경계

**Q081. 공개 글은 비회원도 읽을 수 있는가?**

공개 게시글에 한해 그렇다. 비공개 콘텐츠와 혼합해 검색하지 않는다.

근거 코드: `frontend/src/components/community/community-composer.tsx` · `backend/app/routers/community.py`

**Q082. 비공개 문의는 누가 보는가?**

작성자와 게시판 관리자만 접근하도록 권한 분리되어 있다.

근거 코드: `frontend/src/components/community/community-composer.tsx`

**Q083. 비공개 문의도 검색 결과에 등장하는가?**

아니다. 공개 검색은 비공개 문의를 제외한다.

근거 코드: `frontend/src/components/unified-search.tsx` · `backend/app/routers/community.py`

**Q084. 글 작성 후 공개 여부를 바꿀 수 있는가?**

아니다. 등록 이후 공개·비공개 전환을 막는다.

근거 코드: `frontend/src/components/community/community-composer.tsx`

**Q085. 게시판에 연구 원자료 파일을 첨부할 수 있는가?**

현재 파일 첨부 기능을 제공하지 않고 원자료 공개를 지양한다.

근거 코드: `frontend/src/components/community/community-composer.tsx`

**Q086. 댓글 채택은 어떤 사용자에게 가능한가?**

글 작성자·관리자 권한으로 채택할 수 있다.

근거 코드: `frontend/src/components/community/community-detail.tsx`

**Q087. 답변을 채택하면 전문가 평점이 오르는가?**

아니다. 게시판 해결 여부는 실제 종료된 협업 후기와 다르다.

근거 코드: `frontend/src/components/community/community-detail.tsx` · `backend/app/reputation_store.py`

**Q088. 저장한 글과 새 답변은 어디서 확인하는가?**

MY COMMUNITY 아래 저장한 글과 새 답변 메뉴에서 각각 확인한다.

근거 코드: `frontend/src/components/site-header.tsx`

**Q089. 개인정보 노출을 신고하면 바로 자동 삭제되는가?**

아니다. 관리자 검토가 필요하고 자동 비공개로 단정하면 안 된다.

근거 코드: `backend/app/routers/community.py` · `backend/app/review_store.py`

**Q090. 로그인 토큰·API 키는 비공개 문의에 적어도 되는가?**

아니다. 관리자에게도 제공하지 말아야 할 비밀값이다.

근거 코드: `frontend/src/components/community/community-composer.tsx`

### 10 · FAQ 디자인, 연결, 검증과 배포 차단

**Q091. 사용자에게 실제 스크린샷을 제공하는가?**

아니다. UI 코드의 메뉴명·버튼명과 경로로 만든 안내도이며 캡처가 아님을 명시한다.

근거 코드: `frontend/src/components/community/faq-walkthrough.tsx`

**Q092. 왜 안내도를 단계별로 선택하게 설계했는가?**

한 번에 과도한 설명을 보이지 않고 행동을 따라볼 수 있게 하기 위해서다.

근거 코드: `frontend/src/components/community/faq-walkthrough.tsx`

**Q093. 키보드 사용자는 단계형 가이드를 이용할 수 있는가?**

각 단계는 button이며 aria-pressed, aria-controls를 사용한다.

근거 코드: `frontend/src/components/community/faq-walkthrough.tsx`

**Q094. 모바일은 어떤 배열을 사용하는가?**

카테고리를 가로 스크롤 메뉴로, 단계 가이드를 세로 카드와 가로 스크롤 스텝으로 배치한다.

근거 코드: `frontend/src/components/community/faq-visual.module.css`

**Q095. 시각 효과를 줄인 사용자는?**

prefers-reduced-motion 조건에서 일부 전환 효과를 줄인다.

근거 코드: `frontend/src/components/community/faq-visual.module.css`

**Q096. 기존 FAQ 해시 주소는 유지되는가?**

기존 20개 id를 보존했고 새 검색/필터에서 해시가 가려지면 필터를 초기화한다.

근거 코드: `frontend/src/components/community/faq-page.tsx` · `frontend/tests/faq-integrated-help.test.cjs`

**Q097. FAQ를 통합검색에서 다시 찾을 수 있는가?**

동일한 FAQS 배열을 통합검색에서 재사용하므로 질문/답변/키워드에 따라 검색된다.

근거 코드: `frontend/src/components/unified-search.tsx` · `frontend/src/lib/faq.ts`

**Q098. 외부 서비스가 비활성화된 사용자는?**

Google·Discord를 모든 계정의 확정 기능으로 약속하지 않고 서버 설정과 연결 상태를 명시했다.

근거 코드: `frontend/src/lib/faq.ts`

**Q099. 통합 브랜치에서 DB를 아직 업그레이드하지 않은 로컬 사용자에게는?**

기능이 API/DB 의존성이 있음을 배포 담당자가 확인해야 하며, FAQ 개편만으로 필요한 DB 마이그레이션이 적용되지는 않는다.

근거 코드: `backend/migrations/versions/20261103_24_collaboration_reviews.py` · `database/README.md`

**Q100. PR 작성 뒤 실제 배포 가능성을 어떻게 판단하는가?**

FAQ 자동 테스트·타입검사·린트·빌드와 서비스 E2E·접근성 검증을 구분한다. DB 운영 전환/원격 인증은 별도 승인된 배포 조건이다.

근거 코드: `frontend/tests/faq-integrated-help.test.cjs` · `.github/workflows/collaboration-reviews-ci.yml`

## 릴리스 전 수락 기준

1. 질문 37개·기존 앵커 20개·카테고리 8개·단계 가이드 20개의 스키마 및 링크 검사 통과.
2. GitHub CI: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.
3. 모바일 320px·태블릿·데스크톱에서 긴 문장·가이드 스텝·키보드·화면읽기 도구의 수동 점검.
4. 실제 연구회원/전문가 테스트 계정으로 일반·긴급 요청, 역할별 작업, 완료·평가 진입 검증.
5. Google/Discord 연결 UI는 외부 연동 설정의 실제 활성 여부 검증 후 공개.
6. 기존 로컬 DB에 적용된 과거 `20261031_21` 리뷰 마이그레이션은 별도 데이터 보존형 전환 절차가 필요. **FAQ PR은 마이그레이션을 실행하지 않음.**

## 보존한 기존 FAQ 해시

`/faq#what-is-labbridge` · `/faq#first-question` · `/faq#researcher-expert` · `/faq#discord-login` · `/faq#login-problem` · `/faq#profile-exposure` · `/faq#request-boundary` · `/faq#lab-trust` · `/faq#review-after-completion` · `/faq#insight-question` · `/faq#calendar-discord` · `/faq#public-post` · `/faq#private-post` · `/faq#change-visibility` · `/faq#research-data` · `/faq#accept-answer` · `/faq#save-notification` · `/faq#report` · `/faq#feedback` · `/faq#posting-limits`
