"""협업 전용 디스코드 채널 만들기. 알림 보내기와 같은 차례에 돌아요. (15초마다, 협업 시작 직후엔 바로)

[협업 시작] 때는 collaboration.discord_status 가 'pending'(만들 차례)으로만 남아요.
여기서 채널을 만들고 두 사람에게 보여 준 뒤 'ready' 로 바꿔요. 디스코드가 안 되면 조금 뒤에 다시 해요.
"""

import httpx

from app.db import get_connection
from app.discord_bot import add_member, bot_ready, channel_name, create_private_channel

BATCH = 10  # 한 번에 만들 최대 개수
MAX_ATTEMPTS = 5  # 이만큼 실패하면 멈추고 failed 로 남겨요 (이유는 discord_error)
RETRY_MINUTES = 1  # 실패하면 (시도 횟수 × 1분) 뒤에 다시

PENDING_SQL = """
    SELECT c.collaboration_id, c.discord_attempts, c.agreement ->> 'title' AS title,
           ru.discord_id AS researcher_discord_id, eu.discord_id AS expert_discord_id
    FROM collaboration c
    JOIN research rs ON rs.research_id = c.research_id
    JOIN users ru ON ru.user_id = rs.user_id
    JOIN users eu ON eu.user_id = c.expert_id
    WHERE c.discord_status = 'pending' AND c.status = 'ongoing' AND c.discord_retry_at <= now()
    ORDER BY c.collaboration_id
    LIMIT %s
    FOR UPDATE OF c SKIP LOCKED
"""


def make_pending_channels() -> int:
    """만들 차례인 협업의 채널을 만들어요. 만든 개수를 돌려줘요.

    FOR UPDATE ... SKIP LOCKED: 서버가 여러 개 떠 있어도 같은 협업 채널을 두 번 만들지 않게
    다른 서버가 잡고 있는 줄은 건너뛰어요.
    """
    if not bot_ready():
        return 0
    made = 0
    with get_connection() as conn, conn.transaction(), conn.cursor() as cursor:
        # 채널을 만들기 전에 끝난 협업 (시작 전 취소 등)은 만들지 않아요
        cursor.execute(
            "UPDATE collaboration SET discord_status = 'skipped'"
            " WHERE discord_status = 'pending' AND status <> 'ongoing'"
        )
        cursor.execute(PENDING_SQL, (BATCH,))
        for row in cursor.fetchall():
            attempts = row["discord_attempts"] + 1
            try:
                channel_id, missing = open_channel(row)
            except httpx.HTTPError as error:
                status = "failed" if attempts >= MAX_ATTEMPTS else "pending"
                cursor.execute(
                    "UPDATE collaboration SET discord_status = %s, discord_attempts = %s, discord_error = %s,"
                    " discord_retry_at = now() + make_interval(mins => %s) WHERE collaboration_id = %s",
                    (status, attempts, str(error)[:200], attempts * RETRY_MINUTES, row["collaboration_id"]),
                )
                continue
            cursor.execute(
                "UPDATE collaboration SET discord_status = 'ready', discord_channel_id = %s,"
                " discord_attempts = %s, discord_error = %s WHERE collaboration_id = %s",
                (channel_id, attempts, missing, row["collaboration_id"]),
            )
            made += 1
    return made


def open_channel(row: dict) -> tuple[str, str | None]:
    """채널 하나를 새로 만들고 두 사람에게 보여 줘요.

    돌려주는 값: (채널 번호, 못 넣은 사람 안내 또는 None)
    서버에 없는 사람은 채널에 못 넣어요. 채널은 만들고 이유만 남겨요.
    같은 이름 채널이 있어도 다시 쓰지 않아요. 팀원마다 DB가 달라 협업 번호가 겹치면
    남의 채널에 들어가게 되기 때문이에요. (이름이 같아도 채널은 따로 생겨요)
    """
    name = channel_name(row["collaboration_id"])
    channel_id = create_private_channel(name, row["title"] or "")
    members = (("연구회원", row["researcher_discord_id"]), ("AI 전문가", row["expert_discord_id"]))
    missing = [who for who, discord_id in members if not add_member(channel_id, discord_id)]
    return channel_id, (f"서버 미참가: {', '.join(missing)}" if missing else None)