"""회원 저장소.

TODO: DB가 생기면 이 파일의 함수 안쪽만 DB 코드로 바꿉니다.
지금은 서버 메모리에 저장해서, 서버를 껐다 켜면 회원이 모두 사라집니다.
"""
import uuid

_users_by_id: dict[str, dict] = {}
_user_id_by_discord: dict[str, str] = {}


def find_by_discord_id(discord_id: str) -> dict | None:
    """디스코드 번호로 회원을 찾습니다. 없으면 None (= 처음 온 사람)."""
    user_id = _user_id_by_discord.get(discord_id)
    return _users_by_id.get(user_id) if user_id else None


def find_by_id(user_id: str) -> dict | None:
    """우리 user_id로 회원을 찾습니다."""
    return _users_by_id.get(user_id)


def create_user(discord_user: dict) -> dict:
    """디스코드 정보로 새 회원을 만듭니다. (= 가입 시작)"""
    user = {
        "user_id": str(uuid.uuid4()),
        "discord_id": discord_user["id"],
        "nickname": discord_user["username"],  # TODO: 닉네임 중복 확인
        "avatar": discord_user.get("avatar"),
        "role": None,  # 회원 유형 선택 전
        "signup_step": "role",
    }
    _users_by_id[user["user_id"]] = user
    _user_id_by_discord[user["discord_id"]] = user["user_id"]
    return user