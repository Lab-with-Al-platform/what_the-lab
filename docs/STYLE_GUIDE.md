# WHAT THE LAB 스타일 가이드

이 문서는 초보 팀원도 같은 기준으로 읽고 수정할 수 있는 코드를 만들기 위한 최소 규칙입니다.

## 1. 공통 원칙

- 어려운 한 줄 코드보다 읽기 쉬운 여러 줄 코드를 우선합니다.
- 이름만 읽어도 목적이 보이게 작성합니다.
- 함수 하나는 한 가지 역할만 수행합니다.
- 매직 넘버와 반복 문자열은 의미 있는 상수로 분리합니다.
- 주석은 코드가 **무엇을 하는지 반복**하기보다 **왜 필요한지** 설명합니다.
- 사용하지 않는 코드와 임시 로그는 PR 전에 정리합니다.

### 이름 예시

```text
나쁜 예: data, item, temp, check()
좋은 예: expert_profile, application_status, can_view_contact()
```

## 2. Python / FastAPI

- PEP 8을 따릅니다.
- 함수 입력과 반환값에 타입 힌트를 사용합니다.
- 요청/응답 스키마와 데이터베이스 모델을 구분합니다.
- 라우터는 HTTP 입출력, 서비스는 비즈니스 규칙을 담당합니다.
- 권한 검사는 프론트엔드 표시 여부와 별개로 백엔드에서 수행합니다.

```python
def can_view_private_contact(
    requester_id: int,
    project_member_ids: set[int],
) -> bool:
    """요청자가 확정 프로젝트 멤버인지 확인합니다."""
    return requester_id in project_member_ids
```

한 줄짜리 함수라도 타입과 이름이 있으면 권한 규칙을 테스트하고 재사용하기 쉬워집니다.

## 3. TypeScript / React

- `any`보다 구체적인 타입을 사용합니다.
- 컴포넌트 이름은 PascalCase, 함수·변수는 camelCase를 사용합니다.
- 한 컴포넌트가 데이터 요청, 상태 변환, 복잡한 화면을 모두 맡지 않게 나눕니다.
- 서버에서 받은 상태값을 임의 문자열로 바꾸지 말고 공통 타입을 사용합니다.
- 로딩·오류·빈 결과·성공 상태를 각각 설계합니다.

```typescript
type Availability = "available" | "negotiable" | "unavailable";

interface ExpertSummary {
  id: string;
  displayName: string;
  availability: Availability;
}
```

## 4. Tailwind CSS와 UI

- 반복되는 스타일 조합은 공통 컴포넌트로 추출합니다.
- 임의 색상을 계속 추가하지 말고 합의된 토큰을 사용합니다.
- 모바일 화면을 먼저 확인하고 넓은 화면으로 확장합니다.
- 키보드 탐색, 포커스 표시, 폼 라벨, 충분한 명도 대비를 지킵니다.
- 상태는 색상만으로 구분하지 않고 텍스트를 함께 표시합니다.

## 5. API와 상태 용어

- URL은 명사 중심의 복수형을 사용합니다. 예: `/api/v1/projects`
- 연구자의 행동은 `collaboration-request`, 전문가의 행동은 `application`으로 구분합니다.
- API 오류는 사용자가 다음 행동을 이해할 수 있는 메시지와 안정적인 오류 코드를 제공합니다.
- 날짜·시간은 서버에서 표준 시간대로 저장하고 화면에서 사용자 시간대로 표현합니다.

## 6. 테스트 이름

테스트 이름은 상황과 기대 결과가 드러나게 작성합니다.

```text
test_selected_expert_becomes_project_member
test_non_member_cannot_view_private_contact
```

정상 흐름뿐 아니라 권한 오류, 빈 목록, 중복 요청, 잘못된 상태 전환도 확인합니다.

## 7. 커밋과 PR

커밋 메시지는 다음 접두사를 권장합니다.

```text
feat: 기능 추가
fix: 버그 수정
docs: 문서 변경
test: 테스트 추가·수정
refactor: 동작을 유지한 구조 개선
chore: 설정·도구 변경
```

예: `feat: 전문가 목록 카드 기본 정보 표시`
