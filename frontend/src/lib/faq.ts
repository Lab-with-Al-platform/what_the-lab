/** WHAT THE LAB 통합 UI · API 기준 공개 도움말. 화면에 없는 동작은 약속하지 않습니다. */
export type FaqCategory = "start" | "account" | "discovery" | "requests" | "workspace" | "reviews" | "community" | "privacy";
export const FAQ_CATEGORIES: Record<FaqCategory, string> = {
  "start": "처음 시작하기",
  "account": "가입·계정",
  "discovery": "연구·전문가 탐색",
  "requests": "협업 요청·확정",
  "workspace": "협업 공간·일정",
  "reviews": "협업 평가·신뢰",
  "community": "게시판 이용",
  "privacy": "공개 범위·보안"
};

export type FaqGuideStep = { screen: string; heading: string; detail: string; focus: string; href: string };
export type FaqGuide = { title: string; steps: FaqGuideStep[]; note: string };
export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string[];
  links: { label: string; href: string }[];
  keywords: string[];
  guide?: FaqGuide;
};

export const FAQS: Faq[] = [
  {
    "id": "what-is-labbridge",
    "category": "start",
    "question": "WHAT THE LAB에서는 무엇을 할 수 있나요?",
    "answer": [
      "AI를 연구에 활용하려는 연구회원과 기술을 가진 AI 전문가를 연결하는 서비스입니다. 공개 연구 사례·AI 트렌드를 살펴보고 전문가의 기술과 공개 프로필을 검색할 수 있습니다.",
      "연구회원은 ‘내 연구’를 준비한 뒤 특정 전문가에게 직접 협업을 요청합니다. 협업이 시작되면 두 사람이 같은 협업 공간에서 일정과 할 일을 관리하고, 종료 후 참여자끼리 평가할 수 있습니다. 게시판에서 댓글을 받았다는 이유만으로 협업이 시작되지는 않습니다."
    ],
    "links": [
      {
        "label": "AI 전문가 찾기",
        "href": "/experts"
      },
      {
        "label": "연구 사례 살펴보기",
        "href": "/cases"
      }
    ],
    "keywords": [
      "서비스",
      "플랫폼",
      "연구",
      "AI"
    ]
  },
  {
    "id": "first-question",
    "category": "start",
    "question": "AI를 잘 모르는데 어디부터 시작하면 좋을까요?",
    "answer": [
      "정확한 모델 이름을 몰라도 괜찮습니다. ‘사진에서 세포 개수를 세고 싶어요’처럼 해결하려는 문제와 자료 유형, 기대 결과를 먼저 정리해 보세요. 공개 사례와 트렌드를 읽은 뒤 관련 질문을 게시판에 남길 수 있습니다.",
      "게시판 글쓰기의 ‘작성 틀 넣기’는 질문을 정리하는 데 도움이 됩니다. 연구 원자료·개인정보는 공개 글뿐 아니라 비공개 문의에도 적지 마세요."
    ],
    "links": [
      {
        "label": "AI 연구 사례",
        "href": "/cases"
      },
      {
        "label": "질문 남기기",
        "href": "/community/new?category=question"
      }
    ],
    "keywords": [
      "처음",
      "입문",
      "비전공자",
      "질문"
    ]
  },
  {
    "id": "researcher-expert",
    "category": "start",
    "question": "연구회원과 AI 전문가는 어떤 역할인가요?",
    "answer": [
      "연구회원은 연구 주제와 맡길 일, 기간과 데이터 공유 조건을 정리하고 전문가를 찾습니다. AI 전문가는 할 수 있는 기술과 경험, 협업 조건을 프로필에 작성해 요청을 받습니다.",
      "가입 역할에 따라 ‘내 연구’ 또는 ‘내 이력’ 등 사용 화면이 달라집니다. 협업을 시작하면 양쪽 모두 협업 공간에 접근하지만, 요청 수락·확정과 작업 완료처럼 각자 수행할 수 있는 동작은 다릅니다."
    ],
    "links": [
      {
        "label": "가입 유형 살펴보기",
        "href": "/signup"
      }
    ],
    "keywords": [
      "회원",
      "역할",
      "연구회원",
      "개발자",
      "전문가"
    ]
  },
  {
    "id": "unified-search",
    "category": "start",
    "question": "홈의 돋보기 검색과 각 메뉴의 검색은 어떻게 다른가요?",
    "answer": [
      "상단 돋보기에서 검색어를 입력하면 공개 인사이트, 공개 전문가 프로필, 공개 게시판 글, FAQ를 한 번에 살펴볼 수 있습니다. 결과를 누르면 해당 메뉴의 원본 화면으로 이동합니다.",
      "전문가의 기술·연구 분야를 세부적으로 고르려면 ‘AI 전문가 찾기’의 필터를 이용하세요. 비공개 문의, 공개하지 않은 전문가 이력, 비공개 연구 내용은 통합검색 결과에 포함되지 않습니다."
    ],
    "links": [
      {
        "label": "통합검색 열기",
        "href": "/search"
      },
      {
        "label": "전문가 검색",
        "href": "/experts"
      }
    ],
    "keywords": [
      "검색",
      "돋보기",
      "FAQ",
      "통합검색",
      "RAG"
    ],
    "guide": {
      "title": "하나의 검색, 네 가지 결과",
      "steps": [
        {
          "screen": "홈 · 상단 돋보기",
          "heading": "검색어 입력",
          "detail": "돋보기 아이콘을 누르고 찾고 싶은 AI 기술이나 연구 분야를 입력합니다.",
          "focus": "검색 / Enter",
          "href": "/"
        },
        {
          "screen": "통합검색",
          "heading": "결과 분류 확인",
          "detail": "인사이트·전문가·자유게시판·FAQ가 각각 별도 영역으로 나타납니다.",
          "focus": "관련 인사이트 · 관련 전문가 찾기",
          "href": "/search"
        },
        {
          "screen": "원본 콘텐츠",
          "heading": "자세히 살펴보기",
          "detail": "원하는 결과를 선택하면 각 서비스의 공개 원본 페이지에서 이어서 볼 수 있습니다.",
          "focus": "원본 페이지 이동",
          "href": "/experts"
        }
      ],
      "note": "해당 가이드는 실제 화면 캡처가 아닌 이동 구조 안내도입니다."
    }
  },
  {
    "id": "discord-login",
    "category": "account",
    "question": "가입과 로그인은 어떤 순서로 진행되나요?",
    "answer": [
      "로그인 화면에서 Discord 계정으로 본인을 확인합니다. 가입을 처음 진행한다면 연구회원·AI 전문가 중 역할을 고르고 해당 정보를 작성해야 합니다. Discord 인증만 했다고 가입 절차가 완료되는 것은 아닙니다.",
      "가입을 완료한 계정으로 게시글·댓글·저장, 협업 요청 등 역할에 맞는 기능을 이용할 수 있습니다. Discord DM 수신은 별도의 알림 설정과 Discord의 수신 허용 여부에 따라 달라질 수 있습니다."
    ],
    "links": [
      {
        "label": "로그인",
        "href": "/login"
      },
      {
        "label": "회원가입",
        "href": "/signup"
      }
    ],
    "keywords": [
      "Discord",
      "디스코드",
      "가입",
      "로그인",
      "계정"
    ]
  },
  {
    "id": "researcher-verification",
    "category": "account",
    "question": "연구회원의 소속 이메일 인증은 어떻게 하나요?",
    "answer": [
      "연구회원 가입 과정에서 대학·연구기관 이메일을 입력하고 안내된 인증번호로 소속을 확인합니다. 일반 개인 이메일은 기관 인증 대상으로 인정되지 않을 수 있습니다.",
      "메일이 오지 않으면 주소·스팸함·기관 이메일 수신 정책을 확인해 주세요. 인증번호와 비밀번호는 공개 게시판이나 문의에 적지 마세요."
    ],
    "links": [
      {
        "label": "연구회원 가입",
        "href": "/signup/researcher"
      }
    ],
    "keywords": [
      "연구회원",
      "인증번호",
      "소속",
      "기관",
      "학교",
      "이메일"
    ]
  },
  {
    "id": "login-problem",
    "category": "account",
    "question": "로그인이나 소속 인증이 진행되지 않아요.",
    "answer": [
      "먼저 화면의 오류 문구를 확인하고, 이메일 주소와 로그인 계정이 맞는지 살펴보세요. 브라우저를 다시 열어도 같은 오류가 생기면 발생 단계와 화면을 기록하는 것이 도움 됩니다.",
      "로그인이 가능하다면 비공개 문의를 이용해 주세요. 로그인조차 불가능한 상황이라면 운영팀이 별도로 공지한 연락 경로를 이용해야 합니다. 비밀번호·로그인 토큰·인증번호는 보내지 마세요."
    ],
    "links": [
      {
        "label": "비공개 문의",
        "href": "/community/new?visibility=private&category=support"
      }
    ],
    "keywords": [
      "로그인",
      "오류",
      "메일",
      "인증",
      "지원"
    ]
  },
  {
    "id": "expert-search-filter",
    "category": "discovery",
    "question": "내 연구와 맞는 AI 전문가는 어떻게 찾나요?",
    "answer": [
      "‘AI 전문가 찾기’에서 기술·연구 분야 등 공개 프로필 정보를 검색하고, 전문가의 상세 프로필에서 할 수 있는 일·포트폴리오·협업 조건을 확인할 수 있습니다.",
      "프로필의 경력·포트폴리오는 전문가가 직접 입력한 항목이 있을 수 있습니다. 플랫폼에서 종료된 협업 이력과 실제 참여자 평가, 시연용 표시는 구분해서 판단해 주세요. AI 기술을 기준으로 후보를 좁힌 뒤 직접 요청하는 방식입니다."
    ],
    "links": [
      {
        "label": "전문가 찾기",
        "href": "/experts"
      }
    ],
    "keywords": [
      "전문가",
      "필터",
      "기술",
      "협업",
      "추천",
      "검색"
    ]
  },
  {
    "id": "designate-research",
    "category": "discovery",
    "question": "‘내 연구’를 등록하고 지정하는 이유는 무엇인가요?",
    "answer": [
      "연구회원의 협업 요청에는 구체적인 연구 정보가 필요합니다. ‘내 연구’에서 연구 주제·맡길 일·필요 기술·협업 조건을 등록한 후 요청에 사용할 연구를 지정해 주세요.",
      "‘요청관리’의 보낸 요청 목록은 지정한 연구를 기준으로 보여줍니다. 다른 연구로 바꾸면 이전 요청이 삭제되는 것이 아니라, 화면에 표시되는 연구별 목록이 달라집니다."
    ],
    "links": [
      {
        "label": "내 연구",
        "href": "/my-research"
      },
      {
        "label": "요청관리",
        "href": "/requests"
      }
    ],
    "keywords": [
      "내 연구",
      "등록",
      "지정한 연구",
      "요청"
    ],
    "guide": {
      "title": "요청에 연결할 연구 지정",
      "steps": [
        {
          "screen": "내 연구",
          "heading": "연구 정보 준비",
          "detail": "연구 목적과 필요한 AI 기술, 역할과 공유 조건을 작성해 저장합니다.",
          "focus": "연구 등록",
          "href": "/my-research"
        },
        {
          "screen": "요청관리",
          "heading": "지정한 연구 선택",
          "detail": "보낸 요청을 확인할 기준 연구를 선택합니다.",
          "focus": "지정한 연구",
          "href": "/requests"
        },
        {
          "screen": "전문가 상세",
          "heading": "해당 연구로 요청",
          "detail": "요청 창에서 협업 일정과 조건을 확인하고 특정 전문가에게 보냅니다.",
          "focus": "협업 요청",
          "href": "/experts"
        }
      ],
      "note": "연구를 지정하면 기존 요청 기록이 삭제되는 것은 아닙니다."
    }
  },
  {
    "id": "profile-exposure",
    "category": "discovery",
    "question": "내 이력을 작성하면 전문가 찾기에 바로 표시되나요?",
    "answer": [
      "아니요. AI 전문가가 ‘내 이력’의 공개 필수 항목을 채워야 ‘요청 받기’ 스위치를 켤 수 있습니다. 입력 중인 정보만으로 자동 공개되지 않습니다.",
      "공개를 켜면 활성 공개 프로필이 전문가 찾기에 표시되고 협업 요청을 받을 수 있습니다. 쉬고 싶다면 공개를 끌 수 있으며, 사진과 일부 기본 정보는 ‘프로필 설정’에서 관리합니다."
    ],
    "links": [
      {
        "label": "내 이력",
        "href": "/my-career"
      },
      {
        "label": "프로필 설정",
        "href": "/settings/profile"
      },
      {
        "label": "전문가 찾기",
        "href": "/experts"
      }
    ],
    "keywords": [
      "이력",
      "프로필",
      "공개",
      "요청 받기",
      "전문가"
    ],
    "guide": {
      "title": "공개까지 세 단계",
      "steps": [
        {
          "screen": "내 이력",
          "heading": "공개 필수 항목 채우기",
          "detail": "소개·수행 기술·협업 조건 등 화면의 ‘공개 필수’ 항목을 완료합니다.",
          "focus": "공개 필수",
          "href": "/my-career"
        },
        {
          "screen": "내 이력",
          "heading": "요청 받기 켜기",
          "detail": "작성 항목이 충족되면 공개 스위치를 직접 활성화합니다.",
          "focus": "요청 받기",
          "href": "/my-career"
        },
        {
          "screen": "AI 전문가 찾기",
          "heading": "노출 상태 확인",
          "detail": "공개 활성 상태의 프로필이 검색 대상에 포함됩니다.",
          "focus": "전문가 카드",
          "href": "/experts"
        }
      ],
      "note": "공개 필수 항목이 부족하면 스위치가 비활성화될 수 있습니다."
    }
  },
  {
    "id": "lab-trust",
    "category": "discovery",
    "question": "전문가의 플라스크 ‘LAB TRUST’는 무엇을 뜻하나요?",
    "answer": [
      "LAB TRUST는 플랫폼에서 정상 완료된 협업에 대해 연구회원이 남긴 실제 평가를 바탕으로 계산하는 0~100점의 협업 신뢰 참고 지표입니다. 자격증·실력·연구 성과를 공식적으로 보증하는 점수는 아닙니다.",
      "정상 종료 후 7일이 지나고 공개 가능한 연구회원 평가가 최소 3건, 서로 다른 연구회원이 2명 이상일 때 숫자를 표시합니다. 같은 연구회원의 평가는 최근 최대 3건까지 반영하고, 표본이 부족하면 ‘평가 축적 중’이라고 안내합니다.",
      "중도 종료 협업과 숨김 처리된 평가는 공개 지수 계산에서 제외됩니다. 지수가 아직 없다고 검색 순위에 불이익을 주는 것은 아니며, 전문가 상세의 ‘점수 계산 원칙’을 펼쳐 확인할 수 있습니다."
    ],
    "links": [
      {
        "label": "전문가 프로필 확인",
        "href": "/experts"
      }
    ],
    "keywords": [
      "LAB TRUST",
      "플라스크",
      "지수",
      "신뢰",
      "점수",
      "평가 축적",
      "매너온도"
    ],
    "guide": {
      "title": "플라스크를 읽는 기준",
      "steps": [
        {
          "screen": "전문가 카드",
          "heading": "플라스크 확인",
          "detail": "숫자가 있으면 공개 가능한 협업 평가의 참고 지수이고, 아직 부족하면 ‘평가 축적 중’입니다.",
          "focus": "LAB TRUST",
          "href": "/experts"
        },
        {
          "screen": "전문가 상세",
          "heading": "점수 계산 원칙 펼치기",
          "detail": "최소 평가 수·독립 평가자 수·집계 기준을 확인할 수 있습니다.",
          "focus": "점수 계산 원칙",
          "href": "/experts"
        },
        {
          "screen": "협업 기록·평가",
          "heading": "이력과 함께 판단하기",
          "detail": "직접 등록한 포트폴리오와 플랫폼상 완료 협업 평가는 서로 다르므로 함께 확인하세요.",
          "focus": "이 서비스에서 한 연구 · 평가",
          "href": "/experts"
        }
      ],
      "note": "시연용 평점은 실제 검증된 협업 평가와 구분됩니다."
    }
  },
  {
    "id": "request-boundary",
    "category": "requests",
    "question": "게시판에서 답변을 받으면 자동으로 협업이 시작되나요?",
    "answer": [
      "아니요. 게시판 댓글은 공개 대화이고 협업 확정과 무관합니다. 협업하려면 연구회원이 ‘내 연구’를 준비하고 전문가 상세에서 해당 전문가에게 직접 요청해야 합니다.",
      "일반 요청은 전문가가 수락해도 바로 협업이 확정되지 않습니다. 연구회원이 ‘요청관리’에서 수락 내용을 확인하고 ‘협업 시작하기’를 선택해야 합니다. 단, 긴급 요청은 전문가가 수락하면 즉시 시작되는 별도 흐름입니다."
    ],
    "links": [
      {
        "label": "전문가 찾기",
        "href": "/experts"
      },
      {
        "label": "요청관리",
        "href": "/requests"
      }
    ],
    "keywords": [
      "댓글",
      "협업",
      "수락",
      "요청관리",
      "확정"
    ],
    "guide": {
      "title": "공개 대화와 실제 협업은 다릅니다",
      "steps": [
        {
          "screen": "자유게시판",
          "heading": "대화·답변 받기",
          "detail": "댓글은 문제를 함께 논의하는 용도입니다. 여기서는 협업 요청이 생성되지 않습니다.",
          "focus": "댓글 · 답변",
          "href": "/community"
        },
        {
          "screen": "전문가 상세",
          "heading": "협업 요청 보내기",
          "detail": "연구회원이 연구와 조건을 지정해 특정 전문가에게 요청을 보냅니다.",
          "focus": "협업 요청",
          "href": "/experts"
        },
        {
          "screen": "요청관리",
          "heading": "일반 요청 확정",
          "detail": "전문가가 수락한 요청의 내용을 확인하고 연구회원이 ‘협업 시작하기’를 누릅니다.",
          "focus": "수락함 · 선택 필요",
          "href": "/requests"
        },
        {
          "screen": "협업 공간",
          "heading": "공동 작업 시작",
          "detail": "확정된 협업이 목록에 나타나며 두 사람이 일정과 작업 요청을 관리합니다.",
          "focus": "진행 중",
          "href": "/workspace"
        }
      ],
      "note": "긴급 요청은 전문가 수락 즉시 협업이 시작되는 예외입니다."
    }
  },
  {
    "id": "request-status",
    "category": "requests",
    "question": "보낸 협업 요청은 어디에서 확인하고 확정하나요?",
    "answer": [
      "연구회원은 ‘요청관리’에서 지정한 연구로 보낸 요청을 확인합니다. 답변 대기, 수락됨·선택 필요, 거절·만료 등 상태에 따라 가능한 버튼이 달라집니다.",
      "전문가가 일반 요청을 수락하면 연구회원이 수락된 기간과 조건을 검토해 ‘협업 시작하기’를 선택합니다. 시작하지 않고 선택 기한이 지나면 요청이 만료될 수 있습니다. 전문가 계정에서는 받은 요청을 수락·거절하거나 조정해서 수락할 수 있습니다."
    ],
    "links": [
      {
        "label": "요청관리",
        "href": "/requests"
      },
      {
        "label": "내 연구",
        "href": "/my-research"
      }
    ],
    "keywords": [
      "요청관리",
      "답변 대기",
      "수락",
      "만료",
      "시작하기"
    ],
    "guide": {
      "title": "요청 상태에 따라 다음 행동이 달라집니다",
      "steps": [
        {
          "screen": "보낸 요청",
          "heading": "답 기다리기",
          "detail": "전문가가 답하기 전에는 요청이 대기 상태로 표시됩니다.",
          "focus": "답 기다리는 중",
          "href": "/requests"
        },
        {
          "screen": "받은 요청 · 전문가",
          "heading": "수락 또는 거절",
          "detail": "공유 조건을 확인한 뒤 수락하거나 거절합니다. 일반 요청에는 기간 조정 선택지가 있습니다.",
          "focus": "수락 · 거절",
          "href": "/requests"
        },
        {
          "screen": "수락됨 · 연구회원",
          "heading": "기간 검토 후 시작",
          "detail": "일반 요청은 연구회원이 최종적으로 ‘협업 시작하기’를 누릅니다.",
          "focus": "수락함 · 선택 필요",
          "href": "/requests"
        },
        {
          "screen": "협업 공간",
          "heading": "진행 상태 확인",
          "detail": "협업을 시작하면 별도 협업 공간에서 일정·작업을 관리할 수 있습니다.",
          "focus": "진행 중",
          "href": "/workspace"
        }
      ],
      "note": "상태가 거절·만료·취소로 바뀌면 동일한 버튼을 사용할 수 없습니다."
    }
  },
  {
    "id": "urgent-request",
    "category": "requests",
    "question": "긴급 협업 요청은 일반 요청과 어떻게 다른가요?",
    "answer": [
      "긴급 요청은 전문가에게 빠른 응답이 필요한 별도 요청 유형입니다. 일반 요청과 달리 전문가가 수락하는 순간 협업이 시작되는 흐름이어서, 연구회원의 별도 ‘협업 시작하기’ 단계를 기다리지 않습니다.",
      "요청을 보내기 전에 연구 범위·기간·데이터 공유 조건을 정확히 확인해 주세요. 수락 후 일정과 상태 변화는 ‘요청관리’와 ‘협업 공간’에서 확인할 수 있습니다."
    ],
    "links": [
      {
        "label": "요청관리",
        "href": "/requests"
      },
      {
        "label": "전문가 찾기",
        "href": "/experts"
      }
    ],
    "keywords": [
      "긴급",
      "급한",
      "즉시 시작",
      "수락"
    ],
    "guide": {
      "title": "일반 요청과 긴급 요청의 차이",
      "steps": [
        {
          "screen": "일반 요청",
          "heading": "수락 후 연구회원이 확정",
          "detail": "전문가가 수락하더라도 연구회원의 ‘협업 시작하기’가 남아 있습니다.",
          "focus": "수락 → 선택 필요",
          "href": "/requests"
        },
        {
          "screen": "긴급 요청",
          "heading": "전문가 수락 즉시 시작",
          "detail": "긴급 유형은 수락 자체가 협업 시작으로 이어질 수 있습니다.",
          "focus": "수락 → 협업 시작",
          "href": "/workspace"
        }
      ],
      "note": "긴급 요청은 확정 동작이 다르므로 전송 전 조건 확인이 특히 중요합니다."
    }
  },
  {
    "id": "period-adjustment",
    "category": "requests",
    "question": "전문가가 협업 기간을 변경해서 수락하면 어떻게 되나요?",
    "answer": [
      "일반 요청을 받은 전문가는 원래 기간 그대로 수락하거나 허용된 범위에서 기간을 조정해 수락할 수 있습니다. 연구회원은 ‘요청관리’에서 ‘기간 조정해서 수락’ 상태와 조정된 일정을 확인합니다.",
      "수락 내용이 자신의 연구 계획에 맞는지 살펴본 뒤 협업 시작 여부를 결정해 주세요. 시작 이후에는 협업 공간의 확정된 일정 범위를 기준으로 일정과 작업 요청을 관리합니다."
    ],
    "links": [
      {
        "label": "보낸·받은 요청 관리",
        "href": "/requests"
      }
    ],
    "keywords": [
      "기간 조정",
      "협업 일정",
      "수락",
      "요청"
    ]
  },
  {
    "id": "workspace-overview",
    "category": "workspace",
    "question": "협업이 시작되면 어디에서 무엇을 관리하나요?",
    "answer": [
      "‘협업 공간’의 ‘진행 중’ 탭에는 시작 전·진행 중 협업 목록, 통합 달력, 지금 할 일, 받은·보낸 작업 요청, 다가오는 일정이 표시됩니다. 하나의 협업은 연구회원 1명과 AI 전문가 1명의 1:1 작업 단위입니다.",
      "협업 카드를 열면 기간 타임라인, 두 사람의 정보, 합의 내용, 일정과 작업 요청 이력을 함께 볼 수 있습니다. 각 협업의 일정과 작업은 해당 협업 당사자만 접근할 수 있습니다."
    ],
    "links": [
      {
        "label": "협업 공간 열기",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "협업 공간",
      "내 협업",
      "달력",
      "타임라인",
      "해야 할 일"
    ],
    "guide": {
      "title": "협업 공간 한눈에 읽기",
      "steps": [
        {
          "screen": "협업 공간 · 진행 중",
          "heading": "내 협업 선택",
          "detail": "‘진행 중’에서 현재 또는 시작 전 협업을 찾습니다. 협업 카드별로 상태가 표시됩니다.",
          "focus": "진행 중 · 내 협업",
          "href": "/workspace"
        },
        {
          "screen": "협업 공간 · 달력",
          "heading": "전체 일정 살펴보기",
          "detail": "달력에는 선택한 협업의 일정과 기한이 있는 작업 요청이 함께 표시됩니다.",
          "focus": "달력 · 지금 할 일",
          "href": "/workspace"
        },
        {
          "screen": "협업 상세",
          "heading": "당사자별 작업 관리",
          "detail": "협업 카드를 누르면 받은·보낸·완료된 작업, 일정과 합의 내용을 확인합니다.",
          "focus": "요청 · 다가오는 일정",
          "href": "/workspace"
        }
      ],
      "note": "모바일에서는 지금 할 일과 일정 영역의 배치 순서가 달라질 수 있습니다."
    }
  },
  {
    "id": "workspace-schedules",
    "category": "workspace",
    "question": "협업 달력에 일정을 추가·수정·삭제하려면?",
    "answer": [
      "‘협업 공간’의 달력 또는 협업 상세에서 ‘일정 추가’를 누르고 협업·일정 종류(미팅, 작업 기간, 결과물 마감, 기타)·제목·날짜를 입력합니다. 일정은 확정된 협업 기간 안에서만 등록할 수 있습니다.",
      "같은 협업의 두 사람은 일정을 함께 봅니다. 일정을 눌러 내용을 확인하거나 진행 중인 협업에서 수정·삭제할 수 있으며, 일정 변경 알림은 사이트 알림에 나타날 수 있습니다. 협업이 종료되면 기존 기록은 볼 수 있지만 변경할 수 없습니다."
    ],
    "links": [
      {
        "label": "협업 달력",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "일정 추가",
      "일정 수정",
      "삭제",
      "미팅",
      "마감",
      "달력"
    ],
    "guide": {
      "title": "협업 일정 만들기",
      "steps": [
        {
          "screen": "협업 공간 · 달력",
          "heading": "날짜 또는 일정 추가 선택",
          "detail": "달력의 원하는 날짜를 누르거나 ‘+ 일정 추가’를 선택합니다.",
          "focus": "+ 일정 추가",
          "href": "/workspace"
        },
        {
          "screen": "일정 추가 창",
          "heading": "종류와 기간 설정",
          "detail": "미팅·작업 기간·결과물 마감·기타 중 선택하고 제목과 협업 기간 안의 날짜를 정합니다.",
          "focus": "어느 협업 일정인가요",
          "href": "/workspace"
        },
        {
          "screen": "협업 달력",
          "heading": "두 사람에게 반영",
          "detail": "저장한 일정은 해당 협업의 공유 달력에 표시됩니다. 목록에서 열어 수정·삭제할 수 있습니다.",
          "focus": "추가하기 → 일정 보기",
          "href": "/workspace"
        }
      ],
      "note": "일정을 삭제하면 상대방의 서비스 달력에서도 사라집니다."
    }
  },
  {
    "id": "repeat-schedule",
    "category": "workspace",
    "question": "매주 반복 미팅이나 여러 날 작업 기간도 등록할 수 있나요?",
    "answer": [
      "새로 추가하는 ‘하루짜리 미팅’에서만 ‘매주 같은 요일에 반복’을 선택할 수 있습니다. 반복은 협업 종료일까지의 범위 안에서 생성됩니다. 이미 생성한 일정의 수정 화면에는 반복 설정이 제공되지 않습니다.",
      "여러 날 이어지는 일정은 시작일과 종료일을 다르게 입력해 등록합니다. 시각 입력은 하루짜리 ‘미팅’ 또는 ‘기타’ 유형에서 사용할 수 있고, 종료 시각을 비우면 Google Calendar로 전달되는 일정은 기본 1시간으로 처리될 수 있습니다."
    ],
    "links": [
      {
        "label": "협업 달력",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "매주",
      "반복",
      "일정",
      "시작 시각",
      "종료 시각"
    ],
    "guide": {
      "title": "일정 유형에 따른 입력 차이",
      "steps": [
        {
          "screen": "하루짜리 미팅",
          "heading": "반복 미팅",
          "detail": "종류를 ‘미팅’으로 하고 시작일과 종료일을 같은 날짜로 설정하면 반복 선택지가 나타납니다.",
          "focus": "매주 같은 요일에 반복",
          "href": "/workspace"
        },
        {
          "screen": "여러 날 작업",
          "heading": "기간형 일정",
          "detail": "‘작업 기간’ 등에서 시작일과 종료일을 정해 여러 날 일정을 표시합니다.",
          "focus": "작업 기간 · 날짜 범위",
          "href": "/workspace"
        },
        {
          "screen": "하루짜리 미팅·기타",
          "heading": "시작·끝 시각",
          "detail": "시각을 입력하려면 하루짜리 미팅 또는 기타 유형을 선택합니다.",
          "focus": "시작 시각 · 끝 시각",
          "href": "/workspace"
        }
      ],
      "note": "반복 선택은 신규 하루짜리 미팅일 때만 제공됩니다."
    }
  },
  {
    "id": "google-calendar-sync",
    "category": "workspace",
    "question": "협업 일정을 내 Google Calendar에도 보려면?",
    "answer": [
      "서버의 Google Calendar 기능이 활성화된 경우, 진행 중인 협업의 ‘내 구글 캘린더에 추가’를 선택해 Google 계정으로 로그인합니다. 이어지는 Google Calendar의 캘린더 추가 화면에서 해당 협업 캘린더를 구독할 수 있습니다.",
      "Google 계정의 일반 캘린더 전체를 읽는 권한을 요청하는 방식이 아니라 협업 전용 캘린더를 공유받는 방식입니다. 일정의 원본 수정은 WHAT THE LAB의 협업 공간에서 해야 하며, 연동 기능이 설정되지 않았거나 협업이 종료되면 연결 버튼이 보이지 않을 수 있습니다."
    ],
    "links": [
      {
        "label": "협업 공간",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "Google",
      "구글",
      "캘린더",
      "일정",
      "구독",
      "연결"
    ],
    "guide": {
      "title": "서비스 일정 → Google Calendar",
      "steps": [
        {
          "screen": "협업 공간 · 진행 중",
          "heading": "캘린더 추가 버튼 찾기",
          "detail": "Google 연동이 활성화된 협업에 한해 ‘내 구글 캘린더에 추가’가 보입니다.",
          "focus": "내 구글 캘린더에 추가",
          "href": "/workspace"
        },
        {
          "screen": "Google 로그인",
          "heading": "사용할 계정 선택",
          "detail": "Google 로그인 후 해당 협업 캘린더를 공유받을 계정을 확인합니다.",
          "focus": "Google 계정 선택",
          "href": "/workspace"
        },
        {
          "screen": "Google Calendar",
          "heading": "캘린더 추가 확인",
          "detail": "Google 측 ‘이 캘린더 추가’ 화면을 확인합니다. 이후 일정 수정은 서비스 협업 공간에서 진행하세요.",
          "focus": "구글 캘린더에서 보기",
          "href": "/workspace"
        }
      ],
      "note": "외부 Google 승인 화면은 서비스 내부 화면 가이드로 대체 표시한 것이며 실제 Google 화면 캡처가 아닙니다."
    }
  },
  {
    "id": "workspace-task-vs-request",
    "category": "workspace",
    "question": "협업 공간의 ‘요청’과 전문가에게 보내는 ‘협업 요청’은 다른가요?",
    "answer": [
      "완전히 다른 기능입니다. ‘협업 요청’은 연구회원이 전문가에게 새 협업을 제안하는 것으로 ‘요청관리’에서 수락·거절·확정합니다.",
      "협업 공간의 ‘요청’은 이미 시작된 두 사람의 협업에서 ‘자료 정리해 주세요’처럼 상대방에게 맡기는 할 일입니다. 당사자는 ‘+ 상대에게 요청 남기기’로 일을 추가하고 받은·보낸·완료 탭으로 이력을 확인합니다. 이것만으로 새로운 협업이 만들어지지는 않습니다."
    ],
    "links": [
      {
        "label": "협업 요청 관리",
        "href": "/requests"
      },
      {
        "label": "협업 공간",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "작업 요청",
      "협업 요청",
      "요청",
      "받은",
      "보낸"
    ],
    "guide": {
      "title": "이름은 비슷해도 목적이 달라요",
      "steps": [
        {
          "screen": "요청관리",
          "heading": "협업을 시작하기 위한 요청",
          "detail": "연구회원이 전문가에게 새로운 협업을 제안합니다. 수락과 최종 확정 상태를 관리합니다.",
          "focus": "협업 시작하기",
          "href": "/requests"
        },
        {
          "screen": "협업 상세 · 요청",
          "heading": "이미 시작된 협업의 할 일",
          "detail": "협업 당사자가 상대에게 작업을 부탁하고 완료 여부·기한을 기록합니다.",
          "focus": "＋ 상대에게 요청 남기기",
          "href": "/workspace"
        }
      ],
      "note": "작업 요청은 협업 참여자끼리만 볼 수 있고, 새 전문가 매칭을 만들지 않습니다."
    }
  },
  {
    "id": "task-due-negotiation",
    "category": "workspace",
    "question": "받은 작업의 기한이 어렵다면 어떻게 조정하나요?",
    "answer": [
      "협업 상세의 ‘받은’ 요청에서 ‘기한 얘기하기’를 누르고 원하는 날짜 또는 지금 기한으로 어려운 이유를 입력합니다. 이때 받는 사람이 임의로 기한을 확정하는 것은 아닙니다.",
      "요청을 보낸 사람에게는 기한 협의 표시가 나타나며, 보낸 사람은 ‘기한 변경’ 또는 ‘지금 기한 유지’로 답할 수 있습니다. 협의 과정은 해당 요청의 기록에 남습니다."
    ],
    "links": [
      {
        "label": "협업 공간",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "기한 얘기하기",
      "기한 변경",
      "지금 기한 유지",
      "요청"
    ],
    "guide": {
      "title": "기한 변경은 두 단계로 협의해요",
      "steps": [
        {
          "screen": "받은 작업",
          "heading": "기한 얘기하기",
          "detail": "받은 사람이 희망 날짜 또는 조정이 필요한 이유를 남깁니다.",
          "focus": "기한 얘기하기",
          "href": "/workspace"
        },
        {
          "screen": "보낸 작업",
          "heading": "요청자에게 협의 표시",
          "detail": "원래 요청을 보낸 사람에게 기한 수정 요청이 표시됩니다.",
          "focus": "기한 수정 요청 · 답 기다림",
          "href": "/workspace"
        },
        {
          "screen": "보낸 작업",
          "heading": "새 기한 정하기",
          "detail": "요청자는 ‘기한 변경’ 또는 ‘지금 기한 유지’를 선택합니다.",
          "focus": "기한 변경 · 지금 기한 유지",
          "href": "/workspace"
        }
      ],
      "note": "상대방과 협의한 기록은 요청 이력에 남습니다."
    }
  },
  {
    "id": "task-complete-return",
    "category": "workspace",
    "question": "작업을 완료했는데 다시 요청하거나 되돌릴 수 있나요?",
    "answer": [
      "작업을 받은 사람만 ‘완료’를 누를 수 있습니다. 완료를 잘못 눌렀다면 받은 사람이 ‘↩ 되돌리기’를 통해 다시 진행 중으로 바꿀 수 있습니다.",
      "작업을 보낸 사람은 완료된 결과에 보완이 필요할 때 이유를 적어 ‘다시 요청’할 수 있습니다. 작업을 보낸 사람에게는 기한 변경·취소 권한이 있고, 작업을 받은 사람에게는 완료·기한 협의 권한이 있어 버튼이 서로 다르게 보입니다."
    ],
    "links": [
      {
        "label": "협업 상세",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "완료",
      "다시 요청",
      "되돌리기",
      "보낸",
      "받은"
    ],
    "guide": {
      "title": "작업을 맡긴 사람과 받은 사람의 권한",
      "steps": [
        {
          "screen": "받은 작업 · 진행 중",
          "heading": "완료 또는 기한 협의",
          "detail": "작업을 받은 사람은 ‘완료’ 또는 ‘기한 얘기하기’를 사용할 수 있습니다.",
          "focus": "완료 · 기한 얘기하기",
          "href": "/workspace"
        },
        {
          "screen": "보낸 작업 · 진행 중",
          "heading": "기한 변경 또는 취소",
          "detail": "작업을 보낸 사람에게는 ‘기한 변경’, ‘취소’가 표시됩니다.",
          "focus": "기한 변경 · 취소",
          "href": "/workspace"
        },
        {
          "screen": "완료된 작업",
          "heading": "되돌리기 또는 다시 요청",
          "detail": "완료를 누른 사람은 ‘되돌리기’, 작업을 보낸 사람은 사유를 적어 ‘다시 요청’할 수 있습니다.",
          "focus": "↩ 되돌리기 · 다시 요청",
          "href": "/workspace"
        }
      ],
      "note": "진행 종료된 협업에서는 버튼이 비활성화되고 기록 조회만 가능합니다."
    }
  },
  {
    "id": "workspace-completion",
    "category": "workspace",
    "question": "협업 기간이 끝나면 일정과 미완료 요청은 어떻게 되나요?",
    "answer": [
      "협업의 종료일이 지나면 진행 중인 협업은 자동으로 완료 상태로 바뀔 수 있습니다. 미완료 작업은 ‘협업 종료로 마감 · 미완료’ 이력으로 남고, 기존 작업 기록도 보존됩니다.",
      "완료된 협업은 ‘협업 공간’의 ‘완료’ 탭으로 이동하며, 달력에서 제외되고 일정·작업을 수정할 수 없는 읽기 전용 기록으로 남습니다. ‘완료’ 또는 ‘중도 종료’ 상태의 실제 참여자에게는 평가 작성 기능이 열릴 수 있습니다."
    ],
    "links": [
      {
        "label": "완료된 협업 보기",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "종료",
      "완료",
      "미완료",
      "읽기 전용",
      "평가"
    ],
    "guide": {
      "title": "협업 종료 전후 화면 변화",
      "steps": [
        {
          "screen": "진행 중",
          "heading": "일정·작업 관리",
          "detail": "진행 중에는 협업 일정과 작업 요청을 추가하거나 수정할 수 있습니다.",
          "focus": "진행 중 · 달력",
          "href": "/workspace"
        },
        {
          "screen": "종료일 경과",
          "heading": "자동 완료 처리",
          "detail": "열린 요청은 ‘협업 종료로 마감 · 미완료’ 기록이 남고 협업이 완료 탭으로 분류됩니다.",
          "focus": "완료 · 협업 기록 보기",
          "href": "/workspace"
        },
        {
          "screen": "완료 탭",
          "heading": "기록 열람과 평가",
          "detail": "기존 일정과 요청 기록은 볼 수 있지만 더는 수정할 수 없으며, 평가 가능한 종료 상태라면 ‘협업 평가하기’를 선택합니다.",
          "focus": "협업 기록 보기 · 협업 평가하기",
          "href": "/workspace"
        }
      ],
      "note": "시작 전 취소된 협업은 실제 협업 종료 평가 대상이 아닙니다."
    }
  },
  {
    "id": "workspace-notices",
    "category": "workspace",
    "question": "협업 일정·작업 요청 알림은 어디에서 확인하나요?",
    "answer": [
      "사이트 상단의 알림 종에서는 협업 요청 수락·거절뿐 아니라 협업 내부의 작업 등록·완료·기한 협의, 일정 변경, 종료 안내 등 관련 알림을 확인할 수 있습니다. 알림을 선택하면 해당 협업 상세 또는 작업 위치로 이동합니다.",
      "알림 목록은 최근 30일 기준으로 최대 50건까지 보여주고, 협업 공간의 ‘지금 할 일’과 ‘다가오는 일정’에서도 중요한 내용을 살펴볼 수 있습니다. 게시판의 새 답변 알림 목록은 이 협업 알림 종과 별도입니다."
    ],
    "links": [
      {
        "label": "협업 공간",
        "href": "/workspace"
      },
      {
        "label": "내 글의 새 답변",
        "href": "/community?scope=notifications"
      }
    ],
    "keywords": [
      "알림 종",
      "작업",
      "일정",
      "마감",
      "새 답변"
    ],
    "guide": {
      "title": "협업 알림의 이동 경로",
      "steps": [
        {
          "screen": "상단 알림 종",
          "heading": "최근 협업 알림 열기",
          "detail": "수락·일정·작업·종료 등 협업 관련 알림을 확인합니다.",
          "focus": "상단 알림 종",
          "href": "/workspace"
        },
        {
          "screen": "협업 상세",
          "heading": "알림의 관련 항목 확인",
          "detail": "작업 알림은 해당 요청 위치로, 평가 준비 알림은 평가 영역으로 이동하도록 연결됩니다.",
          "focus": "요청 내역 · 협업 평가",
          "href": "/workspace"
        },
        {
          "screen": "협업 공간 · 지금 할 일",
          "heading": "다가오는 일정 확인",
          "detail": "아직 처리할 일이 있으면 협업별 달력과 할 일 목록에서 확인합니다.",
          "focus": "지금 할 일 · 다가오는 일정",
          "href": "/workspace"
        }
      ],
      "note": "사이트 알림 종과 게시판의 ‘내 글의 새 답변’은 서로 다른 목록입니다."
    }
  },
  {
    "id": "calendar-discord",
    "category": "workspace",
    "question": "사이트 알림과 Discord DM·협업 채널은 어떻게 구분하나요?",
    "answer": [
      "사이트의 알림 종은 협업 요청과 협업 공간의 작업·일정·종료·평가 안내를 보여줍니다. Discord DM은 프로필 설정의 알림 연결·수신 동의, 서버 참여와 DM 허용 여부에 따라 달라질 수 있습니다.",
      "협업이 확정되면 협업 전용 Discord 채널을 준비하는 기능이 구현되어 있으며, 준비 중이면 서비스 화면에도 해당 상태가 표시될 수 있습니다. 채널에서의 대화와 서비스의 일정·작업 기록은 역할이 다릅니다. Discord·Google 등 외부 연동은 관리자 설정과 외부 서비스 상태에 따라 이용 가능 여부가 달라집니다."
    ],
    "links": [
      {
        "label": "알림 설정",
        "href": "/settings/profile#noti"
      },
      {
        "label": "협업 공간",
        "href": "/workspace"
      }
    ],
    "keywords": [
      "Discord",
      "디스코드",
      "DM",
      "채널",
      "알림",
      "설정"
    ]
  },
  {
    "id": "review-after-completion",
    "category": "reviews",
    "question": "협업 평가는 언제, 어디에서 작성하나요?",
    "answer": [
      "실제로 참여한 연구회원과 AI 전문가만 정상 완료 또는 중도 종료된 협업에 대해 종료 후 30일 이내 평가할 수 있습니다. ‘협업 공간 → 완료 → 협업 평가하기’에서 4개 항목(각 1~5점)과 선택 후기를 작성합니다.",
      "제출 후 48시간 이내에 한 번만 수정할 수 있습니다. 상대방에게 주어지는 개인 피드백은 종료 후 7일 공개 대기 정책을 따르고, 정상 완료된 협업의 공개 가능한 ‘연구회원 → 전문가’ 평가만 전문가의 공개 신뢰 지수 집계 대상입니다."
    ],
    "links": [
      {
        "label": "협업 공간 · 완료",
        "href": "/workspace"
      },
      {
        "label": "전문가 프로필",
        "href": "/experts"
      }
    ],
    "keywords": [
      "평가",
      "리뷰",
      "후기",
      "30일",
      "48시간",
      "7일"
    ],
    "guide": {
      "title": "협업 평가 시점과 버튼",
      "steps": [
        {
          "screen": "협업 공간 · 완료",
          "heading": "종료된 협업 선택",
          "detail": "‘완료’ 탭에서 실제 종료된 협업의 ‘협업 평가하기’를 선택합니다.",
          "focus": "협업 평가하기",
          "href": "/workspace"
        },
        {
          "screen": "협업 상세 · 평가",
          "heading": "4개 점수·선택 후기",
          "detail": "참여 당사자가 각 항목 1~5점을 입력합니다. 입력 가능한 기간과 수정 안내를 먼저 확인하세요.",
          "focus": "4가지 항목 평가",
          "href": "/workspace"
        },
        {
          "screen": "평가 저장 후",
          "heading": "내 평가·상대 피드백 확인",
          "detail": "제출한 평가는 48시간 이내 한 번 수정할 수 있고, 상대 피드백은 종료 7일 후에만 보일 수 있습니다.",
          "focus": "내가 제출한 평가",
          "href": "/workspace"
        }
      ],
      "note": "종료된 지 30일이 지나거나 해당 협업 참여자가 아니면 평가할 수 없습니다."
    }
  },
  {
    "id": "review-public-private",
    "category": "reviews",
    "question": "상대방 평가와 공개 LAB TRUST 점수는 무엇이 다른가요?",
    "answer": [
      "연구회원과 AI 전문가는 서로 평가할 수 있지만, 상대방이 나에게 남긴 개인 피드백은 협업 당사자에게만 제공됩니다. 연구회원에 대한 평가가 공개 전문가 지수에 더해지지는 않습니다.",
      "LAB TRUST는 정상 완료된 협업에서 연구회원이 AI 전문가에게 남긴 공개 가능한 평가만 모아 계산합니다. 중도 종료 평가·비공개 처리된 후기·종료 후 7일이 지나지 않은 평가는 공개 지수에 포함되지 않습니다. 부적절한 후기는 신고할 수 있으나 신고만으로 자동 삭제되지 않습니다."
    ],
    "links": [
      {
        "label": "평가 대상 협업",
        "href": "/workspace"
      },
      {
        "label": "LAB TRUST 확인",
        "href": "/experts"
      }
    ],
    "keywords": [
      "익명",
      "공개",
      "평가",
      "후기",
      "신고",
      "LAB TRUST"
    ]
  },
  {
    "id": "insight-question",
    "category": "community",
    "question": "연구 사례·트렌드를 보다가 질문을 남기려면?",
    "answer": [
      "게시판 글쓰기에서 ‘관련 사례·트렌드 연결’을 선택하면 공개 콘텐츠의 제목과 링크를 질문에 함께 표시할 수 있습니다. 연구 내용을 설명하는 데 도움이 되는 공개 자료를 연결해 보세요.",
      "연결되는 것은 공개 콘텐츠의 정보이며, ‘내 연구’에 저장한 비공개 설명이나 실제 연구 원자료가 자동으로 게시되는 것은 아닙니다."
    ],
    "links": [
      {
        "label": "공개 사례",
        "href": "/cases"
      },
      {
        "label": "질문 작성",
        "href": "/community/new?category=question"
      }
    ],
    "keywords": [
      "연구 사례",
      "트렌드",
      "인사이트",
      "질문"
    ]
  },
  {
    "id": "public-post",
    "category": "community",
    "question": "공개 게시글은 로그인하지 않아도 읽을 수 있나요?",
    "answer": [
      "네. 공개 글의 제목·본문·댓글과 작성자 닉네임·역할 등 공개 정보는 로그인하지 않은 방문자에게도 보일 수 있습니다.",
      "실명·개인 연락처·기관 미승인 연구 내용은 적지 마세요. 계정 문제나 개인적인 문의는 글을 등록하기 전에 ‘비공개 문의’를 선택해 주세요."
    ],
    "links": [
      {
        "label": "자유게시판",
        "href": "/community"
      },
      {
        "label": "글쓰기",
        "href": "/community/new"
      }
    ],
    "keywords": [
      "공개 글",
      "비회원",
      "조회",
      "댓글"
    ]
  },
  {
    "id": "accept-answer",
    "category": "community",
    "question": "도움이 된 댓글을 ‘해결 답변’으로 채택하려면?",
    "answer": [
      "글 작성자나 관리자는 댓글의 ‘해결 답변으로 채택’을 눌러 문제 해결에 도움이 된 답변을 표시할 수 있습니다. 목록에는 글이 ‘해결됨’ 상태로 구분됩니다.",
      "채택을 취소하거나 대화를 다시 열 수 있고, 채택된 댓글이 수정·삭제되는 등 상황에 따라 해결 상태가 다시 바뀔 수 있습니다. 해결 표시는 게시판 글의 상태이지 연구 성과나 전문가 자격을 인증하는 표시는 아닙니다."
    ],
    "links": [
      {
        "label": "내가 쓴 글",
        "href": "/community?scope=mine"
      }
    ],
    "keywords": [
      "채택",
      "해결",
      "댓글",
      "완료"
    ],
    "guide": {
      "title": "답변 채택 전후",
      "steps": [
        {
          "screen": "게시글 상세 · 댓글",
          "heading": "도움이 된 댓글 찾기",
          "detail": "글 작성자 계정에서 원하는 댓글 아래의 채택 버튼을 찾습니다.",
          "focus": "해결 답변으로 채택",
          "href": "/community?scope=mine"
        },
        {
          "screen": "채택 후",
          "heading": "해결 상태 확인",
          "detail": "해당 댓글이 채택되고 글 목록에는 ‘해결됨’이 표시됩니다.",
          "focus": "해결됨",
          "href": "/community"
        },
        {
          "screen": "필요한 경우",
          "heading": "채택 취소",
          "detail": "작성자 또는 관리자는 상황이 바뀌면 채택 상태를 되돌릴 수 있습니다.",
          "focus": "채택 취소",
          "href": "/community?scope=mine"
        }
      ],
      "note": "다른 사람의 글에서는 채택 권한이 없어 버튼이 표시되지 않을 수 있습니다."
    }
  },
  {
    "id": "save-notification",
    "category": "community",
    "question": "저장한 게시글과 내 글의 새 답변은 어디에 있나요?",
    "answer": [
      "상단 계정 메뉴의 ‘MY COMMUNITY’에서 ‘내가 쓴 글·문의’, ‘저장한 글’, ‘내 글의 새 답변’을 선택할 수 있습니다. 공개 글은 ‘저장’을 눌러 나중에 다시 볼 수 있습니다.",
      "‘내 글의 새 답변’은 게시판 댓글을 확인하는 메뉴로, 협업 요청·일정·작업을 안내하는 상단 알림 종과 별개입니다. 게시판 댓글이나 비공개 문의 본문은 Discord DM으로 자동 전송하지 않습니다."
    ],
    "links": [
      {
        "label": "저장한 글",
        "href": "/community?scope=saved"
      },
      {
        "label": "내 글의 새 답변",
        "href": "/community?scope=notifications"
      }
    ],
    "keywords": [
      "MY COMMUNITY",
      "북마크",
      "저장",
      "답변",
      "알림",
      "Discord"
    ],
    "guide": {
      "title": "두 알림함을 구별하는 방법",
      "steps": [
        {
          "screen": "프로필 메뉴 · MY COMMUNITY",
          "heading": "게시판 보관함 찾기",
          "detail": "저장한 글과 내가 쓴 글·문의, 새 답변을 확인합니다.",
          "focus": "저장한 글 · 내 글의 새 답변",
          "href": "/community?scope=saved"
        },
        {
          "screen": "상단 알림 종",
          "heading": "협업 알림 확인",
          "detail": "협업 요청·작업·일정 관련 알림은 상단 종 아이콘에서 확인합니다.",
          "focus": "알림 종",
          "href": "/workspace"
        }
      ],
      "note": "게시판의 새 댓글은 Discord DM으로 자동 전송하지 않습니다."
    }
  },
  {
    "id": "report",
    "category": "community",
    "question": "부적절한 글이나 후기는 어떻게 신고하나요?",
    "answer": [
      "게시판의 글·댓글에서 문제가 되는 내용은 ‘신고’ 기능이나 안내된 신고 절차로 운영팀에 알려 주세요. 개인정보 노출, 광고, 비방 등 사유를 구체적으로 적는 것이 도움이 됩니다.",
      "협업 평가의 공개 후기도 별도의 신고 기능으로 운영 검토를 요청할 수 있습니다. 신고가 접수됐다는 사실만으로 글이나 후기가 자동으로 삭제·비공개 처리되지는 않습니다."
    ],
    "links": [
      {
        "label": "게시판 이용 가이드",
        "href": "/community/guidelines"
      }
    ],
    "keywords": [
      "신고",
      "광고",
      "스팸",
      "개인정보",
      "후기"
    ]
  },
  {
    "id": "feedback",
    "category": "community",
    "question": "서비스 개선 제안이나 오류도 게시판에 남겨도 되나요?",
    "answer": [
      "네. 서비스 기능을 개선할 아이디어는 ‘아이디어·제안’ 글로 남길 수 있습니다. 화면 이름, 발생 상황, 기대한 동작을 함께 적으면 검토하는 데 도움이 됩니다.",
      "계정·인증·민감한 정보와 관련된 문제는 공개 글보다 비공개 문의를 이용해 주세요. 모든 제안의 채택이나 답변 기한이 보장되지는 않습니다."
    ],
    "links": [
      {
        "label": "아이디어·제안",
        "href": "/community/new?category=idea"
      },
      {
        "label": "비공개 문의",
        "href": "/community/new?visibility=private&category=support"
      }
    ],
    "keywords": [
      "아이디어",
      "개선",
      "건의",
      "제안"
    ]
  },
  {
    "id": "posting-limits",
    "category": "community",
    "question": "글쓰기 중 오류나 작성 한도 안내가 나와요.",
    "answer": [
      "글 등록이 실패하면 화면의 안내 문구를 확인하고 다시 시도해 주세요. 충돌 오류라면 같은 글의 최신 상태를 먼저 확인해야 할 수 있습니다. 페이지를 떠나면 저장하지 않은 내용이 사라질 수 있어요.",
      "반복 등록을 방지하기 위해 새 글은 시간당 10개, 게시판 작성 동작은 시간당 120회로 제한합니다. 비밀번호나 토큰을 첨부하지 않고 발생 시간과 오류 메시지를 비공개로 알려 주세요."
    ],
    "links": [
      {
        "label": "비공개로 오류 문의",
        "href": "/community/new?visibility=private&category=support"
      }
    ],
    "keywords": [
      "오류",
      "한도",
      "429",
      "글쓰기",
      "저장"
    ]
  },
  {
    "id": "private-post",
    "category": "privacy",
    "question": "비공개 문의는 누구에게 보이나요?",
    "answer": [
      "비공개 문의의 제목·내용·댓글은 작성자와 게시판 관리자만 확인할 수 있습니다. 일반 회원의 공개 게시판 목록이나 검색 결과에는 문의의 제목이나 작성 여부도 표시되지 않습니다.",
      "작성자는 ‘내가 쓴 글·문의’에서 확인할 수 있습니다. 관리자가 보는 문의이므로 비밀번호·인증번호·API 키·연구 원자료를 비공개 문의에도 적지 마세요."
    ],
    "links": [
      {
        "label": "비공개 문의 작성",
        "href": "/community/new?visibility=private&category=support"
      },
      {
        "label": "내가 쓴 글·문의",
        "href": "/community?scope=mine"
      }
    ],
    "keywords": [
      "비공개",
      "API 키",
      "비밀글",
      "관리자",
      "문의",
      "개인정보"
    ],
    "guide": {
      "title": "공개 글과 비공개 문의 구분",
      "steps": [
        {
          "screen": "게시판 글쓰기",
          "heading": "공개 범위 선택",
          "detail": "등록 전에 ‘공개 대화’ 또는 ‘비공개 문의’를 선택합니다.",
          "focus": "누가 볼 수 있나요?",
          "href": "/community/new"
        },
        {
          "screen": "비공개 문의",
          "heading": "작성자·관리자만 확인",
          "detail": "일반 회원의 공개 목록과 검색에는 보이지 않습니다.",
          "focus": "비공개 문의",
          "href": "/community/new?visibility=private&category=support"
        },
        {
          "screen": "내가 쓴 글·문의",
          "heading": "내 문의 다시 확인",
          "detail": "작성자 계정의 ‘내가 쓴 글·문의’에서 해당 문의와 답변을 확인합니다.",
          "focus": "내가 쓴 글·문의",
          "href": "/community?scope=mine"
        }
      ],
      "note": "등록한 뒤에는 공개·비공개를 전환할 수 없습니다."
    }
  },
  {
    "id": "change-visibility",
    "category": "privacy",
    "question": "이미 올린 글을 공개에서 비공개로 바꿀 수 있나요?",
    "answer": [
      "현재는 글 등록 후 공개 범위를 변경할 수 없습니다. 이미 작성된 댓글의 공개 범위까지 뜻하지 않게 바뀌는 문제를 막기 위한 정책입니다.",
      "공개 글에 민감한 내용을 잘못 적었다면 확인 가능한 본문을 즉시 수정하거나 글을 삭제하고, 필요한 경우 비공개로 운영팀에 알려 주세요. 외부에 복제된 내용까지 회수된다고 보장할 수는 없습니다."
    ],
    "links": [
      {
        "label": "내가 쓴 글 확인",
        "href": "/community?scope=mine"
      }
    ],
    "keywords": [
      "비공개 전환",
      "수정",
      "삭제",
      "개인정보"
    ]
  },
  {
    "id": "research-data",
    "category": "privacy",
    "question": "연구 데이터·파일을 게시판이나 협업 요청에 올려도 되나요?",
    "answer": [
      "게시판에는 연구 원자료, 개인정보, 비밀자료를 올리지 않는 것이 원칙입니다. 현재 게시판은 파일 첨부 기능을 제공하지 않습니다. 연구 데이터는 종류·규모·준비 상태 같은 개요만 설명해 주세요.",
      "전문가에게 협업을 요청할 때도 공개할 수 있는 연구 목적과 데이터 공유 조건을 정리하는 단계로 이해해 주세요. 실제 원자료 전달은 소속 기관의 승인, 연구윤리·보안 규정, 당사자 합의를 별도로 확인한 뒤 진행해야 합니다."
    ],
    "links": [
      {
        "label": "안전한 게시판 가이드",
        "href": "/community/guidelines"
      },
      {
        "label": "내 연구",
        "href": "/my-research"
      }
    ],
    "keywords": [
      "원자료",
      "첨부",
      "파일",
      "개인정보",
      "보안",
      "IRB",
      "NDA"
    ]
  }
];

/** 검색어는 NFKC로 통일하고, 모든 단어가 포함된 질문만 반환합니다. */
export function searchFaqs(query: string, category = "all"): Faq[] {
  const words = query.normalize("NFKC").toLocaleLowerCase("ko").trim().split(/\s+/).filter(Boolean);
  return FAQS.filter(item => (category === "all" || item.category === category) &&
    words.every(word => [item.question, ...item.answer, ...item.keywords].join(" ").normalize("NFKC").toLocaleLowerCase("ko").includes(word)));
}
