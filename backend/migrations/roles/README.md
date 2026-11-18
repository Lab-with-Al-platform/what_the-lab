# 운영 DB 계정과 접속 절차 (B11)

운영 RDS에는 **역할이 다른 계정 3개**를 둬요. 앱이 해킹되거나 사람이 실수해도 표를 지우거나 구조를 바꿀 수 없게 하기 위해서예요.

| 계정 | 할 수 있는 일 | 쓰는 곳 | 비밀번호 보관 |
|---|---|---|---|
| `labbridge_migrator` | 표의 주인. 마이그레이션·권한 맞추기 | `deploy.sh`의 `MIGRATION_DATABASE_URL` | SSM `/labbridge/prod/MIGRATION_DATABASE_URL` |
| `labbridge_app` | 읽기·쓰기만 (표 만들기·지우기·구조 변경 X) | backend·봇의 `DATABASE_URL` | SSM `/labbridge/prod/DATABASE_URL` |
| `labbridge_readonly` | 읽기만 (30초 넘는 조회는 끊김) | 사람이 SSM 터널로 운영 데이터를 볼 때 | SSM `/labbridge/prod/READONLY_DB_PASSWORD` |
| RDS 마스터 | 계정 만들기 (처음 한 번) | 평소에는 쓰지 않아요 | SSM (RDS 만들 때 저장) |

## 왜 정책(RLS POLICY)까지 필요한가요?

표 58개 중 **53개에 RLS(행 단위 보안)가 켜져 있어요.** Supabase의 공개 API 역할(`anon` 등)을 막으려고 켠 것이에요.
RLS 표는 **주인이 아닌 계정에게 정책이 없으면 0줄**로 보여요. 그래서 `02_grant_privileges.sql`이 표마다 우리 계정용 정책을 붙여요.

- RDS 마스터는 superuser가 아니라서 "RLS를 무시하는 계정(BYPASSRLS)"을 만들 수 없어요. 로컬 PostgreSQL 17에서 같은 상황을 만들어 확인했어요(`permission denied to create role`).
- `anon`·`authenticated`·`service_role`은 여전히 막혀 있어요.

## 파일

| 파일 | 누가·언제 | 하는 일 |
|---|---|---|
| `01_create_roles.sql` | DB 담당자, **처음 한 번** (첫 마이그레이션 전) | 계정 3개 만들기, 접속 권한 |
| `02_grant_privileges.sql` | `deploy.sh`가 **마이그레이션 뒤 매번** | 권한·RLS 정책 맞추기 (여러 번 실행해도 같음) |
| `apply_grants.py` | `deploy.sh` (backend 이미지 안) | 02를 실행해요 (이미지에 psql 이 없어서) |
| `03_verify_privileges.sql` | CI·점검 때 | 권한이 틀리면 오류로 멈춰요 |

## 처음 한 번 (Phase 3, 첫 배포 전)

1. 터널 열기 (아래 "사람이 운영 데이터를 볼 때" 1번과 같아요).
2. 마스터 계정으로 계정 만들기:
   ```bash
   psql "host=localhost port=15432 dbname=labbridge user=<마스터> sslmode=require" \
     -v migrator_password="$(openssl rand -hex 24)" \
     -v app_password="$(openssl rand -hex 24)" \
     -v readonly_password="$(openssl rand -hex 24)" \
     -f backend/migrations/roles/01_create_roles.sql
   ```
   위처럼 바로 넣으면 비밀번호를 다시 볼 수 없어요. 실제로는 변수에 먼저 담아 **SSM에 저장한 뒤** 실행해요.
3. SSM에 `DATABASE_URL`(app), `MIGRATION_DATABASE_URL`(migrator)을 `?sslmode=require`와 함께 저장해요. 배포 스크립트가 `.env.production`을 만들 때 읽어요.
4. 첫 배포: `MIGRATION_SNAPSHOT_ID=first-deploy ./deploy.sh <이미지>` → migrator로 마이그레이션 → 권한 맞추기 → app으로 backend 시작.

> 이미 마스터 계정으로 마이그레이션을 해 버렸다면, 마스터로 `REASSIGN OWNED BY <마스터> TO labbridge_migrator;`를 실행한 뒤 2~4를 해요 `[UNVERIFIED: RDS에서 미실행]`.

## 매 배포

`deploy.sh`가 알아서 해요: `alembic upgrade head`(migrator) → `apply_grants.py`(migrator) → backend 교체(app).
새 마이그레이션이 RLS 표를 만들어도 정책이 자동으로 붙어요.

## 사람이 운영 데이터를 볼 때

1. 터널 열기 (EC2가 켜져 있어야 해요):
   ```bash
   LABBRIDGE_EC2_ID=<EC2 ID> LABBRIDGE_RDS_HOST=<RDS 주소> ./infra/db/db-tunnel.sh
   ```
2. 다른 터미널에서 **조회 전용**으로 접속:
   ```bash
   psql "host=localhost port=15432 dbname=labbridge user=labbridge_readonly sslmode=require"
   ```
3. 끝나면 터널을 `Ctrl+C`로 닫아요.

**지키는 것**
- **로컬 backend를 운영 DB(터널)에 연결하지 않아요.** backend는 켜지는 순간 요청 만료·아침 브리핑을 시작하고, 봇 토큰이 있으면 실제 회원에게 DM이 나가요. `db-tunnel.sh`는 `.env`가 터널 포트를 가리키면 멈춰요.
- 운영 마이그레이션은 터널이 아니라 **EC2의 `deploy.sh`**로 해요 (터널이 끊기면 중간에 멈출 수 있어요).
- 운영 데이터를 개발 DB나 내 PC 파일로 복사하지 않아요 (AGENTS.md: 가상·비식별 데이터만).
- 구조 문제 분석처럼 쓰기가 필요하면 DB 담당자가 두 사람이 함께 확인하고 해요 ([04](../../../docs/aws-deployment/04-database-storage.md) 6절).

## 사람별 IAM 권한 (예시)

공용 AWS 계정을 쓰지 않고, 터널을 열 사람에게만 아래 권한을 줘요. EC2 ID·계정 ID는 실제 값으로 바꿔요 `[PROPOSED]`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:StartSession",
      "Resource": [
        "arn:aws:ec2:ap-northeast-2:<계정ID>:instance/<EC2 ID>",
        "arn:aws:ssm:ap-northeast-2::document/AWS-StartPortForwardingSessionToRemoteHost"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:TerminateSession", "ssm:ResumeSession"],
      "Resource": "arn:aws:ssm:*:*:session/${aws:username}-*"
    }
  ]
}
```

## 검증

- CI `migration-check`가 PR마다 같은 흐름을 돌려요: superuser가 아닌 마스터 → 계정 3개 → migrator 마이그레이션 → 권한 맞추기 2번 → `03_verify_privileges.sql` → 앱·조회 계정으로 RLS 표 읽기, 막혀야 하는 쓰기·표 만들기 확인.
- 로컬 PostgreSQL 17에서 앱 계정으로 backend를 켜서 API 응답과 백그라운드 작업에 권한 오류가 없는 것도 확인했어요.
