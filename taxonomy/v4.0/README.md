# WHAT THE LAB · 전문가 검색 분류체계 v4.0

> **문서 상태: Release Candidate (배포 검토 후보)**  
> **운영 상태: 미승인 · `pending_review`**  
> **적용 대상: 경로 B — 연구자의 전문가 직접 검색 및 협업 요청 MVP**

이 문서는 WHAT THE LAB의 기술·연구 분야 분류표가 **무엇을 정의하는지**, **어떤 파일로 구성되어 있는지**, **실제 서비스에 어떻게 연결하는지**를 설명합니다. 전문 개발자가 아니어도 전체 흐름을 따라갈 수 있도록 예시부터 정리했습니다.

> [!IMPORTANT]
> 이 저장소의 v4.0은 **서비스 연동을 위한 설계·검증 패키지**입니다. 현재 항목들은 승인 대기 상태이며, 이 패키지만으로 실제 서비스 배포 가능성이 검증된 것은 아닙니다. DB/API 연결, 보안, 실제 사용자 검색, 분야별 전문가 검수를 별도로 완료해야 합니다.

---

## 1. 1분 만에 이해하기

예를 들어 연구자가 **“현미경 이미지에서 세포를 찾아주는 AI 전문가가 필요해요”**라고 생각한다고 가정합니다.

```text
연구자
  │  필요한 작업 검색: 객체 탐지
  ▼
[CAP] 무엇을 할 수 있나? ─── 객체 탐지 등 구체적인 수행 기술
  │
[FIELD] 어떤 분야인가? ─── 생명과학·의학 등 연구 맥락 (선택 조건)
  │
[UG] 화면에서 어떻게 묶어 보여주나? ─── 이미지·영상 분석 그룹
  ▼
전문가 프로필에 연결된 CAP / FIELD ID 비교
  ▼
조건에 맞는 전문가 카드 → 상세 프로필
  ▼
특정 전문가에게 협업 요청 전송 → 전문가가 요청 수신
```

**핵심:** 이 분류표는 전문가를 자동 인증하거나 추천하는 AI 모델이 아닙니다. **검색어와 전문가의 기술 정보를 같은 기준으로 연결하는 공통 사전**입니다.

## 2. 세 가지 분류의 차이

| 구분 | 쉬운 질문 | 예시 | 주요 사용처 |
|---|---|---|---|
| **CAP (Capability)** | 전문가가 어떤 작업을 할 수 있나? | 객체 탐지, 데이터 정제, 시계열 예측 | 전문가 보유 기술, 검색 조건 |
| **FIELD (Research Field)** | 어떤 학문·연구 분야와 관련 있나? | 유전학, 경제학, 재료공학 | 연구 경험·관심 분야, 분야 필터 |
| **UG (UI Group)** | 화면에서 기술을 어떻게 묶어 보여주나? | 이미지·영상 분석 | 가입 시 선택 항목, 검색 필터 그룹 |
| **TOOL (보조 정보)** | 어떤 도구를 사용하나? | Python, PyTorch | 프로필의 참고 정보 |

규칙: **UG 선택이 해당 그룹의 모든 CAP 보유를 의미하지 않습니다.** 또한 Python이나 PyTorch 사용 경험만으로 특정 CAP 역량을 자동 부여해서도 안 됩니다. 연구 분야(FIELD)도 기술 능력(CAP)의 증명은 아닙니다.

### 현재 분류 규모

| 대상 | 수량 | 참고 |
|---|---:|---|
| CAP | 80개 | 서비스 자체 수행 기술 분류 |
| FIELD | 83개 | 서비스 자체 연구 분야 분류 |
| UG | 11개 | 사용자가 보는 기술 그룹 |
| TOOL | 32개 | 역량 자동 인정과 분리 |
| 표준명·정확 검색어 레코드 | 632개 | PREFERRED / EXACT 검색어 포함 |
| 관련 검색어 | 89개 | RELATED, 추천·탐색 보조 용도 |

수치는 **v4.0 패키지에 수록된 레코드 수**이며, 실제 사용자 검증으로 최적 규모가 확정된 숫자는 아닙니다.

---

## 3. 이번 MVP에서 사용하는 범위

**이번 우선 개발 범위**

1. 연구자가 필요한 AI 작업을 검색하거나 필터에서 선택합니다.
2. 검색 결과로 전문가 목록을 확인합니다.
3. 특정 전문가의 상세 프로필을 확인합니다.
4. 해당 전문가에게 직접 협업 요청을 전송합니다.
5. 전문가가 요청을 수신하고 내용을 확인합니다.

