# 게시판 API 계약

기본 경로 `/api/v1/community`. 기존 `access_token` httpOnly JWT 쿠키를 사용합니다. 모든 쓰기 요청은 허용된 `Origin`이 필요합니다. 새 계정 권한을 클라이언트 요청의 author_id·role·is_admin으로 지정할 수 없습니다.

## 조회

| 메서드·경로 | 권한·설명 |
|---|---|
| GET `/meta` | 글 종류·영역·공개 사례 링크. 회원 정보 없음 |
| GET `/me` | 가입 완료 회원. 내부 사용자 ID·닉네임·역할·공통 관리자 여부 |
| GET `/posts` | 기본 public. 공개 글만 반환 |
| GET `/posts/{id}` | 공개 또는 본인·관리자의 비공개 글. 실패는 동일한 404 |
| GET `/posts/{id}/comments?page=1` | 원문과 동일한 읽기 권한, 30개/페이지. 채택 답변 우선 |
| GET `/notifications` | 본인 수신 내역만. 삭제되거나 볼 수 없게 된 글은 제목·건수도 제외 |
| GET `/admin/reports/{id}` | 공통 관리자만 신고와 운영 이력 조회 |

목록 인자: `scope=public|mine|saved|inbox|moderation`, `q`, `category`, `tag`, `status=open|in_progress|resolved`, `unanswered=true`, `order=latest|oldest|helpful`, `page=1..10000`, `page_size=1..30`(기본 12). public 외 본인 조회는 로그인, inbox·moderation은 관리자 권한이 필요합니다. `total`은 해당 권한·필터 적용 이후의 수입니다. 서버에서 DB 필터·정렬·페이지를 처리하며 전체 비공개 본문을 브라우저에 보내 필터하지 않습니다.

## 쓰기

| 메서드·경로 | 입력·규칙 |
|---|---|
| POST `/posts` | `PostInput` + `client_token: UUID`. 같은 회원·token·내용 재시도는 같은 ID |
| PUT `/posts/{id}` | `PostInput` + `expected_version`. 원문 작성자만. 공개 범위 불변 |
| DELETE `/posts/{id}` | `{expected_version}`. 원문 작성자만. 제목·본문 제거와 조회 차단 |
| POST `/posts/{id}/comments` | `{body, client_token:UUID}`. 비공개는 작성자·관리자만 |
| PUT `/posts/{id}/comments/{commentId}` | `{body, expected_version}`. 댓글 작성자만. 채택 답변 수정 시 채택 해제 |
| DELETE `/posts/{id}/comments/{commentId}` | `{expected_version,reason?}`. 댓글 작성자 또는 관리자. 관리자 타인 삭제는 3~450자 사유·이력 필수 |
| PUT `/posts/{id}/status` | `{expected_version,status,accepted_comment_id?:UUID,accepted_comment_version?:number}`. 원문 작성자·관리자 |
| PUT `/posts/{id}/helpful` | `{enabled:boolean}`. 공개 글만, 자기 공감 불가, 반복 요청 중복 없음 |
| PUT `/posts/{id}/bookmark` | `{enabled:boolean}`. 공개 글만, 본인 저장함 |
| POST `/posts/{id}/reports` | `{reason:privacy|spam|abuse|other, detail?:string}`. 회원·글당 미처리 1건. 처리 후 새 신고는 재개 |
| PUT `/notifications/read` | 본인 알림만 읽음 처리 |
| POST `/admin/posts/{id}/moderate` | `{expected_version,action:hide|restore|pin|unpin|dismiss_reports,reason}` |

`PostInput`: title 3~120자, body 10~15,000자, category `question|story|idea|support|chat|notice`, visibility `public|private`, tags 최대5개·각20자, area `general|account|experts|research|insights|community`, insight_slug는 레지스트리의 공개 글 또는 null. 공지는 관리자만 공개로 작성합니다.

댓글은 1~5,000자입니다. 쓰기·회원 상태 검사는 요청마다 적용됩니다. 예상 버전 불일치는 409이며 브라우저 입력을 자동 덮어쓰지 않습니다. 관리자 조치 사유는 3~500자입니다. 비공개 문의는 pin으로 공개되지 않습니다. 신고만으로 자동 숨김하지 않습니다.

공개 목록 응답은 `items,total,page,page_size`. 항목은 id·제목·요약·태그·작성자 닉네임/역할·종류·공개 범위·상태·버전·답변/공감 수·본인/관리 가능 여부·본인 저장/공감 여부·작성/수정 날짜를 포함합니다. 원문 상세에만 body를 추가합니다. 개인 이메일·Discord ID·인증 쿠키는 포함하지 않습니다.

## 상태·동시성

- 글: open → in_progress → resolved, 작성자·관리자가 다시 열 수 있음.
- 해결 댓글 ID는 같은 글의 삭제되지 않은 댓글만 참조 가능.
- 댓글 수정·삭제로 채택이 해제되면 글 version도 증가.
- row lock + expected_version + unique token으로 편집 충돌·중복 요청을 구분.
- DB 기반 시간당 제한: 새 글·글/댓글 수정·새 댓글·신규 공감/저장·신고를 합쳐 120회, 새 글은 추가로 10개. 삭제·공감/저장 해제·상태 변경·알림 읽음·관리자 조치는 이 한도에 포함하지 않음. 여러 프로세스가 한 회원의 제한 행을 공유.
- 401 로그인 필요, 403 권한/가입/Origin 오류, 404 없는 글·권한 없는 글, 409 충돌, 422 입력·업무 규칙, 429 작성 제한, 503 DB 접근 오류.

공통 로그인·CORS 방식과 동일한 환경을 전제로 합니다. 실제 HTTPS 배포 시 쿠키·허용 Origin·DB 역할 설정은 팀 기존 배포 설정과 함께 검증해야 합니다.

## V2 추가 계약

- 댓글 목록: `items, accepted, next_cursor, page`. 30개씩 시간·ID 순으로 반환. 다음은 `?after=<next_cursor>`. 해결 답변은 `accepted`로 별도 반환하므로 페이지 위치와 무관하게 강조할 수 있습니다. 기존 `page` 입력도 유지하지만 새 화면은 cursor를 사용합니다.
- 새 답변 알림: 항목에 `comment_id` 추가. 삭제된 글·댓글 제외. V1의 연결 정보 없는 알림은 DB에 보존하되 새 알림함에서 제외합니다.
- 채택: comment ID와 읽은 `accepted_comment_version`을 함께 보냅니다. 없거나 변경됐으면 409. 질문 자체가 바뀌면 해결 답변을 재확인합니다.
- 모든 게시판 응답(401/403/404/409/413/422 포함)은 no-store입니다. 검증 오류는 입력 원문을 포함하지 않습니다. JSON 요청은 파싱 전 128KiB 제한, 허용하지 않는 제어문자·단독 surrogate는 422.
- 프론트는 15초 지연 시 입력을 유지하고, 등록 결과가 불확실한 새 글을 같은 token으로 재확인합니다.
