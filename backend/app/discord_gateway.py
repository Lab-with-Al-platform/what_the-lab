"""LabBridge 디스코드 봇 (계속 켜 두는 프로그램): 협업 채널에서 /요청 명령어를 받아요.

실행: backend 폴더에서  uv run python -m app.discord_gateway
- 웹 서버(uvicorn)와 따로 켜요. 터미널 하나 더 열어서 실행해요
- 디스코드에 계속 연결해서 명령어를 기다려요 (공개 주소 HTTPS 가 없어도 돼요)
- 저장은 웹과 같은 함수(create_task)를 써요. 기한 규칙·끝난 협업 막기가 웹과 똑같아요

app/discord_bot.py 는 필요할 때만 HTTP 로 부르는 쪽(채널 만들기·DM), 이 파일은 명령어를 듣는 쪽이에요.
"""

import asyncio
import logging
import re
from datetime import date

import discord
from discord import app_commands
from fastapi import HTTPException

from app import workspace_rules as rules
from app.config import DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
from app.db import get_connection
from app.routers.workspace_tasks import create_task, today_kst

log = logging.getLogger("labbridge.discord")

NOT_COLLAB_CHANNEL = "협업 채널(협업-N)에서만 쓸 수 있어요."


# ---------------------------------------------------------------------------
# DB: 채널·회원 찾기, 메시지에 쓸 요청 정보 (디스코드 없이도 테스트할 수 있게 밖으로 빼 둠)
# ---------------------------------------------------------------------------


def find_member(channel_id: int, discord_id: int) -> dict | None:
    """이 채널의 협업 + 명령을 친 회원. 협업 채널이 아니거나 그 협업 사람이 아니면 None.

    channel_id: 명령을 친 디스코드 채널 번호 (collaboration.discord_channel_id)
    discord_id: 명령을 친 사람의 디스코드 번호 (users.discord_id)
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.collaboration_id, u.user_id
            FROM collaboration c
            JOIN research rs ON rs.research_id = c.research_id
            JOIN users u ON u.discord_id = %s
            WHERE c.discord_channel_id = %s AND u.user_id IN (rs.user_id, c.expert_id)
            """,
            (str(discord_id), str(channel_id)),
        )
        return cursor.fetchone()


def task_card(task_id: int) -> dict:
    """채널 메시지에 쓸 요청 정보: 내용 · 보낸 사람 · 받은 사람(디스코드 번호까지) · 기한"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT t.task_id, t.content, t.due_date, t.status,
                   rq.nickname AS requested_by_nickname,
                   asg.nickname AS assignee_nickname, asg.discord_id AS assignee_discord_id
            FROM collaboration_task t
            JOIN users rq ON rq.user_id = t.requested_by
            JOIN users asg ON asg.user_id = t.assignee
            WHERE t.task_id = %s
            """,
            (task_id,),
        )
        return cursor.fetchone()


