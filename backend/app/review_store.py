"""Verified, completion-gated bilateral reviews. Server authority only.

Policies:
- Only actual participants; status done or ended_early; never canceled/ongoing.
- 30 days to submit after ended_at, one review per side per collaboration.
- One edit within 48 hours, with revision evidence preserved.
- Normal 'done' researcher->expert reviews become public 7 days after completion.
- Ended-early feedback and expert->researcher feedback remain private.
- No research title, agreement, private counterpart identity in public reviews.
"""
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

from app.db import get_connection, transaction
from app.reputation_store import expert_reputation
from app.workspace_store import complete_ended_collaborations

SUBMIT_DAYS = 30
EDIT_HOURS = 48
PUBLISH_DAYS = 7
PUBLIC_LIMIT = 20

PERSON_SQL = """
 SELECT c.collaboration_id,c.status,c.ended_at,c.expert_id, rs.user_id AS researcher_id,
        c.agreement ->> 'title' AS research_title,
        ur.nickname AS researcher_name, ue.nickname AS expert_name
 FROM collaboration c JOIN research rs ON rs.research_id=c.research_id
 JOIN users ur ON ur.user_id=rs.user_id JOIN users ue ON ue.user_id=c.expert_id
 WHERE c.collaboration_id=%s
"""


def side_for(row: dict, user_id: int) -> str:
    if user_id == row["researcher_id"]:
        return "researcher"
    if user_id == row["expert_id"]:
        return "expert"
    raise HTTPException(404, "참여한 협업을 찾을 수 없습니다")


def review_window(row: dict, user_id: int, now: datetime | None = None) -> dict:
    side = side_for(row, user_id)
    now = now or datetime.now(UTC)
    ended = row["ended_at"]
    allowed = row["status"] in ("done", "ended_early") and ended is not None
    until = ended + timedelta(days=SUBMIT_DAYS) if allowed else None
    return {
        "side": side,
        "eligible": bool(allowed and now <= until),
        "submission_deadline": until,
        "status": row["status"],
        "partner": row["expert_name"] if side == "researcher" else row["researcher_name"],
        "research_title": row["research_title"],
        "public_policy": "공개 평점은 정상 완료된 협업에서 연구자가 작성한 평가만 반영합니다.",
    }


def _my_record(cursor, collaboration_id: int, user_id: int):
    cursor.execute(
        "SELECT review_id,collaboration_id,reviewer_side,expertise,communication,timeliness,quality,"
        " comment,visibility,edit_count,created_at,updated_at FROM collaboration_review"
        " WHERE collaboration_id=%s AND reviewer_id=%s",
        (collaboration_id, user_id),
    )
    return cursor.fetchone()


