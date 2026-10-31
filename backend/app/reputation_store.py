"""LAB TRUST v1 — explainable, evidence-gated collaboration reputation.

This is a *derived view* of real, eligible completed-project feedback; there is
no editable reputation number, signup gift score, background cache or new table.
Not an identity, institution, or professional licence verification.

Design:
- Use only researcher -> expert reviews from normally completed collaborations.
- Reuse existing seven-day publication embargo and moderator visibility gate.
- Cap any one reviewer's influence to their three most recent eligible projects.
- Hold back the numeric index until >=3 eligible contributions from >=2 people.
- Weighted evidence rating (1-5): expertise .30, communication .20,
  timeliness .15, quality .35.
- Shrink volatile small samples toward a transparent 3.8 prior (weight=5).
- Map the shrunk mean to 0..100; a missing score is NOT 0.
- No penalties for absence, inactivity, declines, new memberships or profile edits.
- Do not use this number to sort/search-rank experts in v1.
"""
from decimal import Decimal, ROUND_HALF_UP

from app.db import get_connection

MIN_REVIEWS = 3
MIN_REVIEWERS = 2
MAX_REVIEWS_PER_REVIEWER = 3
MAX_EXPERT_ID = 9_223_372_036_854_775_807  # PostgreSQL BIGINT
PRIOR_RATING = Decimal("3.8")
PRIOR_WEIGHT = Decimal("5")
WEIGHTS = {
    "expertise": Decimal("0.30"),
    "communication": Decimal("0.20"),
    "timeliness": Decimal("0.15"),
    "quality": Decimal("0.35"),
}
assert sum(WEIGHTS.values()) == Decimal("1.00")

# One batched query across a bounded set of public expert IDs; prevents N+1
# calls and excludes fake demo rows, hidden/early-ended reviews, and pending
# reviews using exactly the same release window as public_expert_reviews().
REPUTATION_SQL = """
WITH public_experts AS (
    SELECT e.user_id
    FROM expert e JOIN users u ON u.user_id=e.user_id
    WHERE e.user_id = ANY(%s) AND e.is_public=TRUE AND u.status='active'
),
verified AS (
    SELECT v.reviewee_id, v.reviewer_id,
           (v.expertise*0.30 + v.communication*0.20
            + v.timeliness*0.15 + v.quality*0.35) AS weighted_rating,
           ROW_NUMBER() OVER (
             PARTITION BY v.reviewee_id, v.reviewer_id
             ORDER BY c.ended_at DESC, v.review_id DESC
           ) AS reviewer_rank
    FROM collaboration_review v
    JOIN public_experts pe ON pe.user_id=v.reviewee_id
    JOIN collaboration c ON c.collaboration_id=v.collaboration_id
    JOIN research r ON r.research_id=c.research_id
    WHERE v.reviewer_id=r.user_id
      AND v.reviewer_side='researcher'
      AND v.visibility='visible'
      AND c.status='done'
      AND c.expert_id=v.reviewee_id
      AND c.ended_at IS NOT NULL
      AND c.ended_at <= now() - interval '7 days'
)
SELECT reviewee_id AS expert_id,
       COUNT(*)::int AS review_count,
       COUNT(DISTINCT reviewer_id)::int AS reviewer_count,
       SUM(weighted_rating)::numeric AS weighted_sum
FROM verified
WHERE reviewer_rank <= 3
GROUP BY reviewee_id
"""


def compute_reputation(review_count: int, reviewer_count: int, weighted_sum) -> dict:
    """Pure deterministic scoring; no rounding until the final integer index."""
    count = max(0, int(review_count))
    people = max(0, min(int(reviewer_count), count))
    sufficient = count >= MIN_REVIEWS and people >= MIN_REVIEWERS
    shared = {
        "state": "established" if sufficient else "gathering",
        "review_count": count,
        "reviewer_count": people,
        "minimum_reviews": MIN_REVIEWS,
        "minimum_reviewers": MIN_REVIEWERS,
        "max_per_reviewer": MAX_REVIEWS_PER_REVIEWER,
        "score": None,
        "level": "평가 축적 중",
    }
    if not sufficient:
        return shared
    if weighted_sum is None:
        raise ValueError("Sufficient reviews require a numeric rating sum")
    # Defensive data clamp; DB itself guarantees each criterion is 1..5.
    total = min(Decimal("5") * count, max(Decimal(count), Decimal(str(weighted_sum))))
    adjusted = (total + PRIOR_RATING * PRIOR_WEIGHT) / (Decimal(count) + PRIOR_WEIGHT)
    score = int(((adjusted - Decimal("1")) * Decimal("25")).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    ))
    if score >= 90:
        level = "탁월한 협업 신뢰"
    elif score >= 80:
        level = "높은 협업 신뢰"
    elif score >= 65:
        level = "안정적인 협업"
    else:
        level = "협업 신뢰 관찰 중"
    return {**shared, "score": max(0, min(100, score)), "level": level}


def empty_reputation() -> dict:
    return compute_reputation(0, 0, None)


def reputations_for_experts(expert_ids: list[int]) -> dict[int, dict]:
    """Return snapshots for public active experts only. Batch bound is enforced here."""
    ids = list(dict.fromkeys(int(value) for value in expert_ids))
    if not ids:
        return {}
    if len(ids) > 60 or any(value <= 0 or value > MAX_EXPERT_ID for value in ids):
        raise ValueError("Only 1 to 60 valid PostgreSQL BIGINT expert IDs are permitted")

    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(REPUTATION_SQL, (ids,))
        rows = cursor.fetchall()
        # An unknown/private expert must not be indistinguishable from a public
        # newcomer. Return only actual publicly visible experts.
        cursor.execute(
            """SELECT e.user_id FROM expert e JOIN users u ON u.user_id=e.user_id
               WHERE e.user_id=ANY(%s) AND e.is_public=TRUE AND u.status='active'""",
            (ids,),
        )
        public_ids = {row["user_id"] for row in cursor.fetchall()}
    by_id = {row["expert_id"]: compute_reputation(
        row["review_count"], row["reviewer_count"], row["weighted_sum"]
    ) for row in rows if row["expert_id"] in public_ids}
    return {expert_id: by_id.get(expert_id, empty_reputation()) for expert_id in ids
            if expert_id in public_ids}


def expert_reputation(expert_id: int) -> dict:
    from fastapi import HTTPException

    if expert_id <= 0 or expert_id > MAX_EXPERT_ID:
        raise HTTPException(404, "공개된 전문가를 찾을 수 없습니다")
    found = reputations_for_experts([expert_id])
    if expert_id not in found:
        raise HTTPException(404, "공개된 전문가를 찾을 수 없습니다")
    return found[expert_id]
