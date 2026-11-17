/** Source-grounded illustrations, never Discord screenshots or live integration evidence. */
export type DiscordScene = {
  title: string;
  surface: "channel" | "private" | "dm" | "website";
  view: "message" | "form" | "panel" | "list" | "notice";
  heading: string;
  text: string;
  fields?: { label: string; value: string }[];
  actions?: string[];
  outcome: string;
};
export type DiscordGuide = {
  title: string;
  prerequisite: string;
  scenes: DiscordScene[];
  reflection: string[];
  caution: string;
};

/** The same guide can explain a boundary in an existing FAQ and a dedicated Discord FAQ. */
export const DISCORD_GUIDES: Record<string, DiscordGuide> = {
  "discord-connect": {
    title: "연결부터 첫 DM까지",
    prerequisite: "가입을 마친 계정 · 서버의 Discord 연동이 활성화된 경우",
    scenes: [
      { title: "연결 시작", surface: "website", view: "notice", heading: "프로필 설정 → 알림", text: "‘디스코드 알림 연결’을 선택합니다. 로그인할 때 서버 참가가 되지 않았다면 여기서 다시 연결할 수 있어요.", actions: ["디스코드 알림 연결"], outcome: "Discord 승인 화면으로 이동합니다. 승인 화면 자체는 이 안내도에서 재현하지 않습니다." },
      { title: "수신 확인", surface: "website", view: "panel", heading: "디스코드 연결됨", text: "DM 수신과 알림 종류를 확인한 뒤 테스트를 보내 보세요. ‘연결됨’만으로 DM 수신이 보장되지는 않아요.", actions: ["디스코드 DM으로 받기", "테스트 DM 보내기"], outcome: "테스트 DM은 연결·수신 여부를 확인하는 동작입니다." },
      { title: "테스트 DM", surface: "dm", view: "message", heading: "LabBridge 알림 테스트예요", text: "이 메시지가 보이면 디스코드 알림이 잘 연결된 거예요.", outcome: "정상적으로 받은 경우의 메시지 예시입니다. 실제 수신 성공을 뜻하는 화면이 아닙니다." },
    ],
    reflection: ["사이트 알림 종은 DM 수신 설정과 별개", "협업 채널 알림은 Discord의 채널 알림 설정도 확인"],
    caution: "Discord 승인·DM 허용 메뉴는 실제 앱에서 확인해 주세요. 버전·언어에 따라 화면이 다를 수 있어요.",
  },
  "calendar-discord": {
    title: "알림을 받는 세 곳",
    prerequisite: "DM은 연결·수신 동의·서버 참가·Discord 수신 허용이 필요",
    scenes: [
      { title: "개인 DM", surface: "dm", view: "message", heading: "협업 요청이 도착했어요 · 예시", text: "새 협업 요청의 도착·응답·확정과 평가 안내는 조건에 따라 봇 DM으로 전달돼요. 제안의 수락·거절은 사이트 요청관리에서 진행해요.", actions: ["요청관리로 이동하는 링크"], outcome: "DM은 새 협업을 제안하는 과정의 알림입니다. /요청은 이미 시작된 협업 안의 작업 기능이에요." },
      { title: "협업 채널", surface: "channel", view: "message", heading: "작업·일정 변경 안내", text: "@상대에게 작업 등록·완료·기한 협의와 일정 변경을 알려요. 개인 DM을 끄더라도 채널 메시지와 멘션은 별도로 동작해요.", actions: ["요청 관리", "일정 관리"], outcome: "게시판 댓글·비공개 문의 본문은 이 DM이나 채널로 자동 전송하지 않아요." },
      { title: "사이트 알림", surface: "website", view: "list", heading: "상단 알림 종", text: "협업 요청·작업·일정·종료·평가 알림을 확인하고 해당 화면으로 이동해요. 최근 30일, 최대 50건을 보여줘요.", outcome: "외부 알림이 오지 않아도 사이트에서 현재 기록을 확인하세요." },
    ],
    reflection: ["협업 제안·평가 안내 → 조건부 DM", "작업·일정 → 채널 안내 + 사이트 알림"],
    caution: "메시지 도착과 휴대폰 푸시는 달라요. Discord·기기 알림 설정과 외부 서비스 상태에 따라 달라집니다.",
  },
  "discord-channel": {
    title: "확정된 협업 채널 열기",
    prerequisite: "사이트에서 협업 확정 · 두 계정의 서버 참가 · 채널 생성 완료",
    scenes: [
      { title: "확정 안내", surface: "dm", view: "message", heading: "협업 확정 안내 · 예시", text: "채널이 준비되면 확정 안내 DM에 ‘둘만의 협업 채널’과 ‘협업 공간’ 링크가 포함될 수 있어요.", actions: ["둘만의 협업 채널", "협업 공간"], outcome: "DM이 오지 않아도 사이트 협업 상세의 ‘디스코드 채널’에서 열 수 있어요." },
      { title: "채널 열기", surface: "channel", view: "message", heading: "# 협업-번호", text: "해당 협업의 참여자끼리 준비 사항과 진행 내용을 대화해요. 일반 대화는 작업·일정으로 자동 등록되지 않아요.", outcome: "다른 일반 회원에게 비공개인 채널입니다. 서버 소유자·관리자는 접근할 수 있어요." },
      { title: "준비 중이면", surface: "website", view: "notice", heading: "디스코드 채널 준비 중", text: "채널 생성이 늦어질 수 있어요. 잠시 후 협업 상세를 다시 확인하고, 계속 열리지 않으면 비공개 문의로 알려 주세요.", outcome: "사이트의 준비 중 표시는 원인을 확정한 오류 진단이 아닙니다." },
    ],
    reflection: ["채널 대화와 사이트 협업 기록은 서로 다른 역할", "서버 재참가 후에도 채널이 안 보이면 문의"],
    caution: "채널명만으로 다른 협업을 찾지 마세요. 사이트가 제공하는 해당 협업 링크를 이용하세요.",
  },
  "discord-task-create": {
    title: "대화에서 작업으로 남기기",
    prerequisite: "시작일이 된 진행 중 협업 · 해당 협업의 참여자",
    scenes: [
      { title: "명령 선택", surface: "channel", view: "list", heading: "/요청", text: "해당 협업 채널의 입력창에서 /요청을 선택하세요. 봇 개인 DM이나 일반 서버 채널에서는 사용할 수 없어요.", actions: ["/요청", "/받은요청", "/보낸요청"], outcome: "일반 채팅 문장은 자동으로 작업이 되지 않아요." },
      { title: "내용 입력", surface: "private", view: "form", heading: "요청 남기기", text: "상대에게 맡길 작업을 구체적으로 적어요.", fields: [{ label: "요청 내용", value: "예제 데이터의 열 이름을 정리해 주세요." }, { label: "기한 (선택 · 비우면 기한 없음)", value: "내일" }], outcome: "기한은 오늘부터 협업 종료일 사이로 정해요. 비우면 기한 없이 등록됩니다." },
      { title: "함께 확인", surface: "channel", view: "message", heading: "요청 · 보낸 사람 → @받은 사람", text: "예제 데이터의 열 이름을 정리해 주세요.\n기한: 내일 · 입력 예시", actions: ["요청 관리"], outcome: "저장된 작업을 사이트에서도 확인할 수 있어요. 연구회원·전문가 모두 상대에게 작업을 남길 수 있어요." },
    ],
    reflection: ["Discord 입력 → 사이트와 같은 작업 기록에 저장", "상대에게 사이트 알림 + 협업 채널 안내"],
    caution: "안내도에 있는 입력란·버튼 모양은 설명용입니다. 여기서는 실제 작업이 생성되지 않아요.",
  },
  "discord-task-permissions": {
    title: "같은 작업, 서로 다른 관리 버튼",
    prerequisite: "진행 중인 작업 · 해당 작업의 ‘요청 관리’ 선택",
    scenes: [
      { title: "받은 사람", surface: "private", view: "panel", heading: "받은 요청이에요", text: "작업을 마쳤으면 완료를, 기한이 어렵다면 기한 얘기하기를 선택해요.", actions: ["완료", "기한 얘기하기"], outcome: "작업을 받은 사람만 완료할 수 있어요." },
      { title: "보낸 사람", surface: "private", view: "panel", heading: "보낸 요청이에요", text: "보낸 작업의 기한을 바꾸거나 요청을 취소할 수 있어요.", actions: ["기한 변경", "요청 취소"], outcome: "역할은 연구회원·전문가 구분이 아니라 이 작업을 누가 보냈는지로 정해요." },
      { title: "취소 확인", surface: "private", view: "notice", heading: "요청을 취소할까요?", text: "취소를 확정하기 전에 작업을 다시 확인해요. 취소한 작업은 보낸 사람이 되돌릴 수 있어요.", actions: ["네, 취소할게요", "아니요"], outcome: "처음 ‘요청 관리’를 여는 것만으로 작업이 변경되지는 않아요." },
    ],
    reflection: ["개인 관리 패널은 누른 사람에게만 표시", "처리 결과는 채널 메시지와 사이트 기록에 반영"],
    caution: "개인 관리 패널은 10분 뒤 만료될 수 있어요. 원래 메시지의 ‘요청 관리’를 다시 열어 주세요.",
  },
  "task-due-negotiation": {
    title: "기한을 제안하고 답하기",
    prerequisite: "진행 중 작업 · 받은 사람의 기한 협의 → 보낸 사람의 응답",
    scenes: [
      { title: "변경 제안", surface: "private", view: "form", heading: "기한 얘기하기", text: "받은 사람이 원하는 기한과 이유를 적어요. 원하는 기한은 비워도 돼요.", fields: [{ label: "원하는 기한", value: "3일 뒤" }, { label: "이유", value: "예제 데이터의 형식을 확인할 시간이 더 필요해요." }], outcome: "이 단계에서는 기존 기한이 바뀌지 않아요." },
      { title: "보낸 사람 응답", surface: "private", view: "panel", heading: "상대가 기한 수정을 요청했어요", text: "보낸 사람이 변경하거나 지금 기한을 유지할 수 있어요.", actions: ["기한 변경", "지금 기한 유지", "요청 취소"], outcome: "기한 변경 창에는 상대가 제안한 날짜가 미리 채워져요." },
      { title: "기한 변경", surface: "private", view: "form", heading: "기한 변경", text: "새 기한을 확인한 뒤 제출해요. 비우면 기한 없음으로 바뀝니다.", fields: [{ label: "새 기한", value: "제안한 날짜 · 예시" }], outcome: "보낸 사람이 변경을 저장한 뒤 사이트와 채널에 반영돼요." },
      { title: "기한 유지", surface: "private", view: "form", heading: "지금 기한 유지", text: "현재 기한을 유지하는 이유는 선택 사항이에요.", fields: [{ label: "이유 (선택)", value: "예정된 검토 전에 필요해요." }], outcome: "기한은 유지되고 상대에게 응답을 알려요. 이유와 협의 이력은 사이트의 요청 기록에서도 확인해요." },
    ],
    reflection: ["제안만으로 기한을 확정하지 않음", "기한 변경·유지 → 상대에게 채널 안내 + 사이트 알림"],
    caution: "이미 완료·취소된 작업이나 종료된 협업은 변경할 수 없어요. 상대가 먼저 처리했다면 최신 상태를 다시 확인하세요.",
  },
  "task-complete-return": {
    title: "완료, 되돌리기, 다시 요청",
    prerequisite: "협업은 진행 중 · 작업의 보낸 사람과 받은 사람 구분",
    scenes: [
      { title: "작업 완료", surface: "private", view: "panel", heading: "받은 요청이에요", text: "받은 사람이 작업을 끝낸 뒤 완료를 선택해요.", actions: ["완료", "기한 얘기하기"], outcome: "채널 작업 메시지가 완료로 바뀌고 보낸 사람에게 알려요." },
      { title: "실수 되돌리기", surface: "private", view: "panel", heading: "완료한 요청이에요", text: "완료를 잘못 눌렀다면 완료한 사람, 즉 받은 사람이 되돌려요.", actions: ["되돌리기"], outcome: "같은 작업이 다시 진행 중으로 바뀝니다. 취소한 작업의 되돌리기는 보낸 사람이 해요." },
      { title: "결과 보완 요청", surface: "private", view: "form", heading: "다시 요청", text: "완료된 결과가 부족하면 보낸 사람이 이유를 적어 다시 요청해요.", fields: [{ label: "무엇이 부족한가요", value: "날짜 열의 형식도 함께 맞춰 주세요." }, { label: "새 기한 (비우면 원래 기한)", value: "3일 뒤" }], outcome: "새 협업이 생성되는 것이 아니라 같은 작업이 다시 진행 중으로 바뀌어요." },
    ],
    reflection: ["완료·다시 요청 이력은 사이트 작업 기록에 보존", "Google 연동 중이면 완료 작업을 캘린더에서 제거하도록 반영"],
    caution: "원래 기한이 지났다면 다시 요청할 때 유효한 새 기한을 적어 주세요. 협업이 종료되면 이 조작은 사용할 수 없어요.",
  },
  "discord-task-list": {
    title: "작업을 찾아 관리 화면으로",
    prerequisite: "해당 협업 채널 · 실제 참여자 계정",
    scenes: [
      { title: "받은 작업", surface: "private", view: "list", heading: "/받은요청", text: "받은 진행 중 작업을 확인해요. 다시 요청된 작업은 ‘내가 답할 것’으로 구분돼요.", fields: [{ label: "내가 답할 것", value: "날짜 열 형식 보완 · 다시 요청됨" }, { label: "진행 중", value: "예제 데이터 열 이름 정리" }], actions: ["처리할 요청 고르기"], outcome: "제목 링크로 원래 메시지에 이동하거나 드롭다운에서 작업을 선택해요." },
      { title: "보낸 작업", surface: "private", view: "list", heading: "/보낸요청", text: "상대의 기한 협의는 ‘내가 답할 것’, 완료된 작업은 ‘최근 완료 (7일)’에 표시될 수 있어요.", actions: ["처리할 요청 고르기"], outcome: "목록은 전체 보관함이 아니에요. 표시되지 않은 오래된 기록은 사이트 협업 상세에서 확인해요." },
      { title: "관리로 이동", surface: "private", view: "panel", heading: "선택한 작업 관리", text: "선택한 작업과 내 권한에 맞는 버튼이 표시돼요.", actions: ["기한 변경", "요청 취소", "← 목록으로"], outcome: "예시는 진행 중 작업을 보낸 사람의 화면이에요. ‘← 목록으로’로 최신 목록을 다시 확인해요." },
    ],
    reflection: ["목록·관리 패널은 나에게만 보임", "공유 작업 기록은 사이트에서도 확인 가능"],
    caution: "목록 본문은 최대 15개, 선택 메뉴는 최대 25개예요. 목록·메뉴는 10분 뒤 다시 열어야 할 수 있어요.",
  },
  "discord-schedule": {
    title: "채널에서 일정을 등록하기",
    prerequisite: "시작일이 된 진행 중 협업 · 일정은 확정된 협업 기간 안",
    scenes: [
      { title: "종류 선택", surface: "channel", view: "list", heading: "/일정", text: "종류를 먼저 선택해요. 매주반복은 새 하루짜리 미팅에 사용할 수 있어요.", actions: ["미팅", "작업 기간", "결과물 마감", "기타"], outcome: "종류에 따라 입력창의 날짜·기간·시각 항목이 달라져요." },
      { title: "미팅 입력", surface: "private", view: "form", heading: "일정 추가 · 미팅", text: "하루짜리 미팅·기타는 시각을 입력할 수 있어요. 시각을 비우면 시각 없이 등록돼요.", fields: [{ label: "제목", value: "예제 데이터 검토 미팅" }, { label: "날짜", value: "내일" }, { label: "시각 (선택 · 비우면 시각 없이)", value: "14:00~15:00" }, { label: "메모 (선택)", value: "확인할 열 목록 준비" }], outcome: "날짜·시각을 읽지 못하면 저장하지 않고 올바른 형식을 안내해요." },
      { title: "여러 날 작업", surface: "private", view: "form", heading: "일정 추가 · 작업 기간", text: "여러 날 이어지는 작업은 시작일~종료일로 적어요.", fields: [{ label: "제목", value: "예제 데이터 정리" }, { label: "기간 (시작~끝)", value: "내일~3일 뒤" }, { label: "메모 (선택)", value: "열 이름·날짜 형식 점검" }], outcome: "작업 기간 입력창에는 시각 입력란이 없어요." },
      { title: "함께 확인", surface: "channel", view: "message", heading: "@상대에게 · 일정을 추가했어요", text: "예제 데이터 검토 미팅 · 미팅 · 입력한 날짜와 시각", actions: ["일정 관리"], outcome: "두 사람이 사이트 달력에서도 같은 일정을 확인해요. 연결된 협업 Google 캘린더에는 별도 반영 과정이 있어요." },
    ],
    reflection: ["사이트와 Discord가 같은 일정 저장 기능을 사용", "저장 후 사이트 알림·채널 안내·연결된 캘린더 반영"],
    caution: "알림이 늦다고 같은 일정을 반복 등록하지 마세요. 먼저 사이트에 저장됐는지 확인하세요.",
  },
  "discord-schedule-manage": {
    title: "일정을 찾아 고치거나 지우기",
    prerequisite: "해당 협업 참여자 · 변경은 시작일이 된 진행 중 협업에서",
    scenes: [
      { title: "일정 목록", surface: "private", view: "list", heading: "/일정목록 · 다가오는 일정 (2주)", text: "최대 25개를 날짜·시각 순으로 확인해요. 제목 링크가 있으면 원래 채널 메시지로 이동할 수 있어요.", actions: ["관리할 일정 고르기"], outcome: "전체 과거 기록은 사이트 협업 상세에서 확인해요." },
      { title: "일반 일정", surface: "private", view: "panel", heading: "선택한 일정", text: "두 참여자 모두 해당 일정을 관리할 수 있어요. 수정창에는 기존 값이 채워져요.", actions: ["수정", "삭제", "← 목록으로"], outcome: "Discord 수정창에서 제공하지 않는 종류·장소·담당 값은 유지돼요." },
      { title: "삭제 확인", surface: "private", view: "notice", heading: "이 일정을 지울까요?", text: "삭제하려는 일정과 범위를 먼저 확인하세요. 상대에게도 알려요.", actions: ["네, 지울게요", "아니요"], outcome: "삭제 후 원래 채널 메시지는 취소선으로 바뀌고 관리 버튼이 제거될 수 있어요. 일정 삭제에는 되돌리기 버튼이 없어요." },
    ],
    reflection: ["날짜·시각 변경·삭제 → 채널 멘션 + 사이트 알림", "제목·메모만 수정 → 원래 메시지 갱신 + 사이트 알림"],
    caution: "제목·메모만 수정할 때는 새 멘션 메시지를 보내지 않아요. 패널이 만료되면 ‘일정 관리’를 다시 열어 주세요.",
  },
  "repeat-schedule": {
    title: "반복 일정의 수정 범위 확인",
    prerequisite: "새 하루짜리 미팅에서 매주반복 선택 · 협업 종료일까지 최대 26회",
    scenes: [
      { title: "반복 만들기", surface: "channel", view: "notice", heading: "/일정 → 종류: 미팅 → 매주반복", text: "같은 요일의 미팅을 생성해요. 이미 만들어진 일정의 수정창에서 새 반복을 켜는 기능은 없어요.", outcome: "협업 기간 안에서만 생성되며 최대 26회로 제한돼요." },
      { title: "범위 선택", surface: "private", view: "panel", heading: "매주 반복 일정이에요", text: "이 날짜 하나만 바꿀지, 이 날짜와 그 뒤 일정을 모두 바꿀지 구분하세요.", actions: ["수정", "이 날짜 이후 모두 수정", "삭제", "이 날짜 이후 모두 삭제"], outcome: "선택한 날짜보다 앞선 반복 일정은 일괄 변경 대상이 아니에요." },
      { title: "함께 수정", surface: "private", view: "form", heading: "반복 일정 모두 수정 · 미팅", text: "날짜를 옮기면 대상 일정들도 같은 일수만큼 옮겨져요.", fields: [{ label: "제목", value: "주간 예제 검토 미팅" }, { label: "날짜", value: "변경할 날짜" }, { label: "시각 (선택)", value: "15:00~16:00" }], outcome: "대상 중 하나라도 협업 기간을 벗어나면 저장할 수 없어요. 삭제도 범위 확인 후 확정하세요." },
    ],
    reflection: ["한 번만 변경과 이후 일괄 변경을 구분", "대상 일정들을 저장하고 변경 안내를 묶어서 전달"],
    caution: "‘이 날짜 이후 모두’에는 현재 선택한 날짜도 포함돼요. 삭제 전 대상 범위를 확인하세요.",
  },
  "discord-waiting": {
    title: "확정됐지만 아직 시작 전이라면",
    prerequisite: "협업이 확정됐고 시작일이 아직 오지 않은 상태",
    scenes: [
      { title: "준비 대화", surface: "channel", view: "message", heading: "# 협업-번호 · 시작 전", text: "채널이 준비되면 시작일 전에도 대화하며 준비할 수 있어요. 작업·일정 등록은 시작일부터 가능해요.", outcome: "협업 확정과 실제 시작일은 서로 다른 시점이에요." },
      { title: "명령 제한", surface: "private", view: "notice", heading: "협업이 시작 예정일에 시작돼요", text: "그 전에는 요청·일정을 쓸 수 없어요. 이 채널에서 대화로 준비해 주세요.", outcome: "시작일 미루기·협업 취소는 사이트 협업 상세에서 요청할 수 있어요." },
      { title: "시작일 변경", surface: "channel", view: "message", heading: "@상대에게 · 시작일을 미루자고 했어요", text: "기존 시작일 → 제안 시작일 · 함께 바뀌는 종료일\n사유와 답변 기한을 확인해 주세요.", actions: ["수락", "다시 얘기해요"], outcome: "요청을 받은 사람만 답할 수 있어요. 수락하면 시작일·종료일이 같은 일수만큼 밀려요." },
      { title: "다시 협의", surface: "private", view: "form", heading: "시작일 미루기 · 다시 얘기해요", text: "제안한 날짜가 어렵다면 다시 얘기해요로 답할 수 있어요.", fields: [{ label: "한 줄 이유 (선택)", value: "다른 시작일을 함께 정하고 싶어요." }], outcome: "거절 응답이며 기존 기간은 유지돼요. 필요하면 채널에서 다시 의논하세요." },
    ],
    reflection: ["시작일 미루기 → 상대 수락 뒤 기간 변경", "최대 14일 · 수락된 변경은 협업당 한 번"],
    caution: "응답 기한이 지났거나 이미 답한 요청은 다시 처리할 수 없어요. 시작 전 취소는 채널을 잠그고 2일 뒤 삭제하도록 예약해요.",
  },
  "discord-ending": {
    title: "기간 변경부터 종료 후 보관까지",
    prerequisite: "진행 중 협업 · 기간 연장·조기 완료·중단 조작은 사이트에서",
    scenes: [
      { title: "연장 안내", surface: "channel", view: "message", heading: "@상대에게 · 기간 연장을 요청했어요", text: "새 종료일·사유·답변 기한을 확인하고 사이트 링크에서 답해 주세요. 조기 완료 요청도 같은 방식으로 웹에서 답해요.", actions: ["웹에서 답하는 링크"], outcome: "시작일 미루기와 달리 Discord 응답 버튼이 없어요. 채팅으로 동의한 것만으로 기간이 바뀌지 않아요." },
      { title: "완료 안내", surface: "channel", view: "message", heading: "협업이 완료됐어요", text: "30일 안에 서로 평가를 남겨 주세요 → 사이트 협업 상세\n이 채널은 안내된 삭제 예정일에 삭제돼요. 필요한 파일은 그 전에 받아 두세요.", outcome: "정상 완료의 예시입니다. 중단은 사유를 안내하고, 중단당한 참여자만 평가할 수 있어요." },
      { title: "읽기 전용", surface: "channel", view: "notice", heading: "대화는 읽기만 가능", text: "완료·중단·시작 전 취소 후에는 채널에 새 메시지·파일·반응을 남길 수 없도록 잠가요. 기존 메시지 읽기와 파일 받기는 가능해요.", outcome: "채널은 잠근 뒤 2일 후 삭제하도록 예약해요. 사이트 협업 기록과 Discord 대화·파일의 보관 방식은 달라요." },
    ],
    reflection: ["사이트에서 종료 상태 저장 → 채널 안내·잠금·삭제 예약", "평가 작성은 사이트에서 · 시작 전 취소는 평가 없음"],
    caution: "삭제 시점은 서버·외부 서비스 상태에 따라 지연될 수 있어요. 자동 대화 내보내기·파일 백업 기능을 제공하는 것은 아니에요.",
  },
  "discord-briefing": {
    title: "오늘 챙길 일을 한눈에",
    prerequisite: "서버가 실행 중 · 해당 협업에 알릴 작업이나 일정이 있는 경우",
    scenes: [
      { title: "채널 브리핑", surface: "channel", view: "list", heading: "오늘 챙길 일 · 예시", text: "필요한 참여자를 멘션하고 작업·일정 안내를 한 메시지로 묶어요.", fields: [{ label: "@받은 사람", value: "오늘 기한인 작업 확인" }, { label: "@두 참여자", value: "오늘 미팅 일정 확인" }], outcome: "한국 시간 오전 9시 이후 처음 실행돼요. 정확히 정각 도착을 보장하지 않아요." },
      { title: "사이트 확인", surface: "website", view: "notice", heading: "오늘 챙길 일이 있어요", text: "사이트 알림 종에서는 협업마다 하루 한 칸으로 묶어서 확인해요. 사이트 협업 공간의 지금 할 일도 살펴보세요.", outcome: "알릴 내용이 없으면 브리핑이 없을 수 있어요. 개인 DM으로 보내는 브리핑은 아니에요." },
    ],
    reflection: ["당일·다음 날 작업 기한과 필요한 일정 알림", "시작·종료 임박·기한 협의 대기도 조건에 따라 안내"],
    caution: "일정 종류에 따라 알리는 날이 달라요. 미팅·기타는 당일, 결과물 마감은 전날, 여러 날 일정은 끝나기 전날을 기준으로 해요.",
  },
  "discord-troubleshooting": {
    title: "명령이 안 될 때 확인할 순서",
    prerequisite: "정확한 협업 채널 · 가입한 Discord 계정 · 현재 협업 상태 확인",
    scenes: [
      { title: "채널 확인", surface: "private", view: "notice", heading: "협업 채널(협업-N)에서만 쓸 수 있어요", text: "봇 DM이나 일반 채널이 아니라 사이트의 ‘디스코드 채널’ 링크로 들어왔는지 확인하세요.", outcome: "사이트에 로그인한 Discord 계정이 이 협업의 참여자인지도 확인해요." },
      { title: "상태 확인", surface: "private", view: "notice", heading: "끝난 협업이라 바꿀 수 없어요", text: "시작 전에는 작업·일정 등록이 막히고, 종료 후에는 기록 조회만 가능해요. 상대가 이미 처리한 작업·일정은 다시 열어 현재 상태를 확인하세요.", outcome: "개인 패널이 10분 뒤 만료됐다면 원래 메시지의 관리 버튼이나 명령어를 다시 실행하세요." },
      { title: "입력 확인", surface: "private", view: "notice", heading: "시각으로 읽지 못했어요", text: "시각은 14:00 또는 오후 2시처럼 적어요. 숫자 2만 적으면 저장하지 않아요. 날짜는 내일·3일 뒤·2026-11-20처럼 명확하게 적어요.", outcome: "명령어가 없거나 계속 응답하지 않으면 사이트에서 처리하고 비공개 문의로 알려 주세요." },
    ],
    reflection: ["버튼 오류만으로 저장 실패를 단정하지 않음", "사이트 최신 기록 확인 → 필요하면 다시 시도·문의"],
    caution: "비밀번호·인증코드·봇 토큰 대신 발생 시각·화면명·오류 문구를 알려 주세요. 연동 점검은 운영팀이 진행해요.",
  },
};

export const FAQ_DISCORD_GUIDE_IDS: Record<string, string> = {
  "discord-login": "discord-connect",
  "discord-connect": "discord-connect",
  "calendar-discord": "calendar-discord",
  "discord-channel": "discord-channel",
  "discord-task-create": "discord-task-create",
  "workspace-task-vs-request": "discord-task-create",
  "discord-task-permissions": "discord-task-permissions",
  "task-due-negotiation": "task-due-negotiation",
  "task-complete-return": "task-complete-return",
  "discord-task-list": "discord-task-list",
  "discord-schedule": "discord-schedule",
  "discord-schedule-manage": "discord-schedule-manage",
  "repeat-schedule": "repeat-schedule",
  "discord-waiting": "discord-waiting",
  "discord-ending": "discord-ending",
  "workspace-completion": "discord-ending",
  "discord-briefing": "discord-briefing",
  "discord-troubleshooting": "discord-troubleshooting",
};
