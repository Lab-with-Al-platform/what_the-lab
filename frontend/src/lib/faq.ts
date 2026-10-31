export type FaqCategory =
  "start" | "account" | "collaboration" | "community" | "privacy";
export const FAQ_CATEGORIES: Record<FaqCategory, string> = {
  start: "처음 시작하기",
  account: "가입·계정",
  collaboration: "연구·전문가 탐색",
  community: "게시판 이용",
  privacy: "공개 범위·보안",
};
export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string[];
  links: { label: string; href: string }[];
  keywords: string[];
};
export const FAQS: Faq[] = [
  {
    id: "what-is-labbridge",
    category: "start",
    question: "랩브릿지는 어떤 곳인가요?",
    answer: [
      "AI 기술을 활용하고 싶은 연구자와 실제 연구 문제를 함께 풀고 싶은 AI 개발자가 만나는 공간입니다. 연구 사례를 읽고 필요한 기술을 알아보거나, 전문가 정보를 탐색하고 질문을 나눌 수 있습니다.",
      "게시판은 연구 질문과 서비스 피드백을 나누는 공간입니다. 글이나 댓글을 남기는 것만으로 협업이 확정되지는 않습니다.",
    ],
    links: [{ label: "연구 사례 둘러보기", href: "/cases" }],
    keywords: ["소개", "서비스", "플랫폼"],
  },
  {
    id: "first-question",
    category: "start",
    question: "AI를 잘 몰라도 질문할 수 있나요?",
    answer: [
      "물론입니다. 정확한 기술명을 몰라도 해결하고 싶은 문제와 지금까지 시도한 것을 알려 주세요. 예를 들어 ‘세포 사진에서 개수를 세고 싶은데 어디부터 시작하면 될까요?’처럼 적어도 괜찮습니다.",
      "글쓰기의 ‘작성 틀 넣기’를 사용하면 질문을 정리하기 쉽습니다. 아직 준비되지 않은 개인정보나 연구 원자료는 올리지 마세요.",
    ],
    links: [
      { label: "첫 질문 작성하기", href: "/community/new?category=question" },
    ],
    keywords: ["초보", "비전공", "처음", "기술"],
  },
  {
    id: "researcher-expert",
    category: "start",
    question: "연구자와 AI 개발자는 무엇이 다른가요?",
    answer: [
      "연구자는 자신의 연구 문제와 필요한 도움을 정리하고, AI 개발자는 할 수 있는 일과 경험을 프로필에 정리합니다. 연구 분야 경험이 적어도 자신의 기술과 경험을 사실대로 소개할 수 있습니다.",
      "가입 역할은 현재 제공되는 화면과 작성 항목을 구분하기 위한 기준입니다. 역할을 잘못 골랐거나 변경이 필요하다면 비공개 문의로 알려 주세요.",
    ],
    links: [
      {
        label: "비공개로 문의하기",
        href: "/community/new?visibility=private&category=support",
      },
    ],
    keywords: ["역할", "전문가", "개발자", "회원"],
  },
  {
    id: "discord-login",
    category: "account",
    question: "어떻게 가입하고 로그인하나요?",
    answer: [
      "로그인 화면에서 Discord 계정으로 인증한 뒤, 안내에 따라 연구자 또는 AI 전문가 가입 정보를 작성합니다. 게시판의 글·댓글·저장 기능은 가입을 마친 계정으로 이용할 수 있습니다.",
      "Discord로 계정을 확인하고, 알림 연결을 승인하면 협업 요청 관련 DM을 받을 수 있습니다. 프로필 설정에서 연결 상태와 수신 설정을 확인해 주세요. 게시판의 비공개 문의 내용은 Discord로 자동 전송하지 않습니다.",
    ],
    links: [{ label: "로그인으로 이동", href: "/login" }],
    keywords: ["디스코드", "가입", "인증", "로그인"],
  },
  {
    id: "login-problem",
    category: "account",
    question: "로그인이나 소속 인증이 잘되지 않아요.",
    answer: [
      "발생한 화면, 진행 순서, 오류 문구를 정리해 주세요. 브라우저를 새로 열고 다시 로그인해 보아도 문제가 계속되면 문의가 필요합니다.",
      "로그인이 가능하면 비공개 문의를 남겨 주세요. 로그인 자체가 불가능하면 서비스 운영팀이 별도로 안내한 문의 경로를 이용해 주세요. 비밀번호·인증번호·토큰은 보내지 마세요.",
    ],
    links: [
      {
        label: "비공개 문의 작성",
        href: "/community/new?visibility=private&category=support",
      },
    ],
    keywords: ["오류", "메일", "기관", "학교", "인증번호"],
  },
  {
    id: "profile-exposure",
    category: "collaboration",
    question: "내 이력을 공개하면 전문가 찾기에 표시되나요?",
    answer: [
      "내 이력은 가입한 AI 전문가가 자신의 소개·조건·포트폴리오를 관리하는 공간입니다. 프로필 공개에는 필수 작성 항목을 충족해야 합니다.",
      "공개로 설정한 활성 AI 전문가의 프로필은 전문가 찾기에 표시됩니다. 닉네임·소개·수행 기술·연구 분야로 검색하며, 프로필 사진과 소속은 프로필 설정에서 관리할 수 있습니다.",
    ],
    links: [
      { label: "내 이력 확인", href: "/my-career" },
      { label: "프로필 설정", href: "/settings/profile" },
      { label: "전문가 찾기", href: "/experts" },
    ],
    keywords: ["프로필", "포트폴리오", "검색", "공개"],
  },
  {
    id: "request-boundary",
    category: "collaboration",
    question: "게시판에서 답변을 받으면 협업이 시작되나요?",
    answer: [
      "아닙니다. 댓글은 의견과 경험을 나누는 대화입니다. 연구 목표·역할·일정·공유 조건은 당사자가 별도로 확인해야 합니다.",
      "실제 협업을 요청하려면 연구회원이 ‘내 연구’에 등록한 연구를 선택해 전문가에게 협업 요청을 보내세요. ‘요청관리’에서 전문가의 수락·거절을 확인하고, 수락된 요청은 연구회원이 별도로 협업 시작을 처리합니다. 게시판 댓글이 이 절차를 자동 실행하지는 않습니다.",
    ],
    links: [{ label: "전문가 정보 둘러보기", href: "/experts" }, {label: "요청관리", href: "/requests"}],
    keywords: ["요청", "매칭", "수락", "확정", "프로젝트"],
  },
  {
    id: "lab-trust",
    category: "collaboration",
    question: "전문가 프로필의 플라스크(LAB TRUST)는 무엇인가요?",
    answer: [
      "LAB TRUST는 플랫폼에서 정상 종료된 협업에 대해 연구회원이 작성한 평가를 근거로 보여주는 협업 신뢰 참고 지표입니다. 5점 별점과는 다른, 0~100 사이의 지수예요. 액체가 채워진 플라스크로 표시되며, 점수만으로 전문성이나 자격을 보증하지는 않습니다.",
      "최소 3건의 공개 가능 평가와 서로 다른 연구회원 2명 이상이 있어야 숫자가 나옵니다. 데이터가 적은 신규 전문가에게는 '평가 축적 중'이 표시되며, 불이익 점수나 검색 순위 하락은 없습니다. 동일 연구회원의 평가는 최근 3건까지만 반영합니다.",
      "평가는 정상 종료되고 7일이 지난 협업만 반영됩니다. 4개 항목의 가중평균을 소규모 표본에 맞게 조정하며, 후기 비공개 결정은 다음 조회부터 반영돼요. 자세한 계산 기준은 전문가 상세 프로필의 '점수 계산 원칙'을 펼쳐 확인할 수 있습니다.",
    ],
    links: [{ label: "AI 전문가 찾아보기", href: "/experts" }],
    keywords: ["LAB TRUST", "신뢰", "플라스크", "평점", "온도", "매너온도", "별점", "지수", "평가", "후기", "미산정"],
  },
  {
    id: "review-after-completion",
    category: "collaboration",
    question: "AI 전문가와의 협업 평가는 언제 작성하고 점수에 반영되나요?",
    answer: [
      "해당 협업에 참여한 연구자와 AI 전문가만 프로젝트가 종료된 뒤 30일 이내에 평가할 수 있습니다. 협업 공간의 '완료' 항목에서 평가하기를 눌러 4가지 점수와 선택 후기를 작성해 주세요.",
      "기본적으로 제출 후 48시간 이내에 한 번만 수정할 수 있습니다. 상대방의 피드백과 공개 평점에는 프로젝트 종료 후 7일 공개 대기 정책이 적용돼요.",
      "LAB TRUST에는 정상 완료한 협업에서 연구회원이 전문가에게 남긴 공개 가능한 평가만 반영합니다. 중도 종료·비공개 처리된 후기는 전문가의 공개 신뢰 지수에 포함되지 않습니다.",
    ],
    links: [{ label: "내 협업 공간", href: "/workspace" }, { label: "전문가 둘러보기", href: "/experts" }],
    keywords: ["협업 평가", "평점 작성", "프로젝트 종료", "LAB TRUST", "리뷰", "수정", "후기"],
  },
  {
    id: "insight-question",
    category: "collaboration",
    question: "사례를 읽다가 궁금해진 내용을 어떻게 질문하나요?",
    answer: [
      "글쓰기에서 ‘관련 사례·트렌드 연결’을 선택하고 궁금한 점을 적어 주세요. 읽고 있던 글의 맥락을 함께 전달할 수 있습니다.",
      "연결되는 것은 공개 콘텐츠의 제목과 링크입니다. 내 연구의 비공개 설명이나 원자료를 자동으로 가져오지는 않습니다.",
    ],
    links: [
      { label: "사례에서 시작하기", href: "/cases" },
      { label: "질문 작성", href: "/community/new?category=question" },
    ],
    keywords: ["인사이트", "논문", "트렌드", "사례"],
  },
  {
    id: "calendar-discord",
    category: "collaboration",
    question: "Discord 알림과 일정 공유는 어디에서 설정하나요?",
    answer: [
      "협업 요청과 상태 변경은 상단 알림 종에서 확인합니다. Discord DM은 프로필 설정의 알림 영역에서 연결·수신 설정을 확인하세요. 연결 상태와 Discord의 DM 허용 여부에 따라 수신이 달라질 수 있습니다.",
      "캘린더 동기화나 자동 협업 채널 생성은 현재 제공 범위에 포함되지 않습니다. 게시판 문의·댓글은 협업 알림과 별도이며 비공개 내용을 DM으로 보내지 않습니다.",
    ],
    links: [{ label: "알림 설정", href: "/settings/profile#noti" }, {label: "요청관리", href: "/requests"}],
    keywords: ["캘린더", "일정", "채널", "봇", "알림"],
  },
  {
    id: "public-post",
    category: "community",
    question: "공개 글은 누구나 읽을 수 있나요?",
    answer: [
      "네. 공개 글의 제목·본문·태그·댓글은 로그인하지 않은 방문자도 읽을 수 있습니다. 작성자의 닉네임과 역할도 함께 표시됩니다.",
      "개인 연락처나 공개 승인을 받지 않은 연구 내용을 적지 마세요. 공개하고 싶지 않은 문의는 작성 전에 ‘비공개 문의’를 선택해 주세요.",
    ],
    links: [{ label: "글쓰기", href: "/community/new" }],
    keywords: ["비회원", "노출", "범위", "닉네임"],
  },
  {
    id: "private-post",
    category: "privacy",
    question: "비공개 문의는 누가 볼 수 있나요?",
    answer: [
      "작성자와 게시판 관리자만 제목·본문·댓글을 볼 수 있습니다. 일반 공개 목록과 다른 회원의 검색 결과에는 제목이나 작성 여부도 표시하지 않습니다.",
      "작성자는 ‘내가 쓴 글·문의’, 관리자는 ‘관리자 · 비공개 문의’에서 확인합니다. 관리자에게도 보여서는 안 되는 비밀번호·API 키·인증번호·연구 원자료는 적지 마세요.",
    ],
    links: [
      { label: "내 문의 확인", href: "/community?scope=mine" },
      {
        label: "비공개 문의 작성",
        href: "/community/new?visibility=private&category=support",
      },
    ],
    keywords: ["비밀글", "관리자", "잠금", "개인정보", "비공개"],
  },
  {
    id: "change-visibility",
    category: "privacy",
    question: "등록한 뒤 공개·비공개를 바꿀 수 있나요?",
    answer: [
      "현재는 등록한 글의 공개 범위를 바꿀 수 없습니다. 이미 댓글을 작성한 다른 회원의 내용을 뜻하지 않게 공개하는 일을 막기 위한 규칙입니다.",
      "공개 글에 민감한 정보를 잘못 적었다면 우선 본문에서 해당 내용을 지우거나 글을 삭제하고, 비공개 문의로 운영팀에 알려 주세요. 외부에 복사된 자료까지 회수할 수 있다고 보장하지는 않습니다.",
    ],
    links: [{ label: "내가 쓴 글 확인", href: "/community?scope=mine" }],
    keywords: ["전환", "수정", "삭제", "공개", "비공개"],
  },
  {
    id: "research-data",
    category: "privacy",
    question: "연구 데이터나 파일을 게시판에 올려도 되나요?",
    answer: [
      "게시판에는 연구 원자료와 개인정보가 포함된 자료를 올리지 않습니다. 필요한 경우 식별정보를 제외한 데이터의 종류·규모·준비 상태만 설명해 주세요.",
      "첨부파일 업로드는 제공하지 않습니다. 실제 자료 공유는 기관의 승인과 당사자 간 보안 조건을 확인한 별도 절차에서 진행해야 합니다.",
    ],
    links: [
      { label: "안전한 게시판 이용 가이드", href: "/community/guidelines" },
    ],
    keywords: ["첨부", "파일", "보안", "원자료", "데이터", "IRB", "NDA"],
  },
  {
    id: "accept-answer",
    category: "community",
    question: "답변이 도움이 됐어요. 해결 표시는 어떻게 하나요?",
    answer: [
      "글 작성자와 관리자는 댓글의 ‘해결 답변으로 채택’을 눌러 도움이 된 답변을 표시할 수 있습니다. 해결한 글은 목록에 ‘해결됨’으로 구분됩니다.",
      "채택을 취소하거나 대화를 다시 열 수 있습니다. 채택된 댓글이 수정·삭제되면 글은 다시 ‘대화 중’으로 바뀝니다. 해결 표시는 게시글 수준의 판단이며, 연구 성과나 전문가 역량을 인증하지 않습니다.",
    ],
    links: [{ label: "내가 쓴 글 확인", href: "/community?scope=mine" }],
    keywords: ["채택", "해결", "댓글", "답변"],
  },
  {
    id: "save-notification",
    category: "community",
    question: "저장한 글과 새 답변은 어디에서 보나요?",
    answer: [
      "공개 글에서 ‘저장’을 누르면 ‘저장한 글’에 모아 볼 수 있습니다. 비공개 문의는 ‘내가 쓴 글·문의’에서 확인합니다.",
      "내 글에 다른 회원이나 관리자가 댓글을 남기면 게시판의 ‘내 글의 새 답변’에 표시됩니다. 상단 알림 종의 협업 요청 알림과 구분하며, 게시판 댓글·비공개 문의는 이메일이나 Discord로 자동 전송하지 않습니다.",
    ],
    links: [
      { label: "저장한 글", href: "/community?scope=saved" },
      { label: "새 답변 확인", href: "/community?scope=notifications" },
    ],
    keywords: ["북마크", "저장", "알림", "이메일"],
  },
  {
    id: "report",
    category: "community",
    question: "광고나 부적절한 글·댓글은 어떻게 신고하나요?",
    answer: [
      "글 하단의 ‘신고’에서 개인정보 노출·광고·비방 등의 유형과 내용을 알려 주세요. 댓글을 신고하려면 해당 글에서 문제 댓글을 설명해 주세요.",
      "신고만으로 글을 자동 삭제하지 않습니다. 관리자는 신고 내용을 확인하고 글 숨김·복구, 댓글 삭제 등 필요한 조치를 수행합니다. 신고 내용은 관리자만 확인합니다.",
    ],
    links: [{ label: "커뮤니티 이용 가이드", href: "/community/guidelines" }],
    keywords: ["신고", "댓글", "스팸", "광고", "삭제"],
  },
  {
    id: "feedback",
    category: "community",
    question: "서비스 개선 의견도 남겨도 되나요?",
    answer: [
      "환영합니다. ‘아이디어·제안’에서 어느 화면의 어떤 상황이 불편했는지, 어떻게 달라지면 좋을지 알려 주세요. 공개 제안은 다른 회원의 경험도 함께 들을 수 있습니다.",
      "개인적인 오류나 계정 정보가 포함되면 비공개로 남겨 주세요. 모든 제안의 반영이나 답변 기한을 보장하지는 않습니다.",
    ],
    links: [
      { label: "개선 의견 남기기", href: "/community/new?category=idea" },
    ],
    keywords: ["개선", "건의", "제안", "피드백"],
  },
  {
    id: "posting-limits",
    category: "community",
    question: "글쓰기 중 오류가 나거나 한도 안내가 나와요.",
    answer: [
      "등록에 실패하면 작성 내용은 화면에 남습니다. 오류 안내를 확인하고 다시 시도해 주세요. 다른 사람이 글의 상태를 바꾼 경우 최신 글을 먼저 확인해야 할 수 있습니다.",
      "반복 등록을 줄이기 위해 새 글은 시간당 10개, 게시판 작성 동작은 시간당 120회로 제한합니다. 새로고침하거나 페이지를 떠나면 저장되지 않은 내용은 사라질 수 있으니 먼저 보관해 주세요.",
    ],
    links: [
      {
        label: "비공개로 오류 문의",
        href: "/community/new?visibility=private&category=support",
      },
    ],
    keywords: ["실패", "한도", "429", "충돌", "저장"],
  },
];

export function searchFaqs(query: string, category = "all"): Faq[] {
  const words = query
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return FAQS.filter(
    (faq) =>
      (category === "all" || faq.category === category) &&
      words.every((word) =>
        [faq.question, ...faq.answer, ...faq.keywords]
          .join(" ")
          .normalize("NFKC")
          .toLocaleLowerCase("ko")
          .includes(word),
      ),
  );
}
