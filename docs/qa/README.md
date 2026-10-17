# 검증 기록·스크린샷

검증 당시의 실행 결과와 화면을 날짜별로 보관합니다. 과거 QA 통과가 현재 코드·실서비스·외부 API의 정상 동작을 보증하지는 않습니다.

- [2026-10-17 PR #10 충돌 해결·검증](PR10_MERGE_RESOLUTION_2026-10-17.md): 회원·인사이트 API 보존, 가상 회원 기준 테스트 30개 통과. PostgreSQL 회원 전환은 미완료

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