**이번 우선 범위에서 제외:** 공개 프로젝트 모집, 전문가의 공개 프로젝트 참여 신청, 협업 확정 이후 마일스톤·종료·상호 평가, ML 기반 자동 추천.

> **범위 문서 동기화 필요:** 프로젝트의 기존 `README.md` 및 `docs/product/MVP_SCOPE.md`에는 더 넓은 기능 범위가 남아 있을 수 있습니다. 팀에서 합의한 직접 요청 흐름과 해당 문서를 일치시키는 작업은 별도로 필요합니다.

---

## 4. 폴더와 파일 안내

기본 업로드 위치는 저장소의 **`taxonomy/v4/`**를 권장합니다. 아래 파일들은 v4 배포 후보 ZIP에 실제 포함된 파일입니다.

| 파일 | 간단한 역할 | 사용하는 시점 |
|---|---|---|
| `README.md` | 현재 가이드 | 처음 구조를 파악할 때 |
| `WHAT_THE_LAB_Taxonomy_Production_Design_v4.xlsx` | 분류표·검증·출시 조건 종합 관리 | 기획·검토·승인 |
| `WHAT_THE_LAB_Taxonomy_Production_Guide.html` | 그림·검색 기반 이해 가이드 | 팀 설명·온보딩 |
| `capabilities.json` | CAP 80개 정의와 ID | 전문가 기술, 기술 검색 |
| `research-fields.json` | FIELD 83개 정의와 ID | 연구 분야 필터·프로필 |
| `categories.json` | CAP/FIELD의 상위 분류 | 대분류 구성 |
| `ui-filter-groups.json` | UG 11개 그룹 이름과 설정 | 화면의 첫 단계 선택지 |
| `ui-group-members.json` | 어떤 UG에 어떤 CAP가 속하는지 | 그룹을 기술 ID로 해석 |
| `search-aliases.json` | 표준명·정확 동의어 | 동일 개념 검색어 연결 |
| `related-search-terms.json` | 연관 검색어 | 관련 기술 탐색 제안 |
| `search-rules.json` | 검색 처리 원칙 | 검색 로직 설계 |
| `tools.json` | 언어·라이브러리·도구 목록 | 전문가 프로필 보조 정보 |
| `taxonomy.schema.json` | JSON 구조 정의 | 형식 검증 기준 |
| `golden-test-cases.json` | 검색·운영 검증 사례 33개 | 검색 테스트 설계 |
| `item-review-ledger.json` | 163개 항목별 검토 상태 | 근거·미완료 항목 추적 |
| `authority-references.json` | 공식 출처와 적용 한계 | 근거 확인 |
| `migration-v2-review.json` | 과거 v2 항목과의 대응 검토 | 기존 데이터 이전 검토 |
| `validate_release.py` | 기본 참조·중복 검사 | PR 제출 전 검사 |

> [!NOTE]
> `migration-v2-review.json`은 **자동 변환표가 아닙니다.** `auto_migrate: NO` 항목은 전문가·기술 의미를 확인한 뒤 사람이 판단해야 합니다.

### 권장 프로젝트 구조

```text
what_the-lab/
├── frontend/                   # Next.js 화면
├── backend/                    # FastAPI 서버
├── database/                   # 팀 DB 코드
├── taxonomy/
│   └── v4/
│       ├── README.md
│       ├── capabilities.json
│       ├── research-fields.json
│       ├── ui-filter-groups.json
│       ├── ui-group-members.json
│       ├── search-aliases.json
│       ├── validate_release.py
│       └── ... 기타 데이터·설명 파일
└── docs/                       # 팀 공통 문서
```

이 폴더는 **분류체계 원본과 검증 자료를 관리하는 위치**입니다. 여기에 파일을 넣는 것만으로 현재 `/experts` 화면이나 DB에 자동 적용되지는 않습니다. 실제 실행 경로와 공통 데이터 배포 방식은 프론트엔드·백엔드 담당자가 함께 확정해야 합니다.

---

## 5. 개발자가 데이터를 사용하는 방식

### 5-1. 전문가 프로필에는 코드(ID)를 저장

```json
{
  "expertId": "MOCK_EXPERT_001",
  "skillIds": ["CAP023"],
  "experienceFieldIds": ["FIELD001"],
  "collaborationFieldIds": []
}
```

> 위 JSON은 **구조를 설명하는 가상 예시**입니다. FIELD001은 v4에서 유전학·유전체학을 의미합니다. 실제 전문가의 검증된 역량을 뜻하지 않습니다.

