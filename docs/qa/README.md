# 검증 기록·스크린샷

검증 당시의 실행 결과와 화면을 날짜별로 보관합니다. 과거 QA 통과가 현재 코드·실서비스·외부 API의 정상 동작을 보증하지는 않습니다.

- [2026-10-22 후보 부족 시 기간 확장 정책](insight-discovery-policy-20261022/README.md): 성격별 탐색 순서·상한, 기준 후보 수와 저장 수 분리, 개발 DB 설정 보존·반응형 검증

- [2026-10-22 출처 확장·용도 복수 분류](insight-sources-20261022/README.md): 추천 출처 11곳, 협업사례·AI 트렌드 선택, 기존 설정 보존과 개발 DB 저장 검증

- [2026-10-22 수집 메모·게시용 원고 분리](insight-editorial-20261022/README.md): 6개 비공개 후보 보강, 독자 검수 6항목, 기존 공개본 31개 보존과 반응형 편집 화면 검증

- [2026-10-20 이미지 전달 최적화](image-optimization-20261020/README.md): 원본 56개 보존, 반응형 크기·지연 로딩·모바일 불필요 요청 방지, 실제 이미지 API 37건과 18개 화면 조건 전후 비교

- [2026-10-19 짧은 인사이트 설명 깊이 보강](insight-depth-20261019/README.md): 28개 글의 원리·예시·평가 설계 보강, 원문 수치 대조, 기존 상세 글·표지 보존, 31개 글 반응형 검증

- [2026-10-19 인사이트 표지 중복 해소·분량 점검](insight-covers-20261019/README.md): 전용 표지 18개 생성, 기존 원본 보존, 글별 표지 연결과 짧은 원고의 원인·보강 후보 확인

- [2026-10-19 인사이트 28개 글 보강](insight-expansion-20261019/README.md): 기존 상세 글 3개 보존, 주제별 원고·용어·편집자 노트, 출처와 시나리오 구분, 31개 글 반응형 검증

- [2026-10-17 PR #10 충돌 해결·검증](PR10_MERGE_RESOLUTION_2026-10-17.md): 회원·인사이트 API 보존, 가상 회원 기준 테스트 30개 통과. PostgreSQL 회원 전환은 미완료

- [2026-10-17 인사이트 읽기 경험 개선](INSIGHT_READING_EXPERIENCE_2026-10-17.md): MatterGen 두 관점의 글, 용어 풀이와 편집자 노트. 로컬 검증 범위를 기록

- [2026-10-16 인사이트 개발용 Supabase 적용·검증](INSIGHT_SUPABASE_MIGRATION_2026-10-16.md): 최초 테이블 생성, DB 역할 권한, 실제 PostgreSQL 동시성, 전체 테스트 29개 통과

| 폴더 | 내용 | 결과 위치 |
|---|---|---|
| list-editorial-20261009 | 사례·트렌드 목록 에디토리얼 적용 | [검증 기록](list-editorial-20261009/README.md) |
| list-editorial-header-20261009 | 목록 제목 분리·인용 영역 조정 | [검증 기록](list-editorial-header-20261009/README.md) |
| hero-frame-20261009 | 넓은 화면 이미지 프레임 넘침 수정 | [검증 기록](hero-frame-20261009/README.md) |
| home-cards-20261016 | 메인 탐색 카드 전체 링크·호버·키보드, taxonomy 연결 상태 확인 | [검증 기록](home-cards-20261016/README.md) |
| ai-cases-20261010 | 연구사례 콘텐츠 화면 | [측정 결과](ai-cases-20261010/verification.json) |
| ai-trend-co-scientist-20261010 | Co-Scientist·MatterGen·AlphaEvolve 화면 | [측정 결과](ai-trend-co-scientist-20261010/verification.json) |

새 검증 기록에는 확인일, 코드·브랜치 기준, 수행한 검증, 미검증 범위와 캡처를 함께 남깁니다. 기존 증거는 덮어쓰지 않습니다.

[전체 문서 안내](../README.md) · [디자인 검수 기준](../design/DESIGN_QA_CHECKLIST.md)
