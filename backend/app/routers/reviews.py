"""Actual, authenticated post-collaboration review API.

No score is accepted while a collaboration is ongoing or canceled.
The server derives reviewer/reviewee from collaboration ownership (never client IDs).
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.config import CORS_ORIGINS, FRONTEND_URL
from app.reputation_store import expert_reputation, reputations_for_experts
from app.review_store import (
    edit_review, eligible_reviews, moderation_queue, moderate_report,
    public_expert_reviews, report_review, review_context, submit_review,
)
from app.security import get_current_user, get_current_user_id

router = APIRouter(prefix="/api/v1/reviews", tags=["collaboration-reviews"])

class ReviewBody(BaseModel):
    expertise: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    timeliness: int = Field(ge=1, le=5)
    quality: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)

class ReportBody(BaseModel):
    reason: Literal["abuse", "privacy", "false_claim", "other"]
    description: str = Field(default="", max_length=300)

class ModerationBody(BaseModel):
    decision: Literal["hide", "dismiss", "restore"]
    reason: str = Field(min_length=5, max_length=300)


def check_review_origin(request: Request) -> None:
    """Cookie-authenticated writes require an explicitly authorized first-party origin."""
    origin = request.headers.get("origin")
    allowed = {origin.strip().rstrip("/") for origin in [*CORS_ORIGINS, FRONTEND_URL] if origin.strip()}
    if not origin or origin.rstrip("/") not in allowed:
        raise HTTPException(403, "허용된 사이트에서 평가를 작성해 주세요.")


def require_review_moderator(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    # Operations reader lists must not gain write/moderation powers.
    if user.get("is_admin") is not True:
        raise HTTPException(403, "후기 검토 권한이 없습니다.")
    return user


@router.get("/mine")
def my_review_opportunities(user_id: int = Depends(get_current_user_id)) -> list[dict]:
    """My completed collaborations, review state, and submission window."""
    return eligible_reviews(user_id)


@router.get("/reputation")
def list_public_reputation(
    ids: str = Query("", max_length=1300),
) -> dict[str, dict]:
    """Batched public reputation snapshots for cards (no per-card N+1)."""
    if not ids:
        return {}
    if len(ids) > 1300:
        raise HTTPException(422, "전문가 ID 목록이 너무 깁니다.")
    values = ids.split(",")
    if len(values) > 60 or any(not value.isascii() or not value.isdecimal() for value in values):
        raise HTTPException(422, "전문가 ID는 최대 60개의 양의 정수로 입력해 주세요.")
    try:
        found = reputations_for_experts([int(value) for value in values])
    except ValueError:
        raise HTTPException(422, "전문가 ID가 올바르지 않습니다.") from None
    return {str(key): value for key, value in found.items()}


@router.get("/experts/{expert_id}/reputation")
def get_expert_reputation(expert_id: int) -> dict:
    """Public LAB TRUST; never substitute the 5-star raw review average."""
    return expert_reputation(expert_id)


@router.get("/experts/{expert_id}/summary")
def expert_summary(expert_id: int) -> dict:
    """Only verified researcher->expert public ratings from completed collaborations."""
    return public_expert_reviews(expert_id)


@router.get("/collaborations/{collaboration_id}")
def get_collaboration_review(collaboration_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return review_context(collaboration_id, user_id)


@router.post("/collaborations/{collaboration_id}")
def post_collaboration_review(
    collaboration_id: int, body: ReviewBody, request: Request,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    check_review_origin(request)
    return submit_review(user_id, collaboration_id, body.model_dump())


@router.put("/collaborations/{collaboration_id}")
def put_collaboration_review(
    collaboration_id: int, body: ReviewBody, request: Request,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    check_review_origin(request)
    return edit_review(user_id, collaboration_id, body.model_dump())


@router.post("/{review_id}/reports")
def report_public_review(
    review_id: int, body: ReportBody, request: Request,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    check_review_origin(request)
    return report_review(user_id, review_id, body.reason, body.description)


@router.get("/moderation/access")
def review_moderator_access(_: Annotated[dict, Depends(require_review_moderator)]) -> dict:
    return {"can_moderate_reviews": True}


@router.get("/moderation/reports")
def list_review_reports(_: Annotated[dict, Depends(require_review_moderator)]) -> list[dict]:
    return moderation_queue()


@router.put("/moderation/reports/{report_id}")
def review_report_decision(
    report_id: int, body: ModerationBody, request: Request,
    moderator: Annotated[dict, Depends(require_review_moderator)],
) -> dict:
    check_review_origin(request)
    return moderate_report(report_id, moderator["user_id"], body.decision, body.reason)
