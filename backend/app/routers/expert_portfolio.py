"""AI 전문가 내 이력: 포트폴리오 추가·수정·삭제와 PDF 올리기·보기·지우기."""

import re

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app import upload_store
from app.db import transaction
from app.expert_profile_store import load_profile, require_profile
from app.form_rules import bad_request, required_text, unique_list
from app.routers.expert import MAX_ABLE_WORKS, check_able_works_exist
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1/expert/portfolios", tags=["expert-portfolio"])

MAX_TITLE = 60  # portfolio.title
MAX_ROLE = 200  # portfolio.role
MAX_SKILLS = 10
MAX_SKILL = 30  # portfolio_skill.skill_name
MAX_PDF_MB = 20
MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024


class PortfolioRequest(BaseModel):
    title: str  # 무엇을 만들었나요
    able_work_ids: list[str]  # 이 작업에서 AI로 한 일 (UG ID), 1~3개
    skills: list[str]  # 사용 기술, 0~10개
    role: str  # 내 역할


@router.post("")
def add_portfolio(body: PortfolioRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    """포트폴리오 하나 추가. PDF는 저장 뒤 PUT /{portfolio_id}/pdf 로 따로 올립니다."""
    require_profile(user_id)
    title, role, able_work_ids, skills = clean_portfolio(body)

    with transaction() as cursor:
        check_able_works_exist(cursor, able_work_ids)
        # RETURNING = 방금 만든 포트폴리오 번호를 바로 돌려받습니다.
        cursor.execute(
            "INSERT INTO portfolio (user_id, title, role) VALUES (%s, %s, %s) RETURNING portfolio_id",
            (user_id, title, role),
        )
        insert_children(cursor, cursor.fetchone()["portfolio_id"], able_work_ids, skills)
    return load_profile(user_id)


@router.put("/{portfolio_id}")
def update_portfolio(
    portfolio_id: int, body: PortfolioRequest, user_id: int = Depends(get_current_user_id)
) -> dict:
    """포트폴리오 내용 수정. PDF는 그대로 둡니다."""
    require_profile(user_id)
    title, role, able_work_ids, skills = clean_portfolio(body)

    with transaction() as cursor:
        find_portfolio(cursor, user_id, portfolio_id)
        check_able_works_exist(cursor, able_work_ids)
        cursor.execute(
            "UPDATE portfolio SET title = %s, role = %s WHERE portfolio_id = %s",
            (title, role, portfolio_id),
        )
        # 고른 일·기술은 '지우고 다시 넣기'로 바꿉니다.
        cursor.execute("DELETE FROM portfolio_able_work WHERE portfolio_id = %s", (portfolio_id,))
        cursor.execute("DELETE FROM portfolio_skill WHERE portfolio_id = %s", (portfolio_id,))
        insert_children(cursor, portfolio_id, able_work_ids, skills)
    return load_profile(user_id)


@router.delete("/{portfolio_id}")
def delete_portfolio(portfolio_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    """포트폴리오 삭제. 마지막 하나를 지우면 공개 조건이 깨지므로 공개도 같이 꺼요."""
    require_profile(user_id)
    with transaction() as cursor:
        pdf_key = find_portfolio(cursor, user_id, portfolio_id)["pdf_url"]
        # 고른 일·기술은 FK의 ON DELETE CASCADE로 같이 지워집니다.
        cursor.execute("DELETE FROM portfolio WHERE portfolio_id = %s", (portfolio_id,))
        cursor.execute(
            "SELECT COUNT(*) AS left_count FROM portfolio WHERE user_id = %s", (user_id,)
        )
        if cursor.fetchone()["left_count"] == 0:
            cursor.execute("UPDATE expert SET is_public = FALSE WHERE user_id = %s", (user_id,))
    upload_store.delete_file(pdf_key)  # DB 저장이 끝난 뒤에 파일을 지웁니다.
    return load_profile(user_id)


# ---------- PDF ----------
async def read_pdf_body(request: Request) -> bytes:
    """요청 본문(PDF 파일 그대로)을 읽습니다. 20MB를 넘으면 끝까지 읽지 않고 멈춰요."""
    if not request.headers.get("content-type", "").startswith("application/pdf"):
        raise HTTPException(status_code=415, detail="PDF 파일만 올릴 수 있어요")
    content = bytearray()
    async for chunk in request.stream():
        content += chunk
        if len(content) > MAX_PDF_BYTES:
            raise HTTPException(status_code=413, detail=f"PDF는 {MAX_PDF_MB}MB까지 올릴 수 있어요")
    # 확장자만 바꾼 파일을 막으려고 PDF 파일의 첫 글자(%PDF-)를 확인합니다.
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="PDF 파일만 올릴 수 있어요")
    return bytes(content)


@router.put("/{portfolio_id}/pdf")
def upload_pdf(
    portfolio_id: int,
    user_id: int = Depends(get_current_user_id),
    content: bytes = Depends(read_pdf_body),
) -> dict:
    """PDF 올리기. 이미 있으면 새 파일로 바꿉니다."""
    require_profile(user_id)
    new_key = upload_store.save_pdf(content)
    try:
        with transaction() as cursor:
            old_key = find_portfolio(cursor, user_id, portfolio_id)["pdf_url"]
            cursor.execute(
                "UPDATE portfolio SET pdf_url = %s WHERE portfolio_id = %s", (new_key, portfolio_id)
            )
    except Exception:
        upload_store.delete_file(new_key)  # DB에 못 남겼으면 방금 저장한 파일도 지워요.
        raise
    upload_store.delete_file(old_key)
    return load_profile(user_id)


@router.get("/{portfolio_id}/pdf")
def view_pdf(portfolio_id: int, user_id: int = Depends(get_current_user_id)) -> FileResponse:
    """PDF 보기. 지금은 본인만 볼 수 있어요. (다른 사람에게 보여 주는 건 전문가 찾기에서 정합니다)"""
    with transaction() as cursor:
        portfolio = find_portfolio(cursor, user_id, portfolio_id)
    path = upload_store.path_of(portfolio["pdf_url"]) if portfolio["pdf_url"] else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="올린 PDF가 없어요")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"{safe_file_name(portfolio['title'])}.pdf",  # 내려받을 때 보이는 이름
        content_disposition_type="inline",  # 다운로드 대신 브라우저에서 바로 열기
    )


