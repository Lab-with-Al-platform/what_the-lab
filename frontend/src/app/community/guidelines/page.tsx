import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import styles from "@/components/community/community.module.css";

export const metadata = { title: "커뮤니티 이용 가이드" };
export default function GuidelinesPage() {
  return (
    <PageContainer className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/community">자유게시판</Link>
        <span>›</span>
        <span>이용 가이드</span>
      </div>
      <article className={`${styles.panel} ${styles.guidelines}`}>
        <p className={styles.eyebrow}>OUR COMMUNITY GUIDELINES</p>
        <h1>작은 질문을 반갑게 맞이해요</h1>
        <p>
          랩브릿지 게시판은 연구 질문과 개발 경험을 나누고 서비스를 함께
          개선하는 공간입니다. 기술 수준보다 질문의 맥락과 서로를 존중하는
          태도를 중요하게 생각합니다.
        </p>
        <h2>1. 질문을 이해할 수 있게 적어 주세요</h2>
        <ul>
          <li>무엇을 해결하고 싶은지, 어디까지 시도했는지 알려 주세요.</li>
          <li>
            확인된 사실과 자신의 추측을 구분하고, 참고 자료의 출처를 적어
            주세요.
          </li>
          <li>
            AI로 작성한 답변도 내용을 확인하고 자신의 설명으로 보완해 주세요.
          </li>
        </ul>
        <h2>2. 공개 범위를 먼저 선택해 주세요</h2>
        <p>
          공개 글은 누구나 읽습니다. 비공개 문의는 작성자와 관리자만 봅니다. 글
          등록 후 공개 범위는 바꿀 수 없습니다. 비공개 글을 작성자의 동의 없이
          다시 공개하지 마세요.
        </p>
        <h2>3. 지켜야 할 자료는 올리지 않아요</h2>
        <p>
          연구 원자료, 식별 가능한 개인정보, 개인 연락처, 기관 비밀정보,
          비밀번호·토큰·API 키·인증번호를 적지 마세요. 비공개 문의에도 동일하게
          적용됩니다. 코드나 오류 문구를 붙일 때 비밀값을 먼저 지워 주세요.
        </p>
        <h2>4. 경험을 나누고, 도움을 표시해 주세요</h2>
        <p>
          다른 회원의 상황을 단정하거나 비하하지 마세요. 답변이 도움이 되었다면
          채택과 공감으로 표시해 주세요. 게시판의 공감·채택은 연구 성과나 전문가
          역량을 인증하는 점수가 아닙니다. 협업은 별도의 합의와 확인이
          필요합니다.
        </p>
        <h2>5. 광고·도배·괴롭힘은 신고해 주세요</h2>
        <p>
          문제 글의 신고 기능을 이용하면 관리자가 확인합니다. 신고 횟수만으로
          자동 숨김하지 않으며, 관리자는 사유를 남기고 숨김·복구·댓글 삭제 등
          필요한 조치를 할 수 있습니다. 게시판은 긴급 대응을 보장하는 채널이
          아닙니다.
        </p>
        <h2>6. 기록과 운영</h2>
        <p>
          글 작성자는 원문을 수정·삭제할 수 있습니다. 화면에서 삭제된 글은 다른
          회원이 조회할 수 없습니다. 운영 신고·조치 이력은 관리자 검토를 위해
          별도 관리합니다. 서비스 공개 전 운영팀이 개인정보 처리방침, 자료 보존
          기간과 계정 삭제 절차를 확정해 안내해야 합니다.
        </p>
        <div className={styles.formActions}>
          <Link className={styles.secondary} href="/faq">
            FAQ 보기
          </Link>
          <Link className={styles.primary} href="/community/new">
            첫 대화 시작하기
          </Link>
        </div>
      </article>
    </PageContainer>
  );
}
