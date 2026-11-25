// 분류표(taxonomy v4.0)에서 가져온 보기 목록. 화면 먼저 만드는 단계용 임시 복사본입니다.
// DB(able_work, field_category, research_field)와 API가 생기면 이 파일 대신 API로 불러옵니다.

export type Option = { id: string; name: string };

/** 할 수 있는 일 (UG 11개). showDefault가 false면 [+ 더 보기]를 눌러야 보입니다. */
export const ABLE_WORKS: (Option & { showDefault: boolean })[] = [
  { id: "UG01", name: "데이터 준비·품질", showDefault: true },
  { id: "UG02", name: "통계·연구설계", showDefault: true },
  { id: "UG03", name: "예측·일반 머신러닝", showDefault: true },
  { id: "UG04", name: "이미지·영상 분석", showDefault: true },
  { id: "UG05", name: "텍스트·문서 분석", showDefault: true },
  { id: "UG06", name: "음성·멀티모달", showDefault: true },
  { id: "UG07", name: "시계열·공간·그래프", showDefault: true },
  { id: "UG08", name: "생성형 AI·지식 활용", showDefault: false },
  { id: "UG09", name: "최적화·제어·로봇", showDefault: false },
  { id: "UG10", name: "과학 계산·특화 분석", showDefault: false },
  { id: "UG11", name: "모델 개발·검증·운영", showDefault: false },
];

