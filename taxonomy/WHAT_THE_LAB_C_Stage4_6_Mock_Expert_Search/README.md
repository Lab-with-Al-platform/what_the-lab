# C 담당 4~6단계: 전문가 Mock Data + 검색 연동 실습

> 범위: **연구자가 AI 전문가를 검색 → 프로필 확인 → 직접 협업 요청**하는 흐름 중, 검색·프로필 **시연 단계**만 다룹니다. 협업 요청 전송은 구현하지 않았습니다.
>
> **주의:** 가상 전문가 20명이며, 기존 실서비스 페이지 `/experts`는 변경하지 않습니다. CAP/FIELD 분류 데이터는 검토 대기 상태입니다.

## 1. 무엇을 만들었나?

- **가상 전문가 20명**: 실제 인물처럼 보이지 않도록 `가상 전문가 01~20`으로 표시했습니다.
- **수행 기술(CAP) 연결**: 서로 다른 기술 40종을 20명에게 나눠 부여했습니다.
- **연구 분야(FIELD) 연결**: 서로 다른 분야 36종을 사용했습니다.
- **검색 함수**: 일반 검색어, 기술 필터, 경험 연구 분야 필터, 협의 가능 여부를 함께 적용합니다.
- **독립 테스트 화면**: `/expert-search-demo`에서 검색 → 목록 → 상세 확인을 시험합니다.
- **자동 검사**: 전문가 ID 중복과 잘못된 CAP/FIELD 참조가 없는지 확인합니다.

## 2. 파일별 역할

| 파일 | 쉽게 말하면 | 하는 일 |
|---|---|---|
| `taxonomy/mock-experts-v1/data/experts.mock.json` | 가상 전문가 명부 | 20명의 소개, 기술 ID, 연구 분야 ID, 협의 가능 상태 저장 |
| `taxonomy/mock-experts-v1/data/capabilities.snapshot.json` | 기술 사전 복사본 | CAP ID를 화면에 보일 기술명으로 바꿈 |
| `taxonomy/mock-experts-v1/data/research-fields.snapshot.json` | 연구 분야 사전 복사본 | FIELD ID를 연구 분야명으로 바꿈 |
| `taxonomy/mock-experts-v1/data/search-aliases.snapshot.json` | 같은 말 사전 복사본 | 예: 객체 검출과 Object Detection을 같은 CAP에 연결 |
| `taxonomy/mock-experts-v1/mock-experts-review.csv` | 검토용 표 | 엑셀로 가상 전문가 데이터를 눈으로 확인 |
| `taxonomy/mock-experts-v1/tests/test_mock_data.py` | 데이터 점검기 | 전문가 20명과 ID 연결 오류 검사 |
| `frontend/src/lib/mock-expert-search.ts` | 검색 담당 코드 | 입력 조건에 맞는 가상 전문가를 골라냄 |
| `frontend/src/components/mock-expert-search-demo.tsx` | 검색 테스트 화면 | 검색창, 필터, 카드, 상세 패널을 표시 |
| `frontend/src/app/expert-search-demo/page.tsx` | 테스트 화면 주소 | `/expert-search-demo` URL로 들어오면 화면을 보여줌 |

**원본과의 관계:** `*.snapshot.json`은 v4 분류표 패키지의 데이터를 이 작업에서 테스트할 수 있도록 복사한 것입니다. 운영 단계에서는 한 곳에서 분류표를 관리하고 중복 복사본을 없애야 합니다.

## 3. 연구자가 기술을 검색하면 일어나는 일

1. 사용자가 검색창에 `객체 탐지`를 입력합니다.
2. `mock-expert-search.ts`가 입력어를 정리합니다(대소문자·앞뒤 공백 등).
3. `search-aliases.snapshot.json`에서 같은 의미로 매칭할 기술 ID를 찾습니다.
4. `experts.mock.json`을 훑어 해당 기술 ID를 가진 전문가를 찾습니다.
5. 화면 카드에 이름·소개·기술을 보여줍니다.
6. 카드를 열어 상세를 확인할 수 있습니다. **실제 요청 전송은 비활성**입니다.

## 4. 내 프로젝트에 넣는 순서

**기존 `feature/expert-search` 브랜치에서, 아직 커밋하지 않은 변경 파일이 없는지 확인한 다음 적용하세요.**

