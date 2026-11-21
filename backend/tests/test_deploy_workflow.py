"""운영 배포 워크플로(deploy.yml) 지키기: AWS 없이 파일 내용만 확인해요.

- 배포 역할(labbridge-github-deploy)은 main 브랜치 증명서만 믿어요. environment를 쓰면 증명서 값이 바뀌어 역할을 못 써요.
- 화면 배포는 지금 켜고, 서버 배포는 BACKEND_DEPLOY_ENABLED 변수로 켤 때까지 꺼 둬요.
자세한 이유: docs/aws-deployment/14-ci-cd-pipeline.md 5절
"""

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"


def load() -> dict:
    """워크플로 YAML을 읽어요. (YAML에서 on: 은 True 키로 읽혀요)"""
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def steps_text(job: dict) -> str:
    """한 작업(job)의 단계 run·uses를 한 덩어리 글자로 모아요."""
    parts = []
    for step in job["steps"]:
        parts.append(str(step.get("run", "")))
        parts.append(str(step.get("uses", "")))
        parts.append(str(step.get("with", "")))
    return "\n".join(parts)


def test_runs_only_from_main():
    """main에 올라갈 때와 손으로 실행할 때만 돌아요."""
    triggers = load()[True]
    assert triggers["push"]["branches"] == ["main"]
    assert "workflow_dispatch" in triggers
    assert "pull_request" not in triggers


def test_no_environment_so_oidc_subject_stays_main():
    """environment를 쓰면 OIDC sub가 environment:… 로 바뀌어 신뢰 정책과 맞지 않아요."""
    for name, job in load()["jobs"].items():
        assert "environment" not in job, name


def test_oidc_permission_and_one_deploy_at_a_time():
    flow = load()
    assert flow["permissions"] == {"contents": "read", "id-token": "write"}
    assert flow["concurrency"]["group"] == "production"
    assert flow["concurrency"]["cancel-in-progress"] is False


def test_ci_must_pass_first():
    jobs = load()["jobs"]
    assert jobs["ci"]["uses"] == "./.github/workflows/ci.yml"
    assert "ci" in jobs["frontend"]["needs"]


def test_frontend_uploads_then_publishes_function_then_invalidates():
    """화면 파일 올리기 → 주소 변환 함수 게시 → 캐시 비우기 순서예요."""
    text = steps_text(load()["jobs"]["frontend"])
    assert "npm run build:static" in text
    assert "aws-actions/configure-aws-credentials@v4" in text
    upload = text.index("aws s3 sync out/ ")
    publish = text.index("aws cloudfront publish-function")
    invalidate = text.index("aws cloudfront create-invalidation")
    assert upload < publish < invalidate
    # 지워진 화면은 S3에서도 지우고, 이름에 해시가 붙은 _next/static 은 오래 캐시해요.
    assert "--delete" in text
    assert "immutable" in text


def test_backend_deploy_is_off_until_enabled():
    """서버 배포는 변수로 켤 때까지 실행되지 않아요."""
    backend = load()["jobs"]["backend"]
    assert "vars.BACKEND_DEPLOY_ENABLED == 'true'" in backend["if"]
    # 화면은 서버 배포가 꺼져 있으면(skipped) 그대로 진행해요.
    assert "needs.backend.result == 'skipped'" in load()["jobs"]["frontend"]["if"]


def test_no_long_lived_aws_keys():
    """액세스 키를 저장하지 않고 OIDC 역할만 써요."""
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "AWS_ACCESS_KEY_ID" not in text
    assert "AWS_SECRET_ACCESS_KEY" not in text
    assert "vars.AWS_DEPLOY_ROLE_ARN" in text


def test_ci_concurrency_does_not_cancel_deploy():
    """Deploy가 불러 쓰는 CI와 main의 CI가 같은 그룹이면 서로 취소해 배포가 실패해요."""
    ci = yaml.safe_load((ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8"))
    assert "github.workflow" in ci["concurrency"]["group"]