/** 연구 분야: 대분류 10개 → 세부 분야 83개 (도메인 키워드 보기) */
export const FIELD_CATEGORIES: (Option & { fields: Option[] })[] = [
  {
    id: "F01",
    name: "생명과학",
    fields: [{ id: "FIELD001", name: "유전학·유전체학" }, { id: "FIELD002", name: "분자·세포생물학" }, { id: "FIELD003", name: "생물정보학·계산생물학" }, { id: "FIELD004", name: "미생물학·감염생물학" }, { id: "FIELD005", name: "생태·진화생물학" }, { id: "FIELD006", name: "신경과학" }, { id: "FIELD007", name: "생화학·구조생물학" }, { id: "FIELD008", name: "생물공학·합성생물학" }],
  },
  {
    id: "F02",
    name: "의학·보건·약학",
    fields: [{ id: "FIELD009", name: "기초의학·병리학" }, { id: "FIELD010", name: "임상의학·임상연구" }, { id: "FIELD011", name: "의료영상·영상의학" }, { id: "FIELD012", name: "공중보건·역학" }, { id: "FIELD013", name: "약학·신약개발" }, { id: "FIELD014", name: "간호·보건서비스" }, { id: "FIELD015", name: "치의학·구강보건" }, { id: "FIELD016", name: "재활·운동의학" }, { id: "FIELD017", name: "정신건강·정신의학" }, { id: "FIELD018", name: "의료정보학·디지털헬스" }],
  },
  {
    id: "F03",
    name: "컴퓨터·수학·물리",
    fields: [{ id: "FIELD019", name: "컴퓨터과학·소프트웨어" }, { id: "FIELD020", name: "인공지능·정보과학" }, { id: "FIELD021", name: "수학·응용수학" }, { id: "FIELD022", name: "통계학·확률과정" }, { id: "FIELD023", name: "물리학·응용물리" }, { id: "FIELD024", name: "천문·우주과학" }, { id: "FIELD025", name: "양자과학·양자정보" }, { id: "FIELD026", name: "계산과학·수치해석" }],
  },
  {
    id: "F04",
    name: "화학·재료·에너지",
    fields: [{ id: "FIELD027", name: "일반·분석화학" }, { id: "FIELD028", name: "계산화학·이론화학" }, { id: "FIELD029", name: "화학공학·공정" }, { id: "FIELD030", name: "재료·신소재공학" }, { id: "FIELD031", name: "나노과학·나노소재" }, { id: "FIELD032", name: "에너지·배터리" }, { id: "FIELD033", name: "반도체·전자재료" }],
  },
  {
    id: "F05",
    name: "공학·제조·모빌리티",
    fields: [{ id: "FIELD034", name: "기계·기계설계" }, { id: "FIELD035", name: "전기·전자공학" }, { id: "FIELD036", name: "로봇·제어공학" }, { id: "FIELD037", name: "산업·시스템공학" }, { id: "FIELD038", name: "스마트제조·품질공학" }, { id: "FIELD039", name: "항공우주·우주공학" }, { id: "FIELD040", name: "토목·건설공학" }, { id: "FIELD041", name: "교통·모빌리티" }, { id: "FIELD042", name: "의공학·의료기기" }],
  },
  {
    id: "F06",
    name: "환경·지구·농식품",
    fields: [{ id: "FIELD043", name: "기후·대기과학" }, { id: "FIELD044", name: "지구·지질과학" }, { id: "FIELD045", name: "환경과학·환경공학" }, { id: "FIELD046", name: "해양·수산과학" }, { id: "FIELD047", name: "원격탐사·지리정보" }, { id: "FIELD048", name: "농업·작물과학" }, { id: "FIELD049", name: "식품과학·식품공학" }, { id: "FIELD050", name: "수의·축산과학" }, { id: "FIELD051", name: "산림·생태자원" }],
  },
  {
    id: "F07",
    name: "사회·정책·공공",
    fields: [{ id: "FIELD052", name: "경제학·계량경제" }, { id: "FIELD053", name: "정치·국제관계" }, { id: "FIELD054", name: "사회학·인구학" }, { id: "FIELD055", name: "행정·정책평가" }, { id: "FIELD056", name: "사회복지·불평등" }, { id: "FIELD057", name: "도시·지역계획" }, { id: "FIELD058", name: "국제개발·공공협력" }, { id: "FIELD059", name: "미디어·커뮤니케이션" }],
  },
  {
    id: "F08",
    name: "경영·금융·법",
    fields: [{ id: "FIELD060", name: "경영전략·조직" }, { id: "FIELD061", name: "금융·투자" }, { id: "FIELD062", name: "회계·감사·내부통제" }, { id: "FIELD063", name: "마케팅·소비자행동" }, { id: "FIELD064", name: "운영·공급망 관리" }, { id: "FIELD065", name: "법학·법률정보" }, { id: "FIELD066", name: "규제·준법·리스크" }, { id: "FIELD067", name: "보험·계리" }],
  },
  {
    id: "F09",
    name: "인문·문화·예술",
    fields: [{ id: "FIELD068", name: "언어학·문헌학" }, { id: "FIELD069", name: "역사학·사료연구" }, { id: "FIELD070", name: "철학·윤리학" }, { id: "FIELD071", name: "문학·텍스트 연구" }, { id: "FIELD072", name: "종교·종교문화" }, { id: "FIELD073", name: "고고·문화유산" }, { id: "FIELD074", name: "미술·디자인·공연예술" }, { id: "FIELD075", name: "디지털 인문학" }],
  },
  {
    id: "F10",
    name: "교육·심리·인지·HCI",
    fields: [{ id: "FIELD076", name: "교육학·교육평가" }, { id: "FIELD077", name: "교육공학·에듀테크" }, { id: "FIELD078", name: "심리학·행동과학" }, { id: "FIELD079", name: "인지과학·뇌인지" }, { id: "FIELD080", name: "인간컴퓨터상호작용" }, { id: "FIELD081", name: "UX·사용자 연구" }, { id: "FIELD082", name: "학습과학·학습분석" }, { id: "FIELD083", name: "디자인·서비스 연구" }],
  },
];

const ALL_FIELDS = FIELD_CATEGORIES.flatMap((category) => category.fields);

/** ID → 화면 이름 (모르는 ID면 ID 그대로) */
export function ableWorkName(id: string): string {
  return ABLE_WORKS.find((work) => work.id === id)?.name ?? id;
}
export function fieldName(id: string): string {
  return ALL_FIELDS.find((field) => field.id === id)?.name ?? id;
}