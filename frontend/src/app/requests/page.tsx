import { RequestsPage } from "@/components/requests-page";

// 요청관리: 연구회원은 보낸 요청, AI 전문가는 받은 요청을 같은 주소에서 보여 줘요. (헤더·내 공간 메뉴의 /requests)
export default function Page() {
  return <RequestsPage />;
}