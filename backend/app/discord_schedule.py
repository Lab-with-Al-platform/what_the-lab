"""디스코드 일정: /일정 · /일정목록 · 채널 메시지의 [일정 관리] 버튼. (봇 app/discord_gateway.py 가 불러요)

저장은 웹과 같은 함수(save_schedule · edit_schedule · remove_schedule)를 써요.
그래서 기간 규칙 · 끝난 협업 막기 · 상대 알림(종 + 채널 멘션) · 구글 반영이 웹과 똑같아요.

흐름
1. /일정 종류:미팅 (매주반복:예) → 창(제목 · 날짜 · 시각 · 메모) → 채널에 "📅 @상대 ○○ 님이 일정을 추가했어요" + [일정 관리]
2. [일정 관리] → 누른 사람에게만 보이는 창: [수정] [삭제] (반복 일정이면 [이 날짜 이후 모두 삭제])
3. /일정목록 → 나만 보이는 2주 일정 + [관리할 일정 고르기 ▾] → 같은 메시지가 그 일정의 관리 창으로
"""

import asyncio
import re
from datetime import date, time, timedelta

import discord
from discord import app_commands
from fastapi import HTTPException

from app import schedule_notice as notice
from app import workspace_rules as rules
from app.config import FRONTEND_URL
from app.db import get_connection
from app.discord_bot import channel_url
from app.discord_gateway import (
    NOT_COLLAB_CHANNEL,
    DueError,
    due_error_text,
    find_member,
    parse_due,
    user_by_discord,
)
from app.discord_waiting import waiting_text
from app.routers.workspace import edit_schedule, remove_schedule, save_schedule
from app.routers.workspace_tasks import today_kst
from app.task_text import day_text, short_day

KINDS = [("미팅", "meeting"), ("작업 기간", "work"), ("결과물 마감", "due"), ("기타", "etc")]
TIMED = {"meeting", "etc"}  # 시각을 적을 수 있는 종류 (하루짜리일 때)
LIST_DAYS = 14  # /일정목록: 오늘부터 2주
LIST_LIMIT = 25  # 디스코드 드롭다운 최대 개수

DATE_EXAMPLES = "11.5 · 다음 주 목요일 · 3일 뒤"
PERIOD_EXAMPLES = "11.3~11.7 · 11.3~다음 주 금요일"
TIME_EXAMPLES = "14:00 · 14:00~15:30 · 오후 2시~3시 반 · 2pm"

# ---------------------------------------------------------------------------
# 글자 읽기: 날짜(기간) · 시각 (애매하면 받지 않아요. 캘린더에 들어가니까)
# ---------------------------------------------------------------------------


class TimeError(ValueError):
    """시각을 읽지 못했어요"""


# 14:00 · 오후 2시 · 2시 30분 · 2시 반 · 2pm · 2:30pm · pm 2시 (오전/오후 · am/pm 은 앞이나 뒤 어디든)
CLOCK = re.compile(r"(오전|오후|am|pm)?(\d{1,2})(?::(\d{2})|(시)(?:(\d{1,2})분|(반))?)?(am|pm)?")
MERIDIEM = {"오전": "오전", "오후": "오후", "am": "오전", "pm": "오후"}

def parse_period(text: str, today: date) -> tuple[date, date]:
    """날짜 글자 → (시작일, 끝일). "11.5" → 하루, "11.3~11.7" → 기간. 비었거나 못 읽으면 DueError"""
    parts = [part for part in re.split(r"~", text) if part.strip()]
    if not parts or len(parts) > 2:
        raise DueError(text)
    start = parse_due(parts[0], today)
    end = parse_due(parts[1], today) if len(parts) == 2 else start
    if start is None or end is None:
        raise DueError(text)
    return start, end


def parse_clock(text: str) -> tuple[time | None, time | None]:
    """시각 글자 → (시작, 끝). 비우면 (None, None).

    받는 모양: 14:00 · 9:30 · 14시 · 2시 30분 · 오후 2시 · 오후 2시 반 · 14:00~15:30 · 오후 2시~3시
              2pm · 2:30 PM · 2 p.m. · PM 2시 · 10am~11:30am (영어 am/pm 도, 대소문자 상관없이)
    끝 시각에 오전/오후가 없으면 시작과 같은 쪽으로 봐요 (오후 2시~3시 → 14:00~15:00).
    "2"처럼 숫자만 있으면 오전인지 오후인지 몰라서 받지 않아요 → TimeError
    """
    compact = re.sub(r"\s+", "", text).lower().replace("a.m.", "am").replace("p.m.", "pm")
    if not compact:
        return None, None
    parts = compact.split("~")
    if len(parts) > 2 or not all(parts):
        raise TimeError(text)
    start, meridiem = read_clock(parts[0], None)
    end = read_clock(parts[1], meridiem)[0] if len(parts) == 2 else None
    return start, end


