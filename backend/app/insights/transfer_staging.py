"""전송 원고의 내부 반입 로직. 아직 웹·CLI·AWS 실행 경로와 연결하지 않습니다."""

from hashlib import sha256

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.insights import editorial, importing, service
from app.insights.models import Candidate, TransferReceipt, TransferReceiptItem
from app.insights.schemas import CandidateImportInput
from app.insights.transfer_contract import TransferBundle, TransferItem, validate_transfer_bytes

# 운영 주체가 정해지기 전 가상 로컬 범위. 기계 인증이 구현됐다는 뜻이 아닙니다.
LOCAL_VIRTUAL_TRUST_SCOPE = "local-virtual"
TRUST_SCOPE_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")


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


def checked_trust_scope(value: str) -> str:
    """신뢰 범위는 서버가 정합니다. JSON·actor에서 고르면 안 됩니다."""
    allowed = value and len(value) <= 64 and set(value) <= TRUST_SCOPE_CHARS
    if not allowed:
        raise ValueError("신뢰 범위는 서버가 정한 값만 사용할 수 있습니다.")
    return value


def find_receipt(session: Session, trust_scope: str, bundle_id: str) -> TransferReceipt | None:
    return session.scalar(
        select(TransferReceipt).where(
            TransferReceipt.trust_scope == trust_scope,
            TransferReceipt.bundle_id == bundle_id,
        )
    )


def mapping_payload(session: Session, receipt_id: str) -> list[dict]:
    rows = session.scalars(
        select(TransferReceiptItem)
        .where(TransferReceiptItem.receipt_id == receipt_id)
        .order_by(TransferReceiptItem.item_index)
    ).all()
    return [
        {
            "index": row.item_index,
            "candidate_id": row.candidate_id,
            "revision_number": row.revision_number,
            "action": row.action,
        }
        for row in rows
    ]


def replay_or_conflict(session: Session, receipt: TransferReceipt, digest: str) -> dict:
    """같은 바이트면 최초 스냅샷을 재사용하고, 다른 바이트면 거절합니다."""
    if receipt.sha256 != digest:
        # JSON 공백만 달라도 해시가 다릅니다. CLI 종료 코드 2로 바꾸지 않습니다.
        raise HTTPException(409, "같은 묶음 ID에 다른 원본이 있습니다.")
    snapshot = receipt.first_result
    return {
        **snapshot,
        "dry_run": False,
        "created": 0,
        "would_create": 0,
        "sha256": digest,
        "publication_approved": False,
        "receipt_outcome": "replayed",
        "first_outcome": receipt.outcome,
        "trust_scope": receipt.trust_scope,
        "mappings": mapping_payload(session, receipt.id),
    }


def attach_manuscripts(
    session: Session, bundle: TransferBundle, result: dict, digest: str, actor: str
) -> None:
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


def store_receipt_items(session: Session, receipt: TransferReceipt, result: dict) -> None:
    for entry in result["items"]:
        candidate_id = entry.get("candidate_id")
        revision_number = None
        if candidate_id:
            candidate = session.get(Candidate, candidate_id)
            if candidate is not None:
                revision_number = candidate.current_revision
        session.add(
            TransferReceiptItem(
                receipt_id=receipt.id,
                item_index=entry["index"],
                candidate_id=candidate_id,
                revision_number=revision_number,
                action=entry["action"],
            )
        )


def persist_transfer_bundle(
    session: Session,
    bundle: TransferBundle,
    digest: str,
    actor: str,
    trust_scope: str,
) -> dict:
    existing = find_receipt(session, trust_scope, bundle.bundle_id)
    if existing is not None:
        return replay_or_conflict(session, existing, digest)
    # 조회 후 삽입만으로 동시 안전을 주장하지 않습니다. 유일 제약이 같은 ID를 막습니다.
    receipt = TransferReceipt(
        trust_scope=trust_scope,
        bundle_id=bundle.bundle_id,
        run_id=bundle.run_id,
        sha256=digest,
        outcome="imported",
        first_result={},
    )
    session.add(receipt)
    session.flush()
    request = CandidateImportInput(dry_run=False, drafts=[item.draft for item in bundle.items])
    result = importing.import_candidates(session, request, actor)
    attach_manuscripts(session, bundle, result, digest, actor)
    receipt.outcome = "imported" if result["created"] else "existing_preserved"
    receipt.first_result = {
        "created": result["created"],
        "would_create": result["would_create"],
        "existing_preserved": result["existing_preserved"],
        "duplicate_in_batch": result["duplicate_in_batch"],
        "items": result["items"],
    }
    store_receipt_items(session, receipt, result)
    service.flush_changes(session)
    return {
        **result,
        "sha256": digest,
        "publication_approved": False,
        "receipt_outcome": receipt.outcome,
        "first_outcome": receipt.outcome,
        "trust_scope": trust_scope,
        "mappings": mapping_payload(session, receipt.id),
    }


def stage_transfer_candidates(
    session: Session,
    raw: bytes,
    actor: str,
    *,
    dry_run: bool = True,
    trust_scope: str = LOCAL_VIRTUAL_TRUST_SCOPE,
) -> dict:
    """새 후보만 메모+전체 원고로 준비하고, 실패하면 이번 묶음만 함께 취소합니다.

    호출자는 권한 검사를 완료한 신뢰하는 코드여야 합니다. 이 함수는 인증을 대신하지
    않으며 commit도 하지 않습니다. 현재는 가상 DB 테스트에서만 호출합니다.
    """
    bundle = validate_transfer_bytes(raw)
    digest = sha256(raw).hexdigest()
    scope = checked_trust_scope(trust_scope)
    if not session.in_transaction():
        raise ValueError("호출자가 바깥 트랜잭션을 먼저 시작해야 합니다.")
    # SAVEPOINT는 묶음 안의 메모·원고·접수를 함께 되돌리는 임시 책갈피입니다.
    # 바깥 트랜잭션의 시작·최종 commit/rollback은 호출자가 맡습니다.
    if dry_run:
        with session.begin_nested():
            drafts = [item.draft for item in bundle.items]
            request = CandidateImportInput(dry_run=True, drafts=drafts)
            result = importing.import_candidates(session, request, actor)
            service.flush_changes(session)
        return {**result, "sha256": digest, "publication_approved": False}
    try:
        with session.begin_nested():
            return persist_transfer_bundle(session, bundle, digest, actor, scope)
    except IntegrityError:
        # 같은 신뢰 범위+묶음 ID가 동시에 들어가면 유일 제약이 막습니다.
        existing = find_receipt(session, scope, bundle.bundle_id)
        if existing is None:
            raise
        return replay_or_conflict(session, existing, digest)