전문가가 보유한 기술은 `skillIds`, 과거 경험 분야는 `experienceFieldIds`, 협업 희망 분야는 `collaborationFieldIds`처럼 목적에 따라 구분하는 것을 권장합니다. 화면에서는 해당 ID의 한국어 이름을 분류표에서 찾아 보여줍니다.

### 5-2. 연구자 검색이 작동하는 순서

```text
① 사용자가 “객체 검출” 입력
           ↓
② search-aliases.json에서 같은 개념의 표준 ID 확인
           ↓
③ 해당 CAP를 보유한 전문가 검색
           ↓
④ 연구 분야 조건이 있으면 함께 비교
           ↓
⑤ 공개·권한 조건을 통과한 전문가만 반환
           ↓
⑥ 전문가 카드 → 상세 페이지 → 직접 협업 요청
```

- **PREFERRED**: 대표 명칭
- **EXACT**: 의미가 같은 다른 표현
- **RELATED**: 의미가 같지는 않지만 관련 있는 표현 → *관련 검색어 제안용*, 자동 역량 매칭 금지

`pending_review` 검색어는 자동 매칭 대상으로 공개하기 전 의미 검토·승인을 받아야 합니다.

### 5-3. 팀 코드와 연결할 위치 (후속 작업)

| 연결 위치 | 예상 작업 | 현재 주의점 |
|---|---|---|
| `frontend/src/components/expert-browser.tsx` | CAP/FIELD/UG 기반 필터 구현 | 기존 화면은 시안 기반 문자열 검색 |
| `frontend/src/lib/experts.ts` | 전문가별 CAP/FIELD ID 연결 | 기존 가상 정보의 진위·역량 자동 승격 금지 |
| 전문가 가입 화면 | '할 수 있는 일' 선택지를 UG로 표시 | UG 선택으로 모든 CAP 자동 부여 금지 |
| `backend/`의 전문가 조회 API | 서버 측 필터·공개 권한·페이지 처리 | API 계약 합의 후 구현 |
| 팀 DB 스키마 | 전문가-CAP, 전문가-FIELD 연결 테이블 | 기존 DB 모델과 관계 검토 필요 |

파일 경로는 이전 팀 프로젝트의 구조를 바탕으로 한 **연동 후보**이며, 현재 저장소 최신 상태와 API/DB 실제 구현 여부를 확인한 뒤 작업해야 합니다.

---

## 6. 로컬에서 검증하는 방법

Windows + VS Code PowerShell 기준입니다.

1. 프로젝트 폴더를 VS Code에서 엽니다.
2. 터미널을 실행합니다 (`Terminal → New Terminal`).
3. 아래 명령을 차례로 실행합니다.

```powershell
# 프로젝트 최상위 폴더에서
cd taxonomy/v4

# Python Launcher를 사용하는 Windows 예시
py validate_release.py
```

Windows에서 `python` 명령이 정상 동작한다면 `python validate_release.py`를 사용해도 됩니다.

**정상 실행 시 예상 출력 형식:**

```text
PASS: structural refs | CAP=80 FIELD=83 aliases=632 UI groups=11
NOT VERIFIED: semantics, research standard crosswalk, real search quality, authorization, DB/API integration
```

검증 스크립트는 CAP/FIELD 수량, ID 중복, 상위 분류·검색어·UG 참조, 자동 일치 검색어의 다중 ID 충돌, `pending_review` 상태 유지 등을 검사합니다.

> [!WARNING]
> **`PASS`는 데이터 구조 검사 통과**입니다. 기술 정의의 학문적 정확성, 실제 연구자 검색 품질, DB 마이그레이션, 인증·인가, 전체 서비스 배포 준비 완료를 보증하지 않습니다.

`golden-test-cases.json`에 있는 33개 검증 사례는 후속 기능 테스트의 입력 자료입니다. 파일이 존재한다고 해서 33개 통합 테스트가 자동 실행되었다는 뜻은 아닙니다.

---

## 7. 검증 상태와 운영 승인

| 검증 범위 | 현재 상태 | 의미 |
|---|---|---|
| ID·참조 구조 검증 | 기본 스크립트 제공 | 로컬 실행으로 확인 가능 |
| CAP 80개·FIELD 83개 의미 검수 | **미완료** | 기술·분야 전문가의 검토 필요 |
| FIELD와 정부·국제 공식 코드의 1:1 매핑 | **미완료** | 임의의 공식 매핑 주장 금지 |
| 실제 연구자 검색·필터 사용성 | **미완료** | 다양한 분야의 사용자 테스트 필요 |
| 실제 전문가 프로필 진위 확인 | **미완료** | Mock Data를 운영 데이터로 취급 금지 |
| Next.js·FastAPI·DB 통합 | **미완료** | 서버 연동 및 권한 검증 필요 |
| 협업 요청 송수신 E2E 검증 | **미완료** | 연구자→전문가 전체 시나리오 테스트 필요 |
| 보안·성능·롤백 | **미완료** | 운영 배포 전 확인 필요 |

