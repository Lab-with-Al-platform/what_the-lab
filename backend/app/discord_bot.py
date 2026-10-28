"""LabBridge 디스코드 봇으로 디스코드 API를 부릅니다. (서버에 넣기 · DM 보내기 · 협업 채널 만들기)

봇을 계속 켜 두지 않고, 필요할 때만 봇 토큰으로 HTTP 요청을 보내요.
봇 토큰(DISCORD_BOT_TOKEN)과 서버 ID(DISCORD_GUILD_ID)가 없으면 아무것도 하지 않아요.
"""

import httpx

from app.config import (
    DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID,
    DISCORD_COLLAB_CATEGORY_ID,
    DISCORD_GUILD_ID,
)

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

    

# ---------- 협업 전용 비공개 채널 ----------
# 디스코드 권한은 숫자 비트로 적어요. (https://discord.com/developers/docs/topics/permissions)
VIEW_CHANNEL = 1 << 10  # 채널 보기
SEND_MESSAGES = 1 << 11  # 메시지 보내기
EMBED_LINKS = 1 << 14  # 링크 미리보기
ATTACH_FILES = 1 << 15  # 파일 올리기
READ_HISTORY = 1 << 16  # 지난 메시지 보기
ADD_REACTIONS = 1 << 6  # 이모지 반응
MEMBER_ALLOW = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_HISTORY | ADD_REACTIONS
BOT_ALLOW = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | READ_HISTORY


def channel_name(collaboration_id: int) -> str:
    """협업 채널 이름: 협업-12 (연구 제목은 넣지 않아요. 제목은 채널 주제에 넣어요)"""
    return f"협업-{collaboration_id}"


def channel_url(channel_id: str) -> str:
    """채널 바로가기 링크. 누르면 디스코드 앱·웹에서 그 채널이 열려요."""
    return f"https://discord.com/channels/{DISCORD_GUILD_ID}/{channel_id}"

def create_private_channel(name: str, topic: str) -> str:
    """비공개 채널을 만들고 번호를 돌려줘요. 처음에는 봇만 보여요. (사람은 add_member 로 넣어요)

    name: 채널 이름 (협업-12) / topic: 채널 주제 (연구 제목. 채널 멤버만 볼 수 있어요)
    @everyone(서버의 모든 사람)은 보기를 막고, 봇만 허용해요. 디스코드가 안 되면 httpx.HTTPError.
    """
    body = {
        "name": name,
        "type": 0,  # 0 = 글 채널
        "topic": topic[:1024],
        "permission_overwrites": [
            {"id": DISCORD_GUILD_ID, "type": 0, "deny": str(VIEW_CHANNEL), "allow": "0"},  # @everyone 의 번호 = 서버 번호
            {"id": DISCORD_CLIENT_ID, "type": 1, "allow": str(BOT_ALLOW), "deny": "0"},  # 봇 번호 = 앱 번호
        ],
    }
    if DISCORD_COLLAB_CATEGORY_ID:
        body["parent_id"] = DISCORD_COLLAB_CATEGORY_ID
    response = httpx.post(
        f"{DISCORD_API}/guilds/{DISCORD_GUILD_ID}/channels", headers=bot_headers(), json=body, timeout=TIMEOUT
    )
    response.raise_for_status()
    return response.json()["id"]


def add_member(channel_id: str, discord_id: str) -> bool:
    """회원 한 명에게 채널을 보여 줘요. 넣었으면 True, 서버 멤버가 아니라서 못 넣으면 False.

    채널 권한에 이 사람만 '보기·쓰기 허용'을 붙여요. 디스코드가 안 되면 httpx.HTTPError.
    """
    response = httpx.put(
        f"{DISCORD_API}/channels/{channel_id}/permissions/{discord_id}",
        headers=bot_headers(),
        json={"type": 1, "allow": str(MEMBER_ALLOW), "deny": "0"},  # 1 = 회원 한 명
        timeout=TIMEOUT,
    )
    if response.status_code in (400, 404):  # 서버에 없는 사람 (Unknown Member)
        return False
    response.raise_for_status()
    return True