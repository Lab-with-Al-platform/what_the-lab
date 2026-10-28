"""전송 원고의 내부 반입 로직. 아직 웹·CLI·AWS 실행 경로와 연결하지 않습니다."""

from hashlib import sha256

from sqlalchemy.orm import Session

from app.insights import editorial, importing, service
from app.insights.schemas import CandidateImportInput
from app.insights.transfer_contract import TransferBundle, TransferItem, validate_transfer_bytes


def submission_metadata(bundle: TransferBundle, item: TransferItem, digest: str) -> dict:
    """파일의 출처 메모를 남깁니다. PR·권리·게시 승인 증거로 사용하지 않습니다."""
    return {
        "trust": "unverified_submission",
        "schema_version": bundle.schema_version,
        "bundle_id": bundle.bundle_id,
        "run_id": bundle.run_id,
        "generated_at": bundle.generated_at.isoformat(),
        "settings_version": bundle.settings_version,
        "generator": bundle.generator.model_dump(mode="json"),
        "source_published": item.source_published.model_dump(mode="json"),
        "source_checked_at": item.source_checked_at.isoformat(),
        "access_notes": item.access_notes,
        "rights_notes": item.rights_notes,
        # 식별자는 제출자의 제안이고, 해시는 이 함수가 받은 원본 바이트에서 계산합니다.
        "sha256": digest,
    }


def stage_transfer_candidates(
    session: Session,
    raw: bytes,
    actor: str,
    *,
    dry_run: bool = True,
) -> dict:
    """새 후보만 메모+전체 원고로 준비하고, 실패하면 이번 묶음만 함께 취소합니다.

    호출자는 권한 검사를 완료한 신뢰하는 코드여야 합니다. 이 함수는 인증을 대신하지
    않으며 commit도 하지 않습니다. 현재는 가상 DB 테스트에서만 호출합니다.
    """
    bundle = validate_transfer_bytes(raw)
    digest = sha256(raw).hexdigest()
    request = CandidateImportInput(dry_run=dry_run, drafts=[item.draft for item in bundle.items])
    if not session.in_transaction():
        raise ValueError("호출자가 바깥 트랜잭션을 먼저 시작해야 합니다.")
    # SAVEPOINT는 묶음 안의 메모와 원고를 함께 되돌리는 임시 책갈피입니다.
    # 바깥 트랜잭션의 시작·최종 commit/rollback은 호출자가 맡습니다.
    with session.begin_nested():
        result = importing.import_candidates(session, request, actor)
        for entry in result["items"]:
            if entry["action"] != "created":
                continue  # 기존 글은 관리자 수정·승인 상태·공개본까지 모두 그대로 둡니다.
            item = bundle.items[entry["index"]]
            candidate = service.get_candidate(session, entry["candidate_id"])
            article = item.article.model_dump(mode="json", exclude_none=True)
            # 메모 쪽에서 정규화한 주소·DOI를 재사용해 표기 차이로 실패하지 않게 합니다.
            article["sourceUrl"] = str(item.draft.source.url)
            article["doi"] = item.draft.source.doi
            candidate = editorial.start_article_draft(
                session,
                candidate.id,
                candidate.version,
                actor,
                "전송 원고 반입 · 근거·권리·편집 검토와 승인은 별도",
                article=article,
            )
            revision = editorial.current_revision(session, candidate)
            # JSON 열은 기존 dict를 직접 고치는 대신 새 dict를 할당해야 변경을 추적합니다.
            revision.content = {
                **revision.content,
                "transfer": submission_metadata(bundle, item, digest),
            }
            service.add_event(session, candidate, actor, "transfer_staged", "미승인 전체 원고 반입")
        service.flush_changes(session)
    return {**result, "sha256": digest, "publication_approved": False}