@router.delete("/{portfolio_id}/pdf")
def delete_pdf(portfolio_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    require_profile(user_id)
    with transaction() as cursor:
        old_key = find_portfolio(cursor, user_id, portfolio_id)["pdf_url"]
        cursor.execute(
            "UPDATE portfolio SET pdf_url = NULL WHERE portfolio_id = %s", (portfolio_id,)
        )
    upload_store.delete_file(old_key)
    return load_profile(user_id)


# ---------- 도우미 ----------
def find_portfolio(cursor, user_id: int, portfolio_id: int) -> dict:
    """내 포트폴리오인지 확인합니다. 남의 것이거나 없으면 똑같이 404 (있는지조차 알려 주지 않아요)."""
    cursor.execute(
        "SELECT portfolio_id, title, pdf_url FROM portfolio WHERE portfolio_id = %s AND user_id = %s",
        (portfolio_id, user_id),
    )
    portfolio = cursor.fetchone()
    if portfolio is None:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없어요")
    return portfolio


def clean_portfolio(body: PortfolioRequest) -> tuple[str, str, list[str], list[str]]:
    title = required_text(body.title, MAX_TITLE, "제목")
    role = required_text(body.role, MAX_ROLE, "내 역할")
    able_work_ids = unique_list(body.able_work_ids, 1, MAX_ABLE_WORKS, "AI로 한 일")
    skills = unique_list([s.strip() for s in body.skills if s.strip()], 0, MAX_SKILLS, "사용 기술")
    if any(len(skill) > MAX_SKILL for skill in skills):
        raise bad_request(f"사용 기술은 하나당 {MAX_SKILL}자 이내로 입력해 주세요")
    return title, role, able_work_ids, skills


def insert_children(cursor, portfolio_id: int, able_work_ids: list[str], skills: list[str]) -> None:
    cursor.executemany(
        "INSERT INTO portfolio_able_work (portfolio_id, able_work_id) VALUES (%s, %s)",
        [(portfolio_id, able_work_id) for able_work_id in able_work_ids],
    )
    if skills:  # 빈 목록이면 넣을 게 없어서 건너뜁니다.
        cursor.executemany(
            "INSERT INTO portfolio_skill (portfolio_id, skill_name) VALUES (%s, %s)",
            [(portfolio_id, skill) for skill in skills],
        )


def safe_file_name(title: str) -> str:
    """파일 이름에 쓸 수 없는 글자( / \\ : * ? \" < > | )를 _로 바꿉니다."""
    return re.sub(r'[\\/:*?"<>|\r\n]', "_", title).strip() or "portfolio"