def read_clock(piece: str, inherit: str | None) -> tuple[time, str | None]:
    """시각 하나 → (time, 오전/오후 표시). inherit: 끝 시각에 오전/오후가 없을 때 시작 쪽을 따라가요"""
    match = CLOCK.fullmatch(piece)
    if not match:
        raise TimeError(piece)
    before, hour, colon_minute, korean_hour, korean_minute, half, after = match.groups()
    if before and after:  # "오후 2pm" 처럼 두 번
        raise TimeError(piece)
    said = MERIDIEM.get(before or after or "")
    if not (said or inherit or colon_minute or korean_hour):  # "2" 숫자만 → 오전인지 오후인지 몰라요 (끝 시각은 시작을 따라가요)
        raise TimeError(piece)
    hour = int(hour)
    minute = int(colon_minute or korean_minute or (30 if half else 0))
    if said and not 1 <= hour <= 12:  # "오후 14시" · "0am" 은 받지 않아요
        raise TimeError(piece)
    meridiem = said or inherit
    if meridiem == "오후" and hour < 12:
        hour += 12
    elif meridiem == "오전" and hour == 12:
        hour = 0
    if hour > 23 or minute > 59:
        raise TimeError(piece)
    return time(hour, minute), meridiem


def clock_text(start: time | None, end: time | None) -> str:
    """수정 창에 미리 채울 시각: "14:00~15:30" / "14:00" / "" """
    if not start:
        return ""
    return f"{start:%H:%M}~{end:%H:%M}" if end else f"{start:%H:%M}"


def period_text(start: date, end: date) -> str:
    """수정 창에 미리 채울 날짜: "11.5" / "11.3~11.12" """
    return short_day(start) if start == end else f"{short_day(start)}~{short_day(end)}"


# ---------------------------------------------------------------------------
# DB: 일정 한 개 · 2주 목록 (디스코드 없이 테스트할 수 있게 밖으로)
# ---------------------------------------------------------------------------


def schedule_card(schedule_id: int) -> dict | None:
    """[일정 관리] 창에 쓸 일정 + 협업 상태 · 두 사람. 지워졌으면 None"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT s.schedule_id, s.collaboration_id, s.kind, s.title, s.start_date, s.end_date,
                   s.start_time, s.end_time, s.place, s.memo, s.assignee, s.series_id,
                   c.status AS collab_status, c.end_date AS collab_end, rs.user_id AS researcher_id, c.expert_id
            FROM collaboration_schedule s
            JOIN collaboration c ON c.collaboration_id = s.collaboration_id
            JOIN research rs ON rs.research_id = c.research_id
            WHERE s.schedule_id = %s
            """,
            (schedule_id,),
        )
        return cursor.fetchone()


