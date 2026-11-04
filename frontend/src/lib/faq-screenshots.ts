/** Screenshots from the real Next.js product UI, rendered in Playwright.
 * Each image contains only isolated synthetic API fixture data and an in-frame label.
 * Never claim these sample records are real user data or live integration evidence.
 */
export type FaqScreenshot = {
  src: string;
  title: string;
  alt: string;
};
export const FAQ_SCREENSHOTS: Record<string, FaqScreenshot[]> = {
  "unified-search": [
    { src: "/faq/screenshots/global-search.png", title: "전체 서비스 통합검색", alt: "WHAT THE LAB 실제 통합검색 화면. RAG 검색어 아래에 인사이트, 전문가, 자유게시판, FAQ 분류가 표시됩니다." },
  ],
  "workspace-overview": [
    { src: "/faq/screenshots/workspace-overview.png", title: "협업 공간 · 진행 중과 달력", alt: "실제 협업 공간 화면. 내 협업, 달력, 지금 할 일, 작업 요청, 다가오는 일정 영역을 볼 수 있습니다. 시연용 연구 데이터가 사용되었습니다." },
  ],
  "workspace-schedules": [
    { src: "/faq/screenshots/schedule-add-dialog.png", title: "일정 추가 입력 창", alt: "실제 서비스의 일정 추가 모달. 협업과 미팅 종류, 제목, 시작일·종료일을 선택하는 입력 화면입니다." },
  ],
  "repeat-schedule": [
    { src: "/faq/screenshots/schedule-add-dialog.png", title: "미팅 일정 추가 화면", alt: "실제 서비스의 일정 입력 창. 신규 하루짜리 미팅에서 반복 설정을 선택할 수 있습니다." },
  ],
  "workspace-task-vs-request": [
    { src: "/faq/screenshots/workspace-task-detail.png", title: "협업 안에서 주고받는 작업 요청", alt: "실제 협업 상세 화면의 요청 섹션. 전체, 받은, 보낸, 완료 탭과 작업 요청 카드가 표시됩니다." },
  ],
  "task-due-negotiation": [
    { src: "/faq/screenshots/workspace-due-talk.png", title: "받은 작업의 기한 협의 창", alt: "실제 협업 상세에서 기한 얘기하기를 선택해 연 입력 창입니다. 시연용 협업 데이터가 사용되었습니다." },
  ],
  "task-complete-return": [
    { src: "/faq/screenshots/workspace-task-actions.png", title: "받은·보낸·완료 작업 구분", alt: "실제 협업 상세의 작업 요청 카드. 권한에 따라 완료, 기한 변경, 취소, 다시 요청 버튼이 달라집니다." },
  ],
  "workspace-completion": [
    { src: "/faq/screenshots/workspace-finished.png", title: "완료된 협업 기록과 평가 진입", alt: "실제 협업 공간 완료 탭의 종료 협업 카드. 협업 기록 보기와 협업 평가하기 링크가 보입니다." },
  ],
  "review-after-completion": [
    { src: "/faq/screenshots/collaboration-review.png", title: "종료 후 협업 평가 작성", alt: "실제 협업 평가 컴포넌트. 4가지 항목의 점수 입력과 선택 후기 영역이 표시됩니다." },
  ],
  "workspace-notices": [
    { src: "/faq/screenshots/collaboration-notifications.png", title: "사이트 상단 협업 알림", alt: "실제 상단 알림 종의 목록 화면. 작업, 일정, 평가 준비 등 시연용 알림이 표시됩니다." },
  ],
  "private-post": [
    { src: "/faq/screenshots/private-inquiry.png", title: "비공개 문의 선택 화면", alt: "실제 게시판 글쓰기에서 공개 대화와 비공개 문의를 선택하는 영역입니다. 시연용 연구회원 계정으로 렌더링되었습니다." },
  ],
};
