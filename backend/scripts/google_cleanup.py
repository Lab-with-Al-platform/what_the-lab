"""구글 캘린더 정리: LabBridge DB에 없는 일정 · 끝난 요청을 협업 구글 캘린더에서 지워요.

언제 써요: DB에서 일정 · 요청을 직접 지웠을 때(로컬 테스트 정리 등), 예전에 완료한 요청(✅)이 구글에 남아 있을 때
구글에는 "앞으로 볼 것"만 둬요. 이 서비스가 넣은 것(lbs 일정 · lbt 요청 · lbc 협업 시작/종료일) 중에서
지우는 것: DB에 없는 일정 · 지난 일정 · 진행 중이 아니거나 기한 없는 요청 · 끝난 협업이나 지난 시작일
안 지우는 것: 사람이 구글에서 직접 만든 일정 (번호가 lbs · lbt · lbc 로 시작하지 않아요)

실행 (backend 폴더에서)
  uv run python -m scripts.google_cleanup         ← 지울 목록만 보여 줘요 (아무것도 안 지워요)
  uv run python -m scripts.google_cleanup --run   ← 실제로 지워요
  --collab 3                                      ← 이 협업 캘린더만
"""

import argparse

import httpx

from app.db import get_connection
from app.google_calendar import (
    CALENDAR_API,
    TIMEOUT,
    delete_event,
    event_id,
    google_ready,
    headers,
    mark_id,
    task_event_id,
)
from app.google_sync import today_kst


def calendars(collaboration_id: int | None) -> list[dict]:
    """구글 캘린더가 있는 협업들"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT collaboration_id, google_calendar_id FROM collaboration"
            " WHERE google_calendar_id IS NOT NULL AND (%s::bigint IS NULL OR collaboration_id = %s)"
            " ORDER BY collaboration_id",
            (collaboration_id, collaboration_id),
        )
        return cursor.fetchall()


def keep_ids(collaboration_id: int) -> set[str]:
    """구글에 남아 있어야 하는 번호: 오늘 이후 일정 + 진행 중이고 기한이 있는 요청 + (진행 중 협업이면) 시작일 · 종료일"""
    today = today_kst()
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "SELECT schedule_id FROM collaboration_schedule WHERE collaboration_id = %s AND end_date >= %s",
            (collaboration_id, today),
        )
        keep = {event_id(row["schedule_id"]) for row in cursor.fetchall()}
        cursor.execute("SELECT status, start_date FROM collaboration WHERE collaboration_id = %s", (collaboration_id,))
        collab = cursor.fetchone()
        if collab["status"] == "ongoing":
            keep.add(mark_id(collaboration_id, "end"))
            if collab["start_date"] >= today:
                keep.add(mark_id(collaboration_id, "start"))
        cursor.execute(
            "SELECT task_id FROM collaboration_task WHERE collaboration_id = %s AND status = 'open' AND due_date IS NOT NULL",
            (collaboration_id,),
        )
        keep |= {task_event_id(row["task_id"]) for row in cursor.fetchall()}
    return keep


def google_events(calendar_id: str) -> list[dict]:
    """구글 캘린더의 일정 전부 (id · 제목). 250개씩 끝까지 읽어요"""
    events, page = [], None
    while True:
        params = {"maxResults": 250, "showDeleted": "false", **({"pageToken": page} if page else {})}
        response = httpx.get(f"{CALENDAR_API}/calendars/{calendar_id}/events", headers=headers(), params=params, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
        events += [{"id": item["id"], "summary": item.get("summary", "")} for item in data.get("items", [])]
        page = data.get("nextPageToken")
        if not page:
            return events


def to_delete(events: list[dict], keep: set[str]) -> list[dict]:
    """이 서비스가 넣은 것(lbs · lbt · lbc) 중 남아 있으면 안 되는 것"""
    return [item for item in events if item["id"].startswith(("lbs", "lbt", "lbc")) and item["id"] not in keep]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run", action="store_true", help="실제로 지워요 (없으면 목록만)")
    parser.add_argument("--collab", type=int, help="이 협업 번호의 캘린더만")
    args = parser.parse_args()
    if not google_ready():
        raise SystemExit(".env 에 GOOGLE_SERVICE_ACCOUNT_FILE 이 없어요. 구글 연동이 켜진 환경에서 실행하세요.")

    total = 0
    for collab in calendars(args.collab):
        stale = to_delete(google_events(collab["google_calendar_id"]), keep_ids(collab["collaboration_id"]))
        print(f"협업-{collab['collaboration_id']}: 지울 일정 {len(stale)}개")
        for item in stale:
            print(f"  - {item['id']}  {item['summary']}")
            if args.run:
                delete_event(collab["google_calendar_id"], item["id"])
        total += len(stale)
    print(f"\n{'지웠어요' if args.run else '지울 예정이에요 (지우려면 --run)'}: {total}개")


if __name__ == "__main__":
    main()