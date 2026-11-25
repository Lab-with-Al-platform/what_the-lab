"""회원 저장소. users 테이블을 읽고 씁니다.

함수 이름과 돌려주는 모양(dict)은 메모리 버전과 같아서, auth.py는 바꿀 필요가 거의 없습니다.
"""
from app.db import get_connection

USER_COLUMNS = "user_id, discord_id, nickname, user_role, signup_step, user_photo, status, is_admin"


def find_by_discord_id(discord_id: str) -> dict | None:
    """디스코드 번호로 회원을 찾습니다. 없으면 None (= 처음 온 사람)."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(f"SELECT {USER_COLUMNS} FROM users WHERE discord_id = %s", (discord_id,))
        return cursor.fetchone()


def find_by_id(user_id: int) -> dict | None:
    """우리 user_id로 회원을 찾습니다."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(f"SELECT {USER_COLUMNS} FROM users WHERE user_id = %s", (user_id,))
        return cursor.fetchone()


def create_user(discord_user: dict) -> dict:
    """디스코드 정보로 새 회원을 만듭니다. (= 가입 시작, signup_step은 기본값 'role')"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            # RETURNING = 방금 만든 줄의 값을 바로 돌려받습니다. (새 회원 번호)
            "INSERT INTO users (discord_id, nickname) VALUES (%s, %s) RETURNING user_id",
            # TODO: 닉네임이 겹치면 UNIQUE 에러가 납니다. 겹칠 때 처리 방법은 팀과 정하기
            (discord_user["id"], discord_user["username"]),
        )
        new_user_id = cursor.fetchone()["user_id"]
    return find_by_id(new_user_id)