원칙적으로 **항목별 승인 이력 없이 `pending_review`를 운영용 승인 상태로 일괄 변경하면 안 됩니다.** 실제 검토를 완료했다면 검토자·날짜·결정·수정 근거를 남기고 승인된 카탈로그 버전을 따로 발행해야 합니다.

### v4 항목·출처의 의미

CAP 80개와 FIELD 83개는 **WHAT THE LAB 자체 서비스 분류**입니다. OECD, 국내 국가과학기술표준분류, ANZSRC, ESCO, W3C SKOS 등의 문헌은 분류의 방법과 근거를 참고하기 위한 자료이며, **개별 항목의 공식 인증을 의미하지 않습니다.** 기관별 적용 범위와 한계는 `authority-references.json`을 참조하세요.

---

## 8. 버전 관리와 팀 협업

- 기존 `CAP001~CAP080`과 `FIELD001~FIELD083`의 의미를 임의로 바꾸지 않습니다.
- 같은 개념을 개명할 때도 기존 데이터에 어떤 영향이 있는지 확인합니다.
- 다른 의미로 바뀌는 기술은 새 ID 부여 또는 폐기·대체 정책을 검토합니다.
- 구 버전에서 새 버전으로 이동할 때는 `migration-v2-review.json`의 매핑을 자동 승인하지 않습니다.
- 팀 저장소에서는 **`feature/expert-search` → Pull Request → `develop`** 흐름으로 검토받는 것을 권장합니다(팀 브랜치 정책 우선).

**추천 PR 기록 내용:** 변경한 파일, 추가·수정한 CAP/FIELD, 변경 이유, 구조 검증 결과, 실행하지 못한 테스트, UI/API/DB 영향, 리뷰가 필요한 결정 사항.

### 팀별 확인 사항

| 담당 | 확인할 내용 |
|---|---|
| 분류체계/전문가 탐색 | CAP/FIELD/UG 정의와 검색 정책 |
| 프론트엔드 | 필터·카드·가입 화면의 ID 연결 |
| 백엔드 | 검색 파라미터, 권한, 응답 형식 |
| DB | 마스터·연결 테이블과 버전별 마이그레이션 |
| QA/기획 | 직접 요청 MVP의 대표 사용자 시나리오 |

---

## 9. 자주 묻는 질문

**Q. 이 파일을 GitHub에 올리면 전문가 찾기가 바로 작동하나요?**  
A. 아니요. 검색 화면, 전문가 데이터, 서버 API와 연결하는 개발이 필요합니다.

**Q. CAP 80개는 OECD에서 공식 지정한 기술인가요?**  
A. 아니요. 실제 연구자가 의뢰할 작업을 기준으로 WHAT THE LAB에서 설계한 항목입니다.

**Q. 사용자가 UG만 고르면 전문가의 기술이 자동으로 채워지나요?**  
A. 안 됩니다. UG는 화면용 그룹이며, 실제 역량을 뜻하는 CAP는 별도로 등록·검토해야 합니다.

**Q. 구조 검증이 통과했으니 바로 배포해도 되나요?**  
A. 아니요. 분야별 검토·사용성·API/DB·보안·협업 요청 송수신 테스트가 아직 필요합니다.

**Q. 왜 기존 v3 ID를 유지했나요?**  
A. 기존 전문가 데이터와 코드가 참조하는 식별자가 불필요하게 바뀌지 않도록 하기 위해서입니다. 단, ID 안정성과 실제 런타임 호환은 다른 검증입니다.

---

## 10. 참고 출처

- [대한민국 국가과학기술표준분류 관련 행정규칙](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000269796&chrClsCd=010201)
- [OECD Frascati Manual 개정 프로젝트](https://www.oecd.org/en/about/projects/frascati-manual-development.html)
- [ANZSRC 연구 분류](https://www.abs.gov.au/statistics/classifications/australian-and-new-zealand-standard-research-classification-anzsrc/2020)
- [유럽위원회 ESCO 버전 안내](https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/esco-versions)
- [W3C SKOS Reference](https://www.w3.org/TR/skos-reference/)

---

**문서 사용 방법:** 먼저 **1~3절**에서 개념과 MVP를 이해한 뒤, **4~6절**로 실제 파일과 실행 방법을 확인하고, **7~8절**에서 운영 승인 및 협업 조건을 점검하세요.