1. 이 패키지 안의 `taxonomy/` 폴더 하위를 팀 저장소의 같은 경로에 복사합니다.
2. `frontend/src/lib/mock-expert-search.ts`를 팀 저장소의 같은 경로에 복사합니다.
3. `frontend/src/components/mock-expert-search-demo.tsx`를 같은 경로에 복사합니다.
4. `frontend/src/app/expert-search-demo/page.tsx`를 같은 경로에 복사합니다.
5. 프로젝트 루트에서 `py taxonomy/mock-experts-v1/tests/test_mock_data.py`를 실행합니다.
6. 프론트엔드에 의존성이 이미 설치되어 있다면 `cd frontend` 후 `npm run dev`를 실행합니다.
7. `http://localhost:3000/expert-search-demo`에서 기술·분야를 고르고 결과가 바뀌는지 확인합니다.
8. 프로젝트가 정한 코드 검사 스크립트(`npm run lint`, `npx tsc --noEmit` 등)가 있는지 `frontend/package.json`을 확인하고 실행합니다.

> 프로젝트의 설치 상태에 따라 `npm install` 또는 `npm ci`가 먼저 필요할 수 있습니다. 이 패키지에서는 실제 Next.js 실행과 타입검사까지 수행하지 않았습니다.

## 5. 코드 읽는 순서: 세 부분만 먼저 이해하기

### A. `experts.mock.json` — 한 사람의 정보

```json
{
  "id": "MOCK_EXP_001",
  "displayName": "가상 전문가 01",
  "skillIds": ["CAP022", "CAP023", "CAP024"],
  "experienceFieldIds": ["FIELD002", "FIELD011"],
  "dataStatus": "mock",
  "requestEnabled": false
}
```

- `id`: 전문가 한 명을 구별하는 번호
- `skillIds`: 할 수 있는 AI 작업의 코드 목록
- `experienceFieldIds`: 경험한 연구 분야의 코드 목록
- `dataStatus`: 실제 인물이 아니라 가상 데이터임을 표시
- `requestEnabled`: 실수로 협업 요청을 보내지 않도록 `false`

### B. `mock-expert-search.ts` — 조건에 맞는 사람 선택

```ts
if (options.skillId && !expert.skillIds.includes(options.skillId)) return false;
```

- `options.skillId`: 연구자가 선택한 CAP 코드
- `expert.skillIds`: 전문가가 가진 CAP 코드들
- `includes`: 해당 코드가 목록에 있는지 확인
- `return false`: 코드가 없다면 검색 결과에서 제외

```ts
if (options.fieldId && !expert.experienceFieldIds.includes(options.fieldId)) return false;
```

연구 분야 필터도 같은 방식입니다. **희망 협업 분야가 아니라 과거 경험 분야를 사용합니다.**

### C. `mock-expert-search-demo.tsx` — 검색 화면 갱신

```tsx
const [skillId, setSkillId] = useState("");
```

`skillId`는 현재 선택값, `setSkillId`는 선택값을 바꾸는 함수입니다. 필터에서 다른 기술을 고르면 화면의 검색 결과가 다시 계산됩니다.

```tsx
const results = useMemo(
  () => findMockExperts({ query, skillId: skillId || undefined, fieldId: fieldId || undefined, availableOnly }),
  [query, skillId, fieldId, availableOnly]
);
```

검색어·필터가 바뀔 때마다 조건에 맞는 전문가 목록을 새로 구합니다. 결과는 전문가 카드에 표시됩니다.

### D. `page.tsx` — URL과 화면 연결

```tsx
export default function DemoPage() { return <MockExpertSearchDemo />; }
```

Next.js가 `/expert-search-demo` URL을 열 때 테스트 화면을 보여주도록 지정합니다.

## 6. 검사 결과와 제한

- `test_mock_data.py`: **PASS** — 20명, ID 중복 없음, CAP/FIELD 코드 참조 유효, 가상 표시와 요청 비활성 확인
- **미수행:** Next.js 빌드, 실제 브라우저 사용성, 인증·API·DB 연동, 실제 협업 요청 전달, 운영 보안 테스트
- `pending_review`인 분류 항목은 운영 승인과 별개입니다. 이번 검사는 모의 데이터 형식의 검사입니다.

## 7. 다음에 작업할 내용

1. 팀의 확정된 **전문가 프로필 필수 항목**과 Mock Data 필드를 비교하여 차이가 없는지 확인
2. 기존 `/experts` 목록·상세 페이지와 새 데이터 연결 방식 협의
3. 기술 ID·연구 분야 ID를 전달하는 API 명세 합의
4. 전문가 등록 정보로 데이터 교체하고 서버에서 공개 여부·권한 검증
5. `전문가 검색 → 상세 → 협업 요청 → 수신`을 통합 테스트

**Git 기록 권장:** `test: add mock expert data and isolated search demo` 같은 메시지로 실제 수행 내용만 기록합니다. 리뷰 전에는 `develop`에 직접 병합하지 않습니다.
