# 격리 PostgreSQL 호환 검증 (2026-10-26)

이 폴더는 앱 배포 의존성이 아닙니다. 가상 계정만 사용하고 외부 DB/OAuth/Discord에 연결하지 않습니다. Node.js와 backend의 Python 의존성을 준비한 뒤 실행합니다.

```powershell
# 이 폴더에서
npm ci
# backend 가상환경 Python 사용. 프로젝트 루트 경로는 본인 환경에 맞춤.
../../backend/.venv/Scripts/python.exe run_pglite_check.py --project ../..
node check_docker_init.mjs ../..
```

Linux/macOS에서는 `../../backend/.venv/bin/python`을 사용합니다. 검사마다 새 메모리 DB를 만들고 종료하면 버립니다. PostgreSQL 프로토콜 포트 55439를 사용합니다. 기존 사용자 DB URL은 테스트 스크립트가 격리 URL로 교체하므로 읽지 않습니다. 원격 DB용 migration 명령과 다릅니다.

`run_pglite_check.py`: 전체 Alembic 8개 이력, 오늘 06 상태의 데이터 보존, RLS/브라우저 역할 직접 접근 차단, BIGINT 회원, 한국어 JSON 태그, 실제 FastAPI+psycopg 게시판 CRUD, 협업 요청 전송/수락/시작, 두 알림 영역의 분리, 같은 게시글 답변 FK를 검사합니다.

`check_docker_init.mjs`: database/init의 SQL 10개를 이름 순서대로 실행합니다. 실제 Docker 엔진 실행은 아닙니다.

PGlite의 단일 WASM 인스턴스와 socket multiplexer는 native PostgreSQL 다중 연결/잠금/부하 시험을 대체하지 않습니다. 동봉 JSON은 이 환경의 실행 결과이며 실제 Supabase·HTTPS·Discord 승인/DM·운영 배포 결과가 아닙니다.
