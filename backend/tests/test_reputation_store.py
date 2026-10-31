"""LAB TRUST v1: deterministic math, strict evidence gate and public access.

No real database or accounts touched. SQL integration is verified separately
against a throwaway PostgreSQL schema in GitHub Actions.
"""
from decimal import Decimal
import inspect

import pytest
from fastapi import HTTPException

from app import reputation_store as trust
from app.routers import reviews


def test_no_rating_is_not_zero_and_cannot_be_displayed_as_score():
    for n, people in [(0, 0), (1, 1), (2, 2), (3, 1)]:
        result = trust.compute_reputation(n, people, Decimal(n) * Decimal("5"))
        assert result["state"] == "gathering"
        assert result["score"] is None
        assert result["level"] == "평가 축적 중"


def test_public_score_requires_three_eligible_reviews_and_two_distinct_researchers():
    result = trust.compute_reputation(3, 2, Decimal("15"))
    assert result["state"] == "established"
    assert result["review_count"] == 3
    assert result["reviewer_count"] == 2
    assert result["score"] == 81
    assert result["level"] == "높은 협업 신뢰"


def test_small_samples_shrink_to_prior_without_creating_fake_reviews():
    result = trust.compute_reputation(3, 3, Decimal("12"))
    # (3*4 + 5*3.8) / (3+5) = 3.875 => 71.875 => 72/100
    assert result["score"] == 72
    assert result["review_count"] == 3


def test_more_sustained_good_reviews_raise_reputation_without_buying():
    score3 = trust.compute_reputation(3, 3, Decimal("15"))
    score10 = trust.compute_reputation(10, 5, Decimal("50"))
    assert score3["score"] < score10["score"]
    assert score10["score"] == 90


@pytest.mark.parametrize("average",[Decimal("1"),Decimal("2"),Decimal("3"),Decimal("4"),Decimal("5")])
def test_index_remains_bounded_and_monotonic(average):
    assert 0 <= trust.compute_reputation(10, 3, average * 10)["score"] <= 100
    first = trust.compute_reputation(10, 3, average * 10)
    improved = trust.compute_reputation(10, 3, min(Decimal("5"), average + 1) * 10)
    assert improved["score"] >= first["score"]


def test_tampered_outlier_is_clamped_defensively():
    assert trust.compute_reputation(3, 2, Decimal("1000"))["score"] == 81
    assert trust.compute_reputation(3, 2, Decimal("-1000"))["score"] >= 0


def test_research_dimensions_are_transparent_and_sum_to_one():
    assert trust.WEIGHTS == {
        "expertise": Decimal("0.30"),
        "communication": Decimal("0.20"),
        "timeliness": Decimal("0.15"),
        "quality": Decimal("0.35"),
    }
    assert sum(trust.WEIGHTS.values()) == 1


def test_query_excludes_early_ended_hidden_pending_and_non_researcher_reviews():
    sql = trust.REPUTATION_SQL
    for exact in [
        "v.reviewer_id=r.user_id",
        "v.reviewer_side='researcher'",
        "v.visibility='visible'",
        "c.status='done'",
        "c.expert_id=v.reviewee_id",
        "c.ended_at <= now() - interval '7 days'",
        "pe.user_id=v.reviewee_id",
        "e.is_public=TRUE",
        "u.status='active'",
        "PARTITION BY v.reviewee_id, v.reviewer_id",
        "reviewer_rank <= 3",
        "COUNT(DISTINCT reviewer_id)",
    ]:
        assert exact in sql, exact


def test_batch_caps_sixty_experts_and_skips_invisible_experts():
    class Cursor:
        def __init__(self):
            self.statement = ""
        def __enter__(self):
            return self
        def __exit__(self, *_):
            return False
        def execute(self, sql, params):
            self.statement = str(sql)
        def fetchall(self):
            if "COUNT(DISTINCT reviewer_id)" in self.statement:
                return [{"expert_id":7, "review_count":3, "reviewer_count":2,
                         "weighted_sum": Decimal("15")}]
            return [{"user_id":7}]
    cursor = Cursor()
    class Connection:
        def __enter__(self):
            return self
        def __exit__(self, *_):
            return False
        def cursor(self):
            return cursor

    original = trust.get_connection
    trust.get_connection = lambda: Connection()
    try:
        assert trust.reputations_for_experts([7, 8, 7]) == {
            7: trust.compute_reputation(3, 2, Decimal("15"))
        }
        with pytest.raises(ValueError):
            trust.reputations_for_experts(list(range(1, 62)))
        with pytest.raises(ValueError):
            trust.reputations_for_experts([0])
        with pytest.raises(HTTPException) as err:
            trust.expert_reputation(8)
        assert err.value.status_code == 404
    finally:
        trust.get_connection = original


@pytest.mark.parametrize("ids", ["1,a", "1,,2", "-1", "0", "1" * 701])
def test_api_rejects_non_id_and_excessive_user_input(ids):
    with pytest.raises(HTTPException) as e:
        reviews.list_public_reputation(ids=ids)
    assert e.value.status_code == 422


def test_api_does_not_allow_updating_a_user_trust_number():
    source = inspect.getsource(reviews)
    assert '@router.get("/reputation")' in source
    assert '@router.get("/experts/{expert_id}/reputation")' in source
    assert '@router.post("/reputation")' not in source
    assert '@router.put("/reputation")' not in source


def test_no_search_rank_benefit_yet():
    from app import expert_search_store
    source = inspect.getsource(expert_search_store.search_experts)
    assert "reputation_store" not in source
    assert "lab_trust" not in source
