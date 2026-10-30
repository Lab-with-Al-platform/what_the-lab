"""LabBridge 디스코드 봇 (계속 켜 두는 프로그램): 협업 채널에서 /요청 명령어와 [요청 관리] 버튼을 받아요.

실행: backend 폴더에서  uv run python -m app.discord_gateway
- 웹 서버(uvicorn)와 따로 켜요. 터미널 하나 더 열어서 실행해요
- 디스코드에 계속 연결해서 명령어를 기다려요 (공개 주소 HTTPS 가 없어도 돼요)
- 저장은 웹과 같은 함수(create_task · close_task · change_due · reopen_task)를 써요.
  기한 규칙 · 끝난 협업 막기 · 누가 누를 수 있나가 웹과 똑같아요

흐름
1. /요청 → 창(요청 내용 + 기한) → 봇이 채널에 요청 메시지를 올려요. 메시지에는 [요청 관리] 버튼 하나
2. [요청 관리] → 누른 사람에게만 보이는 창: 받은 사람 [완료] / 보낸 사람 [기한 변경] [요청 취소]
   끝난 요청이면 끝낸 사람에게 [되돌리기] (완료 → 받은 사람, 취소 → 보낸 사람)
3. 실제로 바뀌었을 때만 채널 메시지를 고쳐요 (잘못 눌렀으면 그냥 닫으면 돼요)
4. 바뀌면 구글 캘린더에도 반영하고(app/task_sync.py), 완료되면 보낸 사람을 불러 한 줄 남겨요

app/discord_bot.py 는 필요할 때만 HTTP 로 부르는 쪽(채널 만들기·DM), 이 파일은 명령어를 듣는 쪽이에요.
"""

import asyncio
import logging
import re
from datetime import date, timedelta

import discord
from discord import app_commands
from fastapi import HTTPException

from app import workspace_rules as rules
from app.config import DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
from app.db import get_connection
from app.routers.workspace_tasks import change_due, close_task, create_task, reopen_task, today_kst
from app.task_sync import save_message_id, sync_google_by_id, task_card
from app.task_text import WEEKDAYS, day_text, done_line, due_line, short_day, task_message

log = logging.getLogger("labbridge.discord")

NOT_COLLAB_CHANNEL = "협업 채널(협업-N)에서만 쓸 수 있어요."
# 사람 멘션만 허용 (@everyone · 역할 멘션은 막기)
MENTION_USERS = discord.AllowedMentions(users=True, everyone=False, roles=False)


# ---------------------------------------------------------------------------
# DB: 채널·회원 찾기, 메시지에 쓸 요청 정보 (디스코드 없이도 테스트할 수 있게 밖으로 빼 둠)
# ---------------------------------------------------------------------------


def find_member(channel_id: int, discord_id: int) -> dict | None:
    """이 채널의 협업(번호 · 종료일) + 명령을 친 회원. 협업 채널이 아니거나 그 협업 사람이 아니면 None.

    channel_id: 명령을 친 디스코드 채널 번호 (collaboration.discord_channel_id)
    discord_id: 명령을 친 사람의 디스코드 번호 (users.discord_id)
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.collaboration_id, c.end_date, u.user_id
            FROM collaboration c
            JOIN research rs ON rs.research_id = c.research_id
            JOIN users u ON u.discord_id = %s
            WHERE c.discord_channel_id = %s AND u.user_id IN (rs.user_id, c.expert_id)
            """,
            (str(discord_id), str(channel_id)),
        )
        return cursor.fetchone()


