"""디스코드: 시작 전 협업. 채널 메시지의 시작일 미루기 [수락] [다시 얘기해요] 버튼과, 시작 전 명령어 안내.

버튼은 웹 서버가 채널에 올려요 (app/collab_waiting.py 의 postpone_components, id = start:accept:번호 · start:decline:번호).
저장은 웹과 같은 함수(answer_postpone)를 써요. 규칙은 한 곳에만 있어요.
"""

import asyncio
import logging
import re
from datetime import date

import discord
from fastapi import HTTPException

from app import collab_waiting as waiting
from app.task_text import day_text

log = logging.getLogger("labbridge.discord_waiting")


def waiting_text(member: dict, today: date) -> str | None:
    """시작 전 협업 채널에서 /요청 · /일정 을 쓰면 보여 줄 안내 (시작했으면 None)

    member: app/discord_gateway.py 의 find_member 결과 (status · start_date)
    """
    if member.get("status") == "ongoing" and member.get("start_date") and today < member["start_date"]:
        return (
            f"⏳ 협업이 **{day_text(member['start_date'])}**에 시작돼요. 그 전에는 요청 · 일정을 쓸 수 없어요.\n"
            "이 채널에서 대화로 준비해 주세요. (시작일 미루기 · 협업 취소는 웹 협업 상세에서 할 수 있어요)"
        )
    if member.get("status") not in (None, "ongoing"):
        return "끝난 협업이라 요청 · 일정을 쓸 수 없어요."
    return None


def user_id_of(discord_id: int) -> int | None:
    from app.discord_gateway import user_by_discord  # 서로 불러오지 않게 여기서

    return user_by_discord(discord_id)


class DeclineModal(discord.ui.Modal):
    """[다시 얘기해요]: 한 줄 이유 (선택)"""

    def __init__(self, change_id: int, user_id: int) -> None:
        super().__init__(title="시작일 미루기 · 다시 얘기해요")
        self.change_id = change_id
        self.user_id = user_id
        self.note_box = discord.ui.TextInput(
            label="한 줄 이유 (선택)", required=False, max_length=waiting.MAX_ANSWER_NOTE, style=discord.TextStyle.short
        )
        self.add_item(self.note_box)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await answer(interaction, self.change_id, self.user_id, False, self.note_box.value or "")


async def answer(interaction: discord.Interaction, change_id: int, user_id: int, accept: bool, note: str = "") -> None:
    """웹과 같은 저장 함수로 답하고, 채널에 결과를 올려요. 원래 메시지의 버튼은 지워요."""
    try:
        notice = await asyncio.to_thread(
            waiting.answer_postpone, user_id, change_id, accept, waiting.AnswerInput(note=note), "discord"
        )
    except HTTPException as error:  # 요청한 사람이 누름 · 이미 답함 · 기한 지남 · 이미 시작함
        await interaction.response.send_message(f"⚠️ {error.detail}", ephemeral=True)
        return
    done = "✅ 수락했어요" if accept else "💬 다시 얘기하자고 했어요"
    await interaction.response.send_message(done, ephemeral=True)
    if interaction.message is not None:
        try:
            await interaction.message.edit(content=f"{interaction.message.content}\n→ {done}", view=None)
        except discord.HTTPException as error:
            log.warning("시작일 미루기 메시지를 못 고쳤어요: %s", error)
    await asyncio.to_thread(waiting.after_postpone, notice)


class StartChangeButton(
    discord.ui.DynamicItem[discord.ui.Button], template=r"start:(?P<action>accept|decline):(?P<change_id>\d+)"
):
    """채널의 시작일 미루기 메시지 [수락] [다시 얘기해요]. 봇을 다시 켜도 동작해요."""

    def __init__(self, change_id: int, action: str) -> None:
        accept = action == "accept"
        super().__init__(
            discord.ui.Button(
                label="수락" if accept else "다시 얘기해요",
                style=discord.ButtonStyle.success if accept else discord.ButtonStyle.secondary,
                custom_id=f"start:{action}:{change_id}",
            )
        )
        self.change_id = change_id
        self.action = action

    @classmethod
    async def from_custom_id(cls, interaction: discord.Interaction, item: discord.ui.Button, match: re.Match[str]):
        return cls(int(match["change_id"]), match["action"])

    async def callback(self, interaction: discord.Interaction) -> None:
        user_id = await asyncio.to_thread(user_id_of, interaction.user.id)
        if user_id is None:
            await interaction.response.send_message("LabBridge 회원만 답할 수 있어요.", ephemeral=True)
            return
        if self.action == "decline":
            await interaction.response.send_modal(DeclineModal(self.change_id, user_id))
            return
        await answer(interaction, self.change_id, user_id, True)