def save_message_id(task_id: int, message_id: int) -> None:
    """채널에 올린 메시지 번호를 저장해요. ([완료]를 누르면 이 메시지를 찾아 고쳐요 — 다음 단계)"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE collaboration_task SET discord_message_id = %s WHERE task_id = %s",
            (str(message_id), task_id),
        )


# ---------------------------------------------------------------------------
# 글자 다루기: 기한 읽기, 메시지 만들기
# ---------------------------------------------------------------------------

DUE_PATTERN = re.compile(r"^(?:(\d{4})[.\-/])?(\d{1,2})[.\-/](\d{1,2})\.?$")


def parse_due(text: str, today: date) -> date | None:
    """디스코드 창에 적은 기한 → 날짜. 비어 있으면 None.

    받는 모양: 11.10 / 11/10 / 11-10 / 2026-11-10 / 2026.11.10
    연도를 안 쓰면 올해. 그 날짜가 이미 지났으면 내년으로 봐요 (12월에 1.5 라고 쓴 경우)
    알아볼 수 없으면 ValueError (사용자에게 다시 쓰라고 안내해요)
    """
    text = text.strip().replace(" ", "")
    if not text:
        return None
    match = DUE_PATTERN.match(text)
    if not match:
        raise ValueError(text)
    year, month, day = match.groups()
    if year:
        return date(int(year), int(month), int(day))
    due = date(today.year, int(month), int(day))
    return due if due >= today else date(today.year + 1, int(month), int(day))


def due_label(due: date | None, today: date) -> str:
    """기한 → "11.10 (D-11)" / "오늘까지" / "기한 없음" """
    if due is None:
        return "기한 없음"
    left = (due - today).days
    return f"{due.month}.{due.day} " + ("(오늘까지)" if left == 0 else f"(D-{left})")


def task_message(task: dict, today: date) -> str:
    """채널에 올라갈 요청 안내. 받은 사람은 멘션(@)해서 알림이 가게 해요."""
    return (
        f"📌 **요청** · {task['requested_by_nickname']} → <@{task['assignee_discord_id']}> · {due_label(task['due_date'], today)}\n"
        f">>> {task['content']}"
    )


# ---------------------------------------------------------------------------
# 디스코드: 봇 · /요청 명령어 · 입력 창
# ---------------------------------------------------------------------------


class TaskModal(discord.ui.Modal, title="요청 남기기"):
    """/요청 을 치면 뜨는 창: 내용(필수) + 기한(선택)"""

    content = discord.ui.TextInput(
        label="요청 내용",
        style=discord.TextStyle.paragraph,
        placeholder="예: 1차 모델 결과를 정확도·F1 표로 정리해 주세요",
        max_length=rules.MAX_TASK,
    )
    due = discord.ui.TextInput(
        label="기한 (선택)", placeholder="11.10 또는 2026-11-10", required=False, max_length=10
    )

    def __init__(self, member: dict) -> None:
        super().__init__()
        self.member = member  # find_member 결과 (collaboration_id, user_id)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        today = today_kst()
        try:
            body = rules.TaskInput(
                content=self.content.value, due_date=parse_due(self.due.value, today)
            )
            task_id = await asyncio.to_thread(
                create_task,
                self.member["user_id"],
                self.member["collaboration_id"],
                body,
                "discord",
            )
        except ValueError:  # 기한을 알아볼 수 없을 때 (pydantic 오류도 여기로)
            await interaction.response.send_message(
                "기한은 `11.10` 이나 `2026-11-10` 처럼 적어 주세요.", ephemeral=True
            )
            return
        except HTTPException as error:  # 웹과 같은 규칙에 걸렸을 때 (기한 범위 · 끝난 협업 등)
            await interaction.response.send_message(str(error.detail), ephemeral=True)
            return

        task = await asyncio.to_thread(task_card, task_id)
        await interaction.response.send_message(
            task_message(task, today), allowed_mentions=discord.AllowedMentions(users=True)
        )
        message = await interaction.original_response()
        await asyncio.to_thread(save_message_id, task_id, message.id)


class LabBridgeBot(discord.Client):
    def __init__(self) -> None:
        # 명령어만 받으니 기본 권한(intents)이면 충분해요. 메시지 읽기 같은 특별 권한은 안 켜요
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)
        self.guild = discord.Object(id=int(DISCORD_GUILD_ID))

    async def setup_hook(self) -> None:
        """켜질 때 LabBridge 서버에 명령어를 등록해요 (서버 하나에만 등록하면 바로 보여요)"""
        add_commands(self.tree, self.guild)
        synced = await self.tree.sync(guild=self.guild)
        log.info("명령어 등록: %s", [command.name for command in synced])

    async def on_ready(self) -> None:
        log.info("디스코드 봇 켜짐: %s", self.user)


def add_commands(tree: app_commands.CommandTree, guild: discord.Object) -> None:
    @tree.command(name="요청", description="상대에게 요청을 남겨요 (협업 채널에서)", guild=guild)
    async def request_command(interaction: discord.Interaction) -> None:
        member = await asyncio.to_thread(find_member, interaction.channel_id, interaction.user.id)
        if member is None:
            await interaction.response.send_message(NOT_COLLAB_CHANNEL, ephemeral=True)
            return
        await interaction.response.send_modal(TaskModal(member))


def main() -> None:
    if not (DISCORD_BOT_TOKEN and DISCORD_GUILD_ID):
        raise SystemExit(
            ".env 에 DISCORD_BOT_TOKEN 과 DISCORD_GUILD_ID 가 있어야 봇을 켤 수 있어요."
        )
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    LabBridgeBot().run(DISCORD_BOT_TOKEN, log_handler=None)


if __name__ == "__main__":
    main()