def user_by_discord(discord_id: int) -> int | None:
    """디스코드 번호 → LabBridge 회원 번호. 회원이 아니면 None."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT user_id FROM users WHERE discord_id = %s", (str(discord_id),))
        row = cursor.fetchone()
        return row["user_id"] if row else None


# ---------------------------------------------------------------------------
# 기한 읽기: 디스코드 창에 적은 글자 → 정확한 날짜 (캘린더에 들어가야 하니 애매하면 받지 않아요)
# ---------------------------------------------------------------------------

DUE_EXAMPLES = "11.10 · 11월 10일 · 내일 · 3일 뒤 · 다음 주 월요일"
NUMBER_DATE = re.compile(r"(?:(\d{4})[.\-/])?(\d{1,2})[.\-/](\d{1,2})\.?")  # 11.10 / 2026-11-10
KOREAN_DATE = re.compile(r"(?:(\d{4})년)?(\d{1,2})월(\d{1,2})일?")  # 11월 10일 / 2026년 11월 10일
DAY_ONLY = re.compile(r"(\d{1,2})일")  # 10일
AFTER = re.compile(r"(\d{1,3})(일|주)(?:뒤|후)")  # 3일 뒤 / 2주 후
WEEK_DAY = re.compile(r"(이번주|다음주|다다음주)([월화수목금토일])(?:요일)?")  # 다음 주 월요일
WORDS = {"오늘": 0, "내일": 1, "모레": 2}
WEEKS = {"이번주": 0, "다음주": 1, "다다음주": 2}


class DueError(ValueError):
    """기한을 날짜로 읽지 못했어요 (형식이 다르거나, 달력에 없는 날)"""


def parse_due(text: str, today: date) -> date | None:
    """디스코드 창에 적은 기한 → 날짜. 비어 있으면 None (기한 없는 요청).

    받는 모양 (오늘이 2026-10-30 금요일일 때)
      11.10 · 11/10 · 11-10 · 2026-11-10 · 2026.11.10   → 2026-11-10
      11월 10일 · 2026년 11월 10일                         → 2026-11-10
      10일 (이번 달 10일, 지났으면 다음 달)                → 2026-11-10
      오늘 · 내일 · 모레                                   → 10-30 · 10-31 · 11-01
      3일 뒤 · 2주 후                                      → 11-02 · 11-13
      이번 주 금요일 · 다음 주 월요일                      → 10-30 · 11-02
    연도를 안 쓰면 올해 (이미 지났으면 내년).
    받지 않는 것: "금요일"(이번/다음 없이), "1110"(구분 없이 숫자만), 없는 날(2.30) → DueError
    범위(오늘 ~ 협업 종료일)는 여기서 보지 않아요. 저장할 때 웹과 같은 check_due 가 봐요.
    """
    compact = re.sub(r"\s+", "", text)  # 띄어쓰기는 무시 ("다음 주 월요일" = "다음주월요일")
    if not compact:
        return None
    try:
        if compact in WORDS:
            return today + timedelta(days=WORDS[compact])
        if match := AFTER.fullmatch(compact):
            count, unit = int(match[1]), match[2]
            return today + timedelta(days=count * (7 if unit == "주" else 1))
        if match := WEEK_DAY.fullmatch(compact):
            monday = today - timedelta(days=today.weekday())
            return monday + timedelta(weeks=WEEKS[match[1]], days=WEEKDAYS.index(match[2]))
        if match := NUMBER_DATE.fullmatch(compact) or KOREAN_DATE.fullmatch(compact):
            year, month, day = match.groups()
            return with_year(year, int(month), int(day), today)
        if match := DAY_ONLY.fullmatch(compact):
            day = int(match[1])
            month, year = (today.month, today.year) if day >= today.day else next_month(today)
            return date(year, month, day)
    except ValueError as error:  # date() 가 없는 날(2.30 · 11.31)이라고 할 때
        raise DueError(text) from error
    raise DueError(text)


def with_year(year: str | None, month: int, day: int, today: date) -> date:
    """연도를 썼으면 그대로, 안 썼으면 올해 (이미 지난 날짜면 내년)"""
    if year:
        return date(int(year), month, day)
    due = date(today.year, month, day)
    return due if due >= today else date(today.year + 1, month, day)


def next_month(today: date) -> tuple[int, int]:
    """다음 달 (월, 연도). 12월이면 내년 1월"""
    return (1, today.year + 1) if today.month == 12 else (today.month + 1, today.year)


# ---------------------------------------------------------------------------
# 관리 창 (글자 함수는 app/task_text.py, 요청 정보는 app/task_sync.py 의 task_card)
# ---------------------------------------------------------------------------


def panel(task: dict, user_id: int) -> tuple[str, list[str]]:
    """[요청 관리]를 누른 사람에게 보여 줄 (안내 글, 버튼 목록).

    버튼: done(완료) · due(기한 변경) · cancel(요청 취소) · reopen(되돌리기)
    누가 무엇을 할 수 있는지는 저장할 때(close_task 등) 한 번 더 확인해요.
    """
    head = f"**{task['content']}**\n{task['requested_by_nickname']} → {task['assignee_nickname']} · {day_text(task['due_date'])}"
    if task["collab_status"] != "ongoing":
        return f"{head}\n\n끝난 협업이라 바꿀 수 없어요.", []
    sender, receiver = user_id == task["requested_by"], user_id == task["assignee"]
    if task["status"] == "open":
        if receiver:
            return f"{head}\n\n받은 요청이에요. 다 했으면 **완료**를 눌러 주세요.", ["done"]
        if sender:
            return f"{head}\n\n보낸 요청이에요. 기한을 바꾸거나 요청을 취소할 수 있어요.", [
                "due",
                "cancel",
            ]
    elif task["status"] == "done" and receiver:
        return f"{head}\n\n완료한 요청이에요. 잘못 눌렀다면 되돌릴 수 있어요.", ["reopen"]
    elif task["status"] == "canceled" and sender:
        return f"{head}\n\n취소한 요청이에요. 잘못 눌렀다면 되돌릴 수 있어요.", ["reopen"]
    if not (sender or receiver):
        return f"{head}\n\n이 협업 사람만 쓸 수 있어요.", []
    return f"{head}\n\n지금은 할 수 있는 게 없어요.", []


# ---------------------------------------------------------------------------
# 디스코드: 채널 메시지 고치기 · [요청 관리] 버튼 · 관리 창 · 입력 창 · /요청 · 봇
# ---------------------------------------------------------------------------


async def refresh_message(client: discord.Client, task_id: int) -> dict:
    """요청 상태가 바뀐 뒤 채널의 요청 메시지를 지금 상태로 고쳐요. 바뀐 요청 정보를 돌려줘요.

    메시지를 못 고쳐도(지워졌거나 예전 방식 메시지) 저장은 이미 끝났으니 기록만 남기고 넘어가요.
    """
    task = await asyncio.to_thread(task_card, task_id)
    if task["discord_message_id"] and task["discord_channel_id"]:
        channel = client.get_partial_messageable(int(task["discord_channel_id"]))
        try:
            await channel.get_partial_message(int(task["discord_message_id"])).edit(
                content=task_message(task), view=manage_view(task_id)
            )
        except discord.HTTPException as error:
            log.warning("요청 %s 메시지를 못 고쳤어요: %s", task_id, error)
    return task


class ManageButton(
    discord.ui.DynamicItem[discord.ui.Button], template=r"task:(?P<action>[a-z_]+):(?P<task_id>\d+)"
):
    """채널 요청 메시지의 [요청 관리]. id(task:manage:12)만 보고 어떤 요청인지 알아요.

    봇을 껐다 켜도 동작해요. 예전 메시지의 버튼(task:done:12 · task:cancel:12)도 관리 창을 열어요.
    """

    def __init__(self, task_id: int, action: str = "manage") -> None:
        super().__init__(
            discord.ui.Button(
                label="요청 관리",
                style=discord.ButtonStyle.secondary,
                custom_id=f"task:{action}:{task_id}",
            )
        )
        self.task_id = task_id

    @classmethod
    async def from_custom_id(
        cls, interaction: discord.Interaction, item: discord.ui.Button, match: re.Match[str]
    ):
        return cls(int(match["task_id"]), match["action"])

    async def callback(self, interaction: discord.Interaction) -> None:
        user_id = await asyncio.to_thread(user_by_discord, interaction.user.id)
        task = await asyncio.to_thread(task_card, self.task_id)
        if user_id is None or task is None:
            await interaction.response.send_message("요청을 찾을 수 없어요.", ephemeral=True)
            return
        text, actions = panel(task, user_id)
        await interaction.response.send_message(
            text, view=PanelView(self.task_id, user_id, actions), ephemeral=True
        )


def manage_view(task_id: int) -> discord.ui.View:
    """채널 요청 메시지에 붙는 버튼: [요청 관리] 하나"""
    view = discord.ui.View(timeout=None)  # 시간이 지나도 버튼이 꺼지지 않게
    view.add_item(ManageButton(task_id))
    return view


PANEL_BUTTONS = {
    "done": ("완료", discord.ButtonStyle.success),
    "due": ("기한 변경", discord.ButtonStyle.primary),
    "cancel": ("요청 취소", discord.ButtonStyle.danger),
    "reopen": ("되돌리기", discord.ButtonStyle.secondary),
}


class PanelView(discord.ui.View):
    """[요청 관리]를 누른 사람에게만 보이는 창의 버튼들. 잘못 열었으면 그냥 닫으면 돼요."""

    def __init__(self, task_id: int, user_id: int, actions: list[str]) -> None:
        # 10분 지나면 이 창의 버튼은 꺼져요 ([요청 관리]를 다시 누르면 돼요)
        super().__init__(timeout=600)
        self.task_id = task_id
        self.user_id = user_id
        for action in actions:
            label, style = PANEL_BUTTONS[action]
            button = discord.ui.Button(label=label, style=style)
            button.callback = self.make_callback(action)
            self.add_item(button)

    def make_callback(self, action: str):
        async def callback(interaction: discord.Interaction) -> None:
            if action == "due":
                task = await asyncio.to_thread(task_card, self.task_id)
                await interaction.response.send_modal(DueModal(task, self.user_id, today_kst()))
            elif action == "cancel":  # 한 번 더 물어요 (이 창 안에서만, 채널 메시지는 그대로)
                await interaction.response.edit_message(
                    content="**정말 이 요청을 취소할까요?** 취소해도 나중에 되돌릴 수 있어요.",
                    view=ConfirmCancelView(self.task_id, self.user_id),
                )
            elif action == "done":
                await run_and_refresh(interaction, close_task, self.user_id, self.task_id, "done")
            elif action == "reopen":
                await run_and_refresh(interaction, reopen_task, self.user_id, self.task_id)

        return callback


class ConfirmCancelView(discord.ui.View):
    """요청 취소 확인: [네, 취소할게요] [아니요]. 이 창도 나에게만 보여요."""

    def __init__(self, task_id: int, user_id: int) -> None:
        super().__init__(timeout=600)
        self.task_id = task_id
        self.user_id = user_id

    @discord.ui.button(label="네, 취소할게요", style=discord.ButtonStyle.danger)
    async def yes(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await run_and_refresh(interaction, close_task, self.user_id, self.task_id, "canceled")

    @discord.ui.button(label="아니요", style=discord.ButtonStyle.secondary)
    async def no(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        task = await asyncio.to_thread(task_card, self.task_id)
        text, actions = panel(task, self.user_id)
        await interaction.response.edit_message(
            content=text, view=PanelView(self.task_id, self.user_id, actions)
        )


DONE_TEXT = {
    "done": "✅ 완료했어요. 보낸 사람에게 보여요.",
    "canceled": "🚫 요청을 취소했어요.",
    "open": "↩️ 되돌렸어요. 다시 진행 중이에요.",
}


async def run_and_refresh(interaction: discord.Interaction, action, *args) -> None:
    """저장(웹과 같은 함수) → 채널 메시지 고치기 → 내 창에 결과. 안 되면 내 창에 이유만 보여요."""
    try:
        await asyncio.to_thread(action, *args)
    except HTTPException as error:
        await interaction.response.edit_message(content=f"⚠️ {error.detail}", view=None)
        return
    task = await refresh_message(interaction.client, args[1])
    await interaction.response.edit_message(content=DONE_TEXT[task["status"]], view=None)
    await asyncio.to_thread(sync_google_by_id, args[1])
    # 완료는 메시지를 고치기만 하면 알림이 안 가서, 보낸 사람을 불러 한 줄 남겨요
    if task["status"] == "done":
        await interaction.channel.send(done_line(task), allowed_mentions=MENTION_USERS)


def due_help(today: date, end: date) -> str:
    return f"이렇게 적어 주세요: {DUE_EXAMPLES}\n(오늘 {short_day(today)} ~ 협업 종료일 {short_day(end)} 사이 · 비우면 기한 없음)"


class DueModal(discord.ui.Modal, title="기한 변경"):
    """보낸 사람의 [기한 변경] 창. 지금 기한을 미리 채워 두고, 비우면 기한 없음."""

    due = discord.ui.TextInput(label="새 기한", required=False, max_length=20)

    def __init__(self, task: dict, user_id: int, today: date) -> None:
        super().__init__()
        self.task = task  # task_card 결과
        self.user_id = user_id
        self.due.placeholder = f"예: {DUE_EXAMPLES} · 비우면 기한 없음"[:100]
        self.due.default = short_day(task["due_date"])

    async def on_submit(self, interaction: discord.Interaction) -> None:
        today = today_kst()
        task_id = self.task["task_id"]
        try:
            due = parse_due(self.due.value, today)
            result = await asyncio.to_thread(change_due, self.user_id, task_id, due)
        except DueError:
            await interaction.response.edit_message(
                content=f'⚠️ "{self.due.value}" 을(를) 날짜로 읽지 못했어요. 기한은 그대로예요.\n'
                + due_help(today, self.task["end_date"]),
                view=None,
            )
            return
        except HTTPException as error:
            await interaction.response.edit_message(content=f"⚠️ {error.detail}", view=None)
            return

        task = await refresh_message(interaction.client, task_id)
        if result["old_due"] == due:
            await interaction.response.edit_message(content="기한이 그대로예요.", view=None)
            return
        await interaction.response.edit_message(
            content=f"📅 기한을 **{day_text(due)}** 로 바꿨어요.", view=None
        )
        await asyncio.to_thread(sync_google_by_id, task_id)
        # 채널 메시지를 고치기만 하면 알림이 안 가서, 받은 사람을 불러 한 줄 남겨요
        await interaction.channel.send(
            due_line(task, result["old_due"]), allowed_mentions=MENTION_USERS
        )


class TaskModal(discord.ui.Modal, title="요청 남기기"):
    """/요청 을 치면 뜨는 창: 요청 내용(필수) + 기한(선택, 비우면 기한 없음)"""

    content = discord.ui.TextInput(
        label="요청 내용",
        style=discord.TextStyle.paragraph,
        placeholder="예: 1차 모델 결과를 정확도·F1 표로 정리해 주세요",
        max_length=rules.MAX_TASK,
    )
    due = discord.ui.TextInput(
        label="기한 (선택 · 비우면 기한 없음)", required=False, max_length=20
    )

    def __init__(self, member: dict) -> None:
        super().__init__()
        self.member = member  # find_member 결과 (collaboration_id, end_date, user_id)
        self.due.placeholder = f"예: {DUE_EXAMPLES}"

    async def on_submit(self, interaction: discord.Interaction) -> None:
        today = today_kst()
        retry = f"\n쓰신 내용 (복사해서 다시 쓰세요):\n```{self.content.value}```"
        try:
            due = parse_due(self.due.value, today)
            body = rules.TaskInput(content=self.content.value, due_date=due)
            task_id = await asyncio.to_thread(
                create_task,
                self.member["user_id"],
                self.member["collaboration_id"],
                body,
                "discord",
            )
        except DueError:
            await interaction.response.send_message(
                f'⚠️ "{self.due.value}" 을(를) 날짜로 읽지 못했어요. 요청은 저장하지 않았어요.\n'
                + due_help(today, self.member["end_date"])
                + retry,
                ephemeral=True,
            )
            return
        except HTTPException as error:  # 웹과 같은 규칙에 걸렸을 때 (기한 범위 · 끝난 협업 등)
            await interaction.response.send_message(
                f"⚠️ {error.detail}. 요청은 저장하지 않았어요.{retry}", ephemeral=True
            )
            return

        await interaction.response.send_message(
            f"✅ 요청을 남겼어요 · {'기한 ' + day_text(due) if due else '기한 없음'}",
            ephemeral=True,
        )
        task = await asyncio.to_thread(task_card, task_id)
        # 봇이 채널에 직접 올려요. 나중에 웹·관리 창에서 바뀌면 이 메시지를 고쳐요
        message = await interaction.channel.send(
            task_message(task), view=manage_view(task_id), allowed_mentions=MENTION_USERS
        )
        await asyncio.to_thread(save_message_id, task_id, message.id)
        await asyncio.to_thread(sync_google_by_id, task_id)


class LabBridgeBot(discord.Client):
    def __init__(self) -> None:
        # 명령어·버튼만 받으니 기본 권한(intents)이면 충분해요. 메시지 읽기 같은 특별 권한은 안 켜요
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)
        self.guild = discord.Object(id=int(DISCORD_GUILD_ID))

    async def setup_hook(self) -> None:
        """켜질 때 LabBridge 서버에 명령어를 등록해요 (서버 하나에만 등록하면 바로 보여요)"""
        add_commands(self.tree, self.guild)
        self.add_dynamic_items(ManageButton)  # 예전 메시지의 버튼도 받게 (봇을 다시 켜도)
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