def _participant(cursor, collaboration_id: int, user_id: int, lock: bool = False) -> dict:
    cursor.execute(PERSON_SQL + (" FOR UPDATE OF c" if lock else ""), (collaboration_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, "참여한 협업을 찾을 수 없습니다")
    side_for(row, user_id)
    return row


def review_context(collaboration_id: int, user_id: int) -> dict:
    with transaction() as cursor:
        complete_ended_collaborations(cursor)
        row = _participant(cursor, collaboration_id, user_id)
        window = review_window(row, user_id)
        own = _my_record(cursor, collaboration_id, user_id)
        # Release counterpart feedback only after the same seven-day cool-off.
        received = None
        if row["status"] in ("done", "ended_early") and row["ended_at"] and row["ended_at"] <= datetime.now(UTC) - timedelta(days=PUBLISH_DAYS):
            cursor.execute(
                """
                SELECT review_id,collaboration_id,reviewer_side,expertise,communication,timeliness,quality,
                       comment,created_at
                FROM collaboration_review
                WHERE collaboration_id=%s AND reviewee_id=%s AND visibility='visible'
                """,
                (collaboration_id, user_id),
            )
            received = cursor.fetchone()
    now = datetime.now(UTC)
    can_edit = bool(
        own and own["edit_count"] == 0
        and now <= own["created_at"] + timedelta(hours=EDIT_HOURS)
        and own["visibility"] == "visible"
    )
    return {"collaboration_id": collaboration_id, **window, "my_review": own,
            "received_review": received, "can_edit": can_edit,
            "can_submit": window["eligible"] and own is None}


def eligible_reviews(user_id: int) -> list[dict]:
    with transaction() as cursor:
        complete_ended_collaborations(cursor)
        cursor.execute(
            """
            SELECT c.collaboration_id,c.status,c.ended_at,c.expert_id,rs.user_id AS researcher_id,
                   c.agreement ->> 'title' AS research_title,
                   ur.nickname AS researcher_name,ue.nickname AS expert_name,
                   rev.review_id,rev.created_at AS reviewed_at,rev.visibility
            FROM collaboration c JOIN research rs ON rs.research_id=c.research_id
            JOIN users ur ON ur.user_id=rs.user_id JOIN users ue ON ue.user_id=c.expert_id
            LEFT JOIN collaboration_review rev ON rev.collaboration_id=c.collaboration_id AND rev.reviewer_id=%s
            WHERE (rs.user_id=%s OR c.expert_id=%s)
              AND c.status IN ('done','ended_early')
            ORDER BY c.ended_at DESC,c.collaboration_id DESC
            LIMIT 60
            """,
            (user_id, user_id, user_id),
        )
        rows = cursor.fetchall()
    return [
        {**review_window(row, user_id), "collaboration_id": row["collaboration_id"],
         "submitted": row["review_id"] is not None,
         "review_id": row["review_id"],
         "reviewed_at": row["reviewed_at"],
         "visibility": row["visibility"]}
        for row in rows
    ]


def clean_comment(comment: str) -> str:
    value = comment.strip()
    if len(value) > 500:
        raise HTTPException(422, "후기는 500자 이하로 작성해 주세요.")
    # Deliberately render as text, never inject into HTML.
    return value


def submit_review(user_id: int, collaboration_id: int, values: dict) -> dict:
    with transaction() as cursor:
        complete_ended_collaborations(cursor)
        row = _participant(cursor, collaboration_id, user_id, lock=True)
        window = review_window(row, user_id)
        if not window["eligible"]:
            raise HTTPException(409, "협업 종료 후 30일 이내에만 평가할 수 있습니다.")
        receiver = row["expert_id"] if window["side"] == "researcher" else row["researcher_id"]
        cursor.execute(
            """
            INSERT INTO collaboration_review
              (collaboration_id,reviewer_id,reviewee_id,reviewer_side,
               expertise,communication,timeliness,quality,comment)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (collaboration_id,reviewer_id) DO NOTHING
            RETURNING review_id
            """,
            (collaboration_id,user_id,receiver,window["side"],
             values["expertise"],values["communication"],values["timeliness"],values["quality"],
             clean_comment(values["comment"])),
        )
        inserted = cursor.fetchone()
        if not inserted:
            raise HTTPException(409, "이미 평가를 제출했습니다. 수정 가능 기간을 확인해 주세요.")
    return review_context(collaboration_id, user_id)


def edit_review(user_id: int, collaboration_id: int, values: dict) -> dict:
    with transaction() as cursor:
        row = _participant(cursor, collaboration_id, user_id, lock=True)
        # Once submitted, only review edit policy applies; a project need not still be in the review window.
        existing = _my_record(cursor, collaboration_id, user_id)
        if not existing:
            raise HTTPException(404, "작성한 평가를 찾을 수 없습니다.")
        cursor.execute(
            """
            UPDATE collaboration_review
            SET revision_history = revision_history || jsonb_build_array(jsonb_build_object(
                 'expertise',expertise,'communication',communication,'timeliness',timeliness,
                 'quality',quality,'comment',comment,'edited_at',now())),
                expertise=%s,communication=%s,timeliness=%s,quality=%s,comment=%s,
                edit_count=edit_count+1,updated_at=now()
            WHERE collaboration_id=%s AND reviewer_id=%s
              AND edit_count=0 AND visibility='visible'
              AND created_at >= now() - interval '48 hours'
            RETURNING review_id
            """,
            (values["expertise"],values["communication"],values["timeliness"],values["quality"],
             clean_comment(values["comment"]),collaboration_id,user_id),
        )
        updated = cursor.fetchone()
        if not updated:
            raise HTTPException(409, "평가 수정은 제출 후 48시간 이내에 한 번만 가능합니다.")
    return review_context(collaboration_id, user_id)


def public_expert_reviews(expert_id: int) -> dict:
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM expert e JOIN users u ON u.user_id=e.user_id
            WHERE e.user_id=%s AND e.is_public=TRUE AND u.status='active'
            """, (expert_id,),
        )
        if not cursor.fetchone():
            raise HTTPException(404, "공개된 전문가를 찾을 수 없습니다")
        criteria = """
          v.reviewee_id=%s AND v.reviewer_side='researcher' AND v.visibility='visible'
          AND c.status='done' AND c.ended_at IS NOT NULL
          AND c.ended_at <= now() - interval '7 days'
        """
        cursor.execute(f"""
           SELECT count(*) AS count,
             ROUND(AVG((v.expertise+v.communication+v.timeliness+v.quality)/4.0)::numeric,1) AS average,
             ROUND(AVG(v.expertise)::numeric,1) AS expertise,
             ROUND(AVG(v.communication)::numeric,1) AS communication,
             ROUND(AVG(v.timeliness)::numeric,1) AS timeliness,
             ROUND(AVG(v.quality)::numeric,1) AS quality
           FROM collaboration_review v JOIN collaboration c ON c.collaboration_id=v.collaboration_id
           WHERE {criteria}
        """, (expert_id,))
        summary = cursor.fetchone()
        cursor.execute(f"""
           SELECT v.review_id,v.created_at,v.expertise,v.communication,v.timeliness,v.quality,
                  v.comment,ROUND(((v.expertise+v.communication+v.timeliness+v.quality)/4.0)::numeric,1) AS score
           FROM collaboration_review v JOIN collaboration c ON c.collaboration_id=v.collaboration_id
           WHERE {criteria}
           ORDER BY v.created_at DESC,v.review_id DESC LIMIT {PUBLIC_LIMIT}
        """, (expert_id,))
        results = cursor.fetchall()
    # Avoid leakage of research titles, reviewer identity, project IDs or agreement snapshots.
    return {
        "count": summary["count"],
        "average": summary["average"],
        "reputation": expert_reputation(expert_id),
        "criteria": {key: summary[key] for key in ("expertise","communication","timeliness","quality")},
        "reviews": [{**item, "author": "협업 연구회원"} for item in results],
        "policy": "정상 완료한 협업에서 제출한 검증된 연구자 평가입니다. 종료 후 7일이 지나 공개됩니다.",
    }


REPORT_REASONS = {"abuse","privacy","false_claim","other"}


def report_review(user_id: int, review_id: int, reason: str, description: str) -> dict:
    if reason not in REPORT_REASONS:
        raise HTTPException(422, "올바른 신고 사유를 선택해 주세요.")
    note = description.strip()
    if len(note) > 300:
        raise HTTPException(422, "신고 내용은 300자 이내로 작성해 주세요.")
    with transaction() as cursor:
        cursor.execute(
            """
            SELECT v.reviewer_id FROM collaboration_review v
            JOIN collaboration c ON c.collaboration_id=v.collaboration_id
            LEFT JOIN expert e ON e.user_id=v.reviewee_id
            LEFT JOIN users u ON u.user_id=e.user_id
            WHERE v.review_id=%s AND v.visibility='visible'
              AND c.ended_at <= now()-interval '7 days'
              AND (
                (v.reviewer_side='researcher' AND c.status='done'
                  AND e.is_public=TRUE AND u.status='active')
                OR (v.reviewee_id=%s AND c.status IN ('done','ended_early'))
              )
            """, (review_id,user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(404, "신고할 수 있는 공개 후기를 찾을 수 없습니다.")
        if row["reviewer_id"] == user_id:
            raise HTTPException(400, "본인이 작성한 후기는 신고할 수 없습니다.")
        cursor.execute(
            """INSERT INTO collaboration_review_report (review_id,reporter_id,reason,description)
               VALUES (%s,%s,%s,%s) ON CONFLICT (review_id,reporter_id) DO NOTHING
               RETURNING report_id""",
            (review_id,user_id,reason,note),
        )
        saved = cursor.fetchone()
        if not saved:
            raise HTTPException(409, "이미 신고한 후기입니다.")
    return {"reported": True}


def moderation_queue() -> list[dict]:
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """SELECT rp.report_id,rp.review_id,rp.reason,rp.description,rp.status,rp.created_at,
                      v.comment,v.visibility,v.reviewer_side,v.reviewee_id
               FROM collaboration_review_report rp JOIN collaboration_review v ON v.review_id=rp.review_id
               WHERE rp.status='pending' ORDER BY rp.created_at DESC LIMIT 100"""
        )
        return cursor.fetchall()


def moderate_report(report_id: int, admin_id: int, decision: str, reason: str) -> dict:
    if decision not in {"hide","dismiss","restore"}:
        raise HTTPException(422, "올바른 처리 결정을 선택해 주세요.")
    reason = reason.strip()
    if len(reason) < 5 or len(reason) > 300:
        raise HTTPException(422, "처리 사유는 5~300자로 작성해 주세요.")
    with transaction() as cursor:
        cursor.execute(
            """SELECT rp.report_id,rp.review_id,rp.status FROM collaboration_review_report rp
               WHERE rp.report_id=%s FOR UPDATE""", (report_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(404, "신고를 찾을 수 없습니다.")
        if row["status"] != "pending":
            raise HTTPException(409, "이미 처리한 신고입니다.")
        if decision in ("hide","restore"):
            cursor.execute(
                """UPDATE collaboration_review SET visibility=%s,moderation_reason=%s,
                     moderated_by=%s,moderated_at=now(),updated_at=now()
                   WHERE review_id=%s""",
                ("hidden" if decision=="hide" else "visible",reason,admin_id,row["review_id"]),
            )
        cursor.execute(
            """UPDATE collaboration_review_report SET status=%s,resolved_by=%s,resolved_at=now()
               WHERE report_id=%s""",
            ("actioned" if decision in ("hide","restore") else "dismissed",admin_id,report_id),
        )
    return {"resolved": True, "decision": decision}
