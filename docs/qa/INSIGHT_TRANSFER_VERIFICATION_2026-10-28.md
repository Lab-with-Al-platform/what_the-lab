# 인사이트 전송 계약·내부 반입 검증

검증일: 2026-10-28. 관련 안내: [전송 계약 v1](../ai-case-automation/INSIGHT_TRANSFER_CONTRACT.md).

## 변경 목적과 범위

수집 AI의 짧은 근거 메모만 전달하면 전체 본문이 누락될 수 있어, 근거 메모 `draft`와 전체 원고 `article`을 함께 받는 JSON 계약을 추가했다. 오프라인 검사기는 DB에 접속하지 않는다. 내부 반입 함수는 기존 후보 등록·원고 판본 생성을 재사용하되 웹·CLI·AWS 실행 경로에는 연결하지 않았다.

한 묶음의 메모·원고를 SAVEPOINT로 함께 취소하며, 최종 commit은 호출자가 맡는다. 외부 검증 완료·점수·서지 확인·접근 수준은 초기화하고 운영 승인된 CAP만 제안으로 보존한다. 기존 후보·관리자 수정·공개 스냅샷은 덮어쓰지 않는다.

기존 importer가 전체 원고 판본의 `article.slug`를 검사하지 않아 다른 출처의 동일 주소를 놓칠 수 있었다. 최상위 `slug`와 `article.slug`를 함께 확인하도록 보완했다.

## 검증 결과

| 검사 | 결과 | 범위 |
|---|---|---|
| 새 내부 반입 테스트 | 11 passed | 임시 SQLite, 가상 원고·계정·CAP 목록 |
| 새 반입·전송·오프라인 SQL | 53 passed, 1 skipped | 실제 DB 연결 없음 |
| 관련 9개 파일 회귀 | 162 passed, 1 skipped, 1 warning | 기존 후보 등록·편집·workspace·API와 오프라인 SQL 포함 |
| Ruff check·format check | 통과 | 변경 Python 7개 |
| `git diff --check` | 통과 | 공백 오류 검사 |

반입 테스트는 기본 미리 보기 무저장, 근거/본문 동시 저장, 외부 검증 상태 초기화, 전체 본문·용어 보존, 기존 관리자 수정·공개본 보존, 뒤쪽 저장 실패의 전체 취소, 호출자 rollback 보존, 입력 불일치 선차단, DOI/URL 정규화, 같은 출처의 사례/트렌드 분리, 주소 충돌을 검사한다.

skip은 Windows 계정의 심볼릭 링크 생성 권한 부족이다. warning은 기존 Starlette/httpx TestClient deprecation이며 의존성은 바꾸지 않았다.

### 재현 명령

`backend` 폴더에서 실행한다. 실제 `.env`를 변경하거나 Supabase·Docker를 실행할 필요가 없다. 테스트의 임시 DB·가상 계정은 `tests/conftest.py`와 fixture가 지정한다.

```powershell
.\.venv\Scripts\python.exe -B -m pytest tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_import.py tests/test_insight_editorial.py tests/test_insight_workspace.py tests/test_insight_workflow.py tests/test_insight_migration.py tests/test_supabase_setup.py tests/test_insight_admin_ui_api.py -q -p no:cacheprovider --basetemp=../tmp/insight-transfer-review
```

위 `--basetemp`는 pytest가 정리하는 **테스트 전용 임시 폴더**다. 보존할 파일이 있는 폴더를 지정하지 않는다.

```powershell
.\.venv\Scripts\python.exe -m ruff check app/insight_transfer.py app/insights/transfer_contract.py app/insights/transfer_staging.py app/insights/importing.py tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_workflow.py
.\.venv\Scripts\python.exe -m ruff format --check app/insight_transfer.py app/insights/transfer_contract.py app/insights/transfer_staging.py app/insights/importing.py tests/test_insight_transfer.py tests/test_insight_transfer_staging.py tests/test_insight_workflow.py
```

### 테스트 실행 환경

Windows 제한 환경에서는 TestClient가 앱 로직에 도달하기 전 `socket._fallback_socketpair → accept`에서 대기했다. 단일 테스트·시간 제한·faulthandler로 위치를 확인하고, 로컬 소켓 사용이 허용되는 환경에서 회귀를 완료했다. 실제 앱의 이벤트 루프를 수정하지 않았다.

인사이트 TestClient fixture는 테스트용 lifespan으로 협업 만료 worker·알림 전송을 격리한다. 실제 서버 시작 동작은 그대로이며, 이 검사는 worker 자체를 검증하지 않는다. SQLite는 테스트에서 BEGIN을 명시해 SAVEPOINT와 바깥 rollback을 검사한다.

## 남은 조건과 미검증

- `bundle_id`·파일 해시·결과의 영속적 접수 이력은 미구현이다. 같은 후보의 재입력은 보존하지만, 같은 묶음 ID에 다른 새 출처를 넣은 파일을 묶음 단위로 거절하지는 않는다. 전부 기존 후보인 묶음도 별도 접수 기록이 없다.
- 신뢰하는 실행기가 확보할 PR·커밋 정보, 승인 설정 버전/출처 대조, 기계 인증·최소 권한, PostgreSQL 동시성 검증이 남았다. `actor` 인자와 제출자의 메타데이터는 인증·승인 증거가 아니다.
- 새 migration·환경변수·외부 반입 API는 없다. 실제 DB 적용·자료 수집·모델 호출·AWS 배포·정기 실행·게시 활성화를 하지 않았다.
- UI 변경이 없어 화면 캡처·프론트 빌드는 수행하지 않았다. 전체 저장소 테스트, 실제 PostgreSQL 동시 실행, 운영 인증·배포를 검증한 결과는 아니다.

이 PR의 완료 범위는 전송 계약과 내부 반입의 로컬 검증이다. 실제 실행 경로 연결과 자동 게시 완료로 해석하지 않는다.
