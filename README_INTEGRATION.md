# LabBridge 최종 통합본 — 2026-10-26

오늘 업로드한 프로젝트 전체에 자유게시판·FAQ V2를 병합하고 호환성 문제를 수정한 버전입니다. frontend·backend·database·docs는 모두 제자리에 있습니다. 이전 게시판 ZIP을 추가로 덮어쓰지 마세요.

- [호환성 분석](docs/community/SOURCE_COMPATIBILITY.md)
- [실행·DB 적용 순서](docs/community/INSTALL_AND_QA.md)
- [실제 통합 검증 결과](docs/community/INTEGRATION_VERIFICATION_20261026.md)
- [변경 파일 경로표](docs/community/INTEGRATION_FILES_20261026.csv)
- [원본 766개 파일 검사](docs/community/SOURCE_FILE_AUDIT_20261026.csv)

메인 메뉴에 `/community`, `/faq`가 추가되었습니다. 기존 전문가 찾기·직접 협업 요청·요청관리·협업 알림·프로필 설정을 보존했습니다.

현재 migration head는 `20261026_11`입니다. 협업 알림 `20261025_06` 뒤에 조회수·운영 이력·방문 수집 `20261026_07`~`09`가 있고, 그 뒤에 게시판 `10`·`11`이 연결됩니다. 10월 26일 통합본의 게시판 07·08 번호는 운영 조회와 겹쳐서 다시 매겼습니다. **공용 Supabase 변경은 기존 팀 규칙에 따라 DB 담당자만 적용합니다.** 일반 팀원은 임의 upgrade/stamp를 실행하지 않습니다. 기존 Docker DB와 Alembic 관리 DB의 적용 방식도 다르므로 위 설치 안내를 먼저 확인하세요.

기존 `.env`·`frontend/.env.local`·업로드 원본은 이 ZIP에 포함하지 않았습니다. 기존 설정을 보관하고 backend `uv sync --locked`, frontend `npm ci`로 설치합니다. 원격 DB 변경·실제 Discord 전송·공개 배포는 실행하지 않았습니다.