def upcoming_schedules(collaboration_id: int, today: date) -> list[dict]:
    """/일정목록: 오늘부터 2주 안에 있는 일정 (이미 시작해서 진행 중인 여러 날 일정도). 날짜 · 시각 순"""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT schedule_id, kind, title, start_date, end_date, start_time, end_time, series_id, discord_message_id
            FROM collaboration_schedule
            WHERE collaboration_id = %s AND end_date >= %s AND start_date < %s
            ORDER BY start_date, start_time NULLS FIRST, schedule_id
            LIMIT %s
            """,
            (collaboration_id, today, today + timedelta(days=LIST_DAYS), LIST_LIMIT),
        )
        return cursor.fetchall()


# ---------------------------------------------------------------------------
# 글자: 관리 창 · 목록 · 드롭다운
# ---------------------------------------------------------------------------


def schedule_panel(card: dict, user_id: int) -> tuple[str, list[str]]:
    """[일정 관리]를 누른 사람에게 보여 줄 (안내 글, 버튼). 버튼: edit · edit_series · delete · delete_series"""
    head = f"**{card['title']}** · {notice.KIND_NAMES.get(card['kind'], '기타')}\n{notice.when_text(card)}"
    if card.get("memo"):
        head += f"\n📝 {card['memo']}"
    if user_id not in (card["researcher_id"], card["expert_id"]):
        return f"{head}\n\n이 협업 사람만 쓸 수 있어요.", []
    if card["collab_status"] != "ongoing":
        return f"{head}\n\n끝난 협업이라 바꿀 수 없어요.", []
    if card.get("series_id"):
        return (
            f"{head}\n\n매주 반복 일정이에요. 이 날짜 하나만 또는 이 날짜 이후 모두를 고치거나 지울 수 있어요.",
            ["edit", "edit_series", "delete", "delete_series"],
        )
    return f"{head}\n\n일정을 고치거나 지울 수 있어요. 바꾸면 상대에게 알려요.", ["edit", "delete"]

def list_text(rows: list[dict], today: date, web_link: str, channel_link: str | None = None) -> str:
    """/일정목록 글: 한 줄에 일정 하나 (날짜 · 시각 · 제목 · 종류). 채널 메시지가 있으면 제목을 누르면 그 메시지로 이동"""
    end = today + timedelta(days=LIST_DAYS - 1)
    lines = [f"📅 **다가오는 일정 (2주)** · {day_text(today)} ~ {day_text(end)}", ""]
    if not rows:
        lines.append("2주 안에 잡힌 일정이 없어요. `/일정`으로 추가해 보세요.")
    for row in rows:
        when = notice.when_text(row)
        if row["start_date"] <= today <= row["end_date"]:
            when = f"오늘 · {when}"
        repeat = " 🔁" if row.get("series_id") else ""
        title = row["title"].replace("[", "(").replace("]", ")")  # 링크 글자가 깨지지 않게
        if channel_link and row.get("discord_message_id"):
            title = f"[{title}]({channel_link}/{row['discord_message_id']})"
        lines.append(f"· {when} · **{title}** · {notice.KIND_NAMES.get(row['kind'], '기타')}{repeat}")
    lines += ["", f"웹에서 보기: {web_link}"]
    if rows:
        lines.append("제목을 누르면 그 메시지로 이동해요. 수정 · 삭제는 아래에서 일정을 고르세요.")
    return "\n".join(lines)


def schedule_options(rows: list[dict]) -> list[discord.SelectOption]:
    """드롭다운 항목 (최대 25개). 드롭다운에는 굵은 글씨가 안 보여서 글자만"""
    return [
        discord.SelectOption(
            label=row["title"][:95],
            value=str(row["schedule_id"]),
            description=f"{notice.when_text(row)} · {notice.KIND_NAMES.get(row['kind'], '기타')}"[:100],
        )
        for row in rows[:LIST_LIMIT]
    ]


def list_message(back: dict) -> tuple[str, list[discord.SelectOption]]:
    """목록 글 + 드롭다운 항목 (DB를 읽어서 asyncio.to_thread 로). back: collaboration_id · user_id · channel_id"""
    today = today_kst()
    rows = upcoming_schedules(back["collaboration_id"], today)
    link = channel_url(str(back["channel_id"])) if back.get("channel_id") else None
    text = list_text(rows, today, f"{FRONTEND_URL}/workspace/{back['collaboration_id']}", link)
    return text, schedule_options(rows)


async def list_view(back: dict) -> tuple[str, discord.ui.View | None]:
    """목록 글 + [관리할 일정 고르기 ▾]. 창(View)은 봇의 이벤트 루프 안(여기)에서 만들어야 눌러져요"""
    text, options = await asyncio.to_thread(list_message, back)
    return text, (ScheduleListView(options, back) if options else None)


# ---------------------------------------------------------------------------
# 디스코드 창: [일정 관리] 버튼 · 관리 창 · 삭제 확인 · 목록 · 입력 창
# ---------------------------------------------------------------------------


class ScheduleButton(discord.ui.DynamicItem[discord.ui.Button], template=r"schedule:manage:(?P<schedule_id>\d+)"):
    """채널 일정 메시지의 [일정 관리]. 버튼 id(schedule:manage:12)만 보고 어떤 일정인지 알아요. 봇을 다시 켜도 동작해요.

    이 버튼은 웹 서버도 채널에 올려요 (app/schedule_notice.py 의 manage_components).
    """

    def __init__(self, schedule_id: int) -> None:
        super().__init__(
            discord.ui.Button(
                label="일정 관리", style=discord.ButtonStyle.secondary, custom_id=f"schedule:manage:{schedule_id}"
            )
        )
        self.schedule_id = schedule_id

    @classmethod
    async def from_custom_id(cls, interaction: discord.Interaction, item: discord.ui.Button, match: re.Match[str]):
        return cls(int(match["schedule_id"]))

    async def callback(self, interaction: discord.Interaction) -> None:
        await open_panel(interaction, self.schedule_id, back=None, edit=False)


async def open_panel(interaction: discord.Interaction, schedule_id: int, back: dict | None, edit: bool) -> None:
    """관리 창 열기. edit=True 면 지금 메시지(목록)를 관리 창으로 바꾸고, False 면 나만 보이는 새 메시지로"""
    user_id = await asyncio.to_thread(user_by_discord, interaction.user.id)
    card = await asyncio.to_thread(schedule_card, schedule_id)
    if user_id is None or card is None:
        text, view = "지워졌거나 찾을 수 없는 일정이에요.", back_view(back)
    else:
        text, actions = schedule_panel(card, user_id)
        view = SchedulePanelView(schedule_id, user_id, actions, back)
    if edit:
        await interaction.response.edit_message(content=text, view=view)
    else:
        await interaction.response.send_message(text, view=view, ephemeral=True)


PANEL_BUTTONS = {
    "edit": ("수정", discord.ButtonStyle.primary),
    "edit_series": ("이 날짜 이후 모두 수정", discord.ButtonStyle.primary),
    "delete": ("삭제", discord.ButtonStyle.danger),
    "delete_series": ("이 날짜 이후 모두 삭제", discord.ButtonStyle.danger),
}


class SchedulePanelView(discord.ui.View):
    """관리 창 버튼. back: /일정목록에서 열었으면 {collaboration_id, user_id} → [← 목록으로]"""

    def __init__(self, schedule_id: int, user_id: int, actions: list[str], back: dict | None = None) -> None:
        super().__init__(timeout=600)  # 10분 지나면 꺼져요 ([일정 관리]를 다시 누르면 돼요)
        self.schedule_id = schedule_id
        self.user_id = user_id
        self.back = back
        for action in actions:
            label, style = PANEL_BUTTONS[action]
            button = discord.ui.Button(label=label, style=style)
            button.callback = self.make_callback(action)
            self.add_item(button)
        if back:
            self.add_item(BackButton(back))

    def make_callback(self, action: str):
        async def callback(interaction: discord.Interaction) -> None:
            if action in ("edit", "edit_series"):
                card = await asyncio.to_thread(schedule_card, self.schedule_id)
                if card is None:
                    await interaction.response.edit_message(content="지워진 일정이에요.", view=back_view(self.back))
                    return
                modal = ScheduleModal(
                    card["kind"], self.user_id, card=card, back=self.back, series=action == "edit_series"
                )
                await interaction.response.send_modal(modal)
                return
            series = action == "delete_series"
            question = "**이 날짜와 그 뒤의 반복 일정을 모두 지울까요?**" if series else "**이 일정을 지울까요?**"
            await interaction.response.edit_message(
                content=f"{question} 상대에게도 알려요.",
                view=ConfirmDeleteView(self.schedule_id, self.user_id, series, self.back),
            )

        return callback


class ConfirmDeleteView(discord.ui.View):
    """삭제 확인: [네, 지울게요] [아니요]"""

    def __init__(self, schedule_id: int, user_id: int, series: bool, back: dict | None) -> None:
        super().__init__(timeout=600)
        self.schedule_id = schedule_id
        self.user_id = user_id
        self.series = series
        self.back = back

    @discord.ui.button(label="네, 지울게요", style=discord.ButtonStyle.danger)
    async def yes(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        try:
            sent = await asyncio.to_thread(remove_schedule, self.user_id, self.schedule_id, self.series)
        except HTTPException as error:
            await interaction.response.edit_message(content=f"⚠️ {error.detail}", view=back_view(self.back))
            return
        await interaction.response.edit_message(content="🗑 일정을 지웠어요. 상대에게 알렸어요.", view=back_view(self.back))
        await asyncio.to_thread(notice.announce, sent)  # 채널에 상대 멘션 (웹에서 지울 때와 같은 한 줄)

    @discord.ui.button(label="아니요", style=discord.ButtonStyle.secondary)
    async def no(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await open_panel(interaction, self.schedule_id, self.back, edit=True)


class ScheduleListView(discord.ui.View):
    """/일정목록 아래 [관리할 일정 고르기 ▾]. 고르면 이 메시지가 그 일정의 관리 창으로 바뀌어요"""

    def __init__(self, options: list[discord.SelectOption], back: dict) -> None:
        super().__init__(timeout=600)
        self.back = back
        picker = discord.ui.Select(placeholder="관리할 일정 고르기", options=options, min_values=1, max_values=1)
        picker.callback = self.picked
        self.picker = picker
        self.add_item(picker)

    async def picked(self, interaction: discord.Interaction) -> None:
        await open_panel(interaction, int(self.picker.values[0]), self.back, edit=True)


class BackButton(discord.ui.Button):
    """[← 목록으로]: 이 메시지를 다시 /일정목록으로 (지금 상태로 새로 읽어요)"""

    def __init__(self, back: dict) -> None:
        super().__init__(label="← 목록으로", style=discord.ButtonStyle.secondary)
        self.back = back

    async def callback(self, interaction: discord.Interaction) -> None:
        text, view = await list_view(self.back)
        await interaction.response.edit_message(content=text, view=view)


def back_view(back: dict | None) -> discord.ui.View | None:
    """결과 아래 [← 목록으로]. 목록에서 연 게 아니면 None"""
    if not back:
        return None
    view = discord.ui.View(timeout=600)
    view.add_item(BackButton(back))
    return view


class ScheduleModal(discord.ui.Modal):
    """/일정 추가 창 · [수정] 창. 칸은 종류에 따라: 제목 · 날짜(작업 기간은 기간) · 시각(미팅 · 기타만) · 메모

    card: 수정이면 지금 일정(schedule_card) → 칸을 미리 채워요. 종류 · 장소 · 담당은 그대로 둬요
    member: 추가면 find_member 결과 (collaboration_id · user_id)
    series: 반복 일정의 [이 날짜 이후 모두 수정] → 이 날짜와 그 뒤 반복 일정을 모두 같은 내용으로
    """

    def __init__(
        self,
        kind: str,
        user_id: int,
        *,
        card: dict | None = None,
        member: dict | None = None,
        repeat: bool = False,
        back: dict | None = None,
        series: bool = False,
    ) -> None:
        name = {value: label for label, value in KINDS}.get(kind, "기타")
        action = "반복 일정 모두 수정" if series else "수정" if card else "추가"
        super().__init__(title=f"{action} · {name}" if series else f"일정 {action} · {name}")
        self.kind, self.user_id, self.card, self.member, self.repeat, self.back = kind, user_id, card, member, repeat, back
        self.series = series
        
        self.title_box = discord.ui.TextInput(label="제목", max_length=rules.MAX_TITLE, placeholder="예: 주간 미팅")
        many = kind == "work"
        self.when_box = discord.ui.TextInput(
            label="기간 (시작~끝)" if many else "날짜",
            max_length=40,
            placeholder=f"예: {PERIOD_EXAMPLES if many else DATE_EXAMPLES}",
        )
        self.clock_box = discord.ui.TextInput(
            label="시각 (선택 · 비우면 시각 없이)", required=False, max_length=20, placeholder=f"예: {TIME_EXAMPLES}"[:100]
        )
        self.memo_box = discord.ui.TextInput(
            label="메모 (선택)",
            style=discord.TextStyle.paragraph,
            required=False,
            max_length=rules.MAX_MEMO,
            placeholder="준비할 것, 회의 링크 등",
        )
        if card:
            self.title_box.default = card["title"]
            self.when_box.default = period_text(card["start_date"], card["end_date"])
            self.clock_box.default = clock_text(card["start_time"], card["end_time"])
            self.memo_box.default = card.get("memo") or ""
        self.add_item(self.title_box)
        self.add_item(self.when_box)
        if kind in TIMED:
            self.add_item(self.clock_box)
        self.add_item(self.memo_box)

    def body(self, today: date) -> rules.ScheduleInput:
        """입력 → 웹과 같은 ScheduleInput. 날짜 · 시각을 못 읽으면 DueError · TimeError"""
        start, end = parse_period(self.when_box.value, today)
        begin, finish = parse_clock(self.clock_box.value) if self.kind in TIMED else (None, None)
        return rules.ScheduleInput(
            kind=self.kind,
            title=self.title_box.value,
            start_date=start,
            end_date=end,
            start_time=begin,
            end_time=finish,
            memo=self.memo_box.value,
            place=(self.card or {}).get("place") or "",
            assignee=(self.card or {}).get("assignee"),
            repeat_weekly=self.repeat and not self.card,
        )

    async def on_submit(self, interaction: discord.Interaction) -> None:
        today = today_kst()
        retry = f"\n쓰신 제목: `{self.title_box.value}`"
        try:
            body = self.body(today)
            if self.card:
                sent = await asyncio.to_thread(edit_schedule, self.user_id, self.card["schedule_id"], body, self.series)
            else:
                sent = await asyncio.to_thread(save_schedule, self.user_id, self.member["collaboration_id"], body)
        except DueError as error:
            example = PERIOD_EXAMPLES if self.kind == "work" else DATE_EXAMPLES
            past = getattr(error, "day", None)
            hint = f"지난 일정을 넣으려면 {past.year}.{past.month}.{past.day} 처럼 연도까지 적어 주세요" if past else ""
            first = due_error_text(self.when_box.value, error, hint)
            await self.reply(interaction, f"{first} 이렇게 적어 주세요: {example}{retry}" if not past else f"{first}{retry}")
            return
        except TimeError:
            await self.reply(interaction, f'⚠️ "{self.clock_box.value}" 을(를) 시각으로 읽지 못했어요. 이렇게 적어 주세요: {TIME_EXAMPLES}{retry}')
            return
        except HTTPException as error:  # 웹과 같은 규칙 (협업 기간 밖 · 끝 시각이 앞 · 끝난 협업 등)
            await self.reply(interaction, f"⚠️ {error.detail}. 저장하지 않았어요.{retry}")
            return

        if self.card and sent is None:
            await self.reply(interaction, "바뀐 게 없어요.")
            return
        done = "✏️ 일정을 고쳤어요" if self.card else "✅ 일정을 추가했어요"
        await self.reply(interaction, f"{done} · {sent['note']}\n상대에게 알렸어요.")
        # 채널에 상대 멘션 + [일정 관리] (웹에서 바꿀 때와 같은 한 줄). 제목 · 메모만 바뀐 건 종에만
        await asyncio.to_thread(notice.announce, sent)

    async def reply(self, interaction: discord.Interaction, text: str) -> None:
        """수정 창(관리 창에서 열었음)이면 그 메시지를 고치고, /일정 이면 나만 보이는 새 메시지로"""
        if self.card:
            await interaction.response.edit_message(content=text, view=back_view(self.back))
        else:
            await interaction.response.send_message(text, ephemeral=True)


# ---------------------------------------------------------------------------
# 명령어
# ---------------------------------------------------------------------------


def add_schedule_commands(tree: app_commands.CommandTree, guild: discord.Object) -> None:
    @tree.command(name="일정", description="협업 일정을 추가해요 (두 사람이 같이 봐요 · 상대에게 알려요)", guild=guild)
    @app_commands.rename(kind="종류", repeat="매주반복")
    @app_commands.describe(kind="어떤 일정인가요", repeat="매주 같은 요일에 반복 (하루짜리 미팅 · 협업 종료일까지)")
    @app_commands.choices(kind=[app_commands.Choice(name=label, value=value) for label, value in KINDS])
    async def schedule_command(
        interaction: discord.Interaction, kind: app_commands.Choice[str], repeat: bool = False
    ) -> None:
        member = await asyncio.to_thread(find_member, interaction.channel_id, interaction.user.id)
        if member is None:
            await interaction.response.send_message(NOT_COLLAB_CHANNEL, ephemeral=True)
            return

        locked = waiting_text(member, today_kst())  # 시작 전 · 끝난 협업은 입력 창을 열지 않아요
        if locked:
            await interaction.response.send_message(locked, ephemeral=True)
            return
        await interaction.response.send_modal(
            ScheduleModal(kind.value, member["user_id"], member=member, repeat=repeat and kind.value == "meeting")
        )

    @tree.command(name="일정목록", description="이 협업의 2주 일정 보기 · 수정 · 삭제 (나에게만 보여요)", guild=guild)
    async def schedule_list_command(interaction: discord.Interaction) -> None:
        member = await asyncio.to_thread(find_member, interaction.channel_id, interaction.user.id)
        if member is None:
            await interaction.response.send_message(NOT_COLLAB_CHANNEL, ephemeral=True)
            return
        back = {
            "collaboration_id": member["collaboration_id"],
            "user_id": member["user_id"],
            "channel_id": interaction.channel_id,
        }
        text, view = await list_view(back)
        kwargs = {"view": view} if view else {}
        await interaction.response.send_message(
            text, ephemeral=True, suppress_embeds=True, allowed_mentions=discord.AllowedMentions.none(), **kwargs
        )