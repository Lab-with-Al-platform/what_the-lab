"""LabBridge 디스코드 봇으로 디스코드 API를 부릅니다. (서버에 넣기 · DM 보내기)

봇을 계속 켜 두지 않고, 필요할 때만 봇 토큰으로 HTTP 요청을 보내요.
봇 토큰(DISCORD_BOT_TOKEN)과 서버 ID(DISCORD_GUILD_ID)가 없으면 아무것도 하지 않아요.
"""

import httpx

from app.config import DISCORD_BOT_TOKEN, DISCORD_GUILD_ID

DISCORD_API = "https://discord.com/api/v10"
TIMEOUT = 5  # 초. 디스코드가 느려도 우리 서버가 오래 멈추지 않게


def bot_ready() -> bool:
    """봇 설정이 다 있는지 (없으면 디스코드 기능을 건너뛰어요)"""
    return bool(DISCORD_BOT_TOKEN and DISCORD_GUILD_ID)


def bot_headers() -> dict:
    return {"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}


def join_guild(discord_id: str, user_access_token: str) -> bool:
    """회원을 LabBridge 서버에 넣어요. 들어갔거나 이미 있으면 True.

    discord_id: 회원의 디스코드 번호 (users.discord_id)
    user_access_token: 로그인 때 받은 회원의 디스코드 토큰 (guilds.join 허락이 들어 있어야 해요)
    201 = 새로 들어감, 204 = 이미 멤버. 그 밖(허락 안 함·봇 권한 없음 등)은 False.
    """
    if not bot_ready():
        return False
    response = httpx.put(
        f"{DISCORD_API}/guilds/{DISCORD_GUILD_ID}/members/{discord_id}",
        headers=bot_headers(),
        json={"access_token": user_access_token},
        timeout=TIMEOUT,
    )
    return response.status_code in (201, 204)



class DmBlocked(Exception):
    """이 회원에게는 DM을 보낼 수 없어요. (DM을 막아 뒀거나 LabBridge 서버를 나감) 다시 시도해도 같아요."""


def send_dm(discord_id: str, content: str) -> None:
    """회원에게 봇 1:1 DM을 보내요.

    discord_id: 받는 회원의 디스코드 번호
    content: 보낼 글 (2000자 이하)
    받을 수 없는 사람이면 DmBlocked, 디스코드가 잠깐 안 되면 httpx.HTTPError를 던져요.
    """
    # ① 봇과 이 회원의 DM 방을 열어요. (이미 있으면 그 방을 돌려줘요)
    channel = httpx.post(
        f"{DISCORD_API}/users/@me/channels",
        headers=bot_headers(),
        json={"recipient_id": discord_id},
        timeout=TIMEOUT,
    )
    if channel.status_code in (400, 403):
        raise DmBlocked()
    channel.raise_for_status()

    # ② 그 방에 메시지를 보내요. allowed_mentions: 글 안의 @표시로 다른 사람을 부르지 않게
    message = httpx.post(
        f"{DISCORD_API}/channels/{channel.json()['id']}/messages",
        headers=bot_headers(),
        json={"content": content, "allowed_mentions": {"parse": []}},
        timeout=TIMEOUT,
    )
    if message.status_code == 403:  # 50007: Cannot send messages to this user
        raise DmBlocked()
    message.raise_for_status()