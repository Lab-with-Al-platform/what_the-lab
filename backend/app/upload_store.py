"""사용자가 올린 파일(포트폴리오 PDF)을 서버 폴더에 저장·삭제합니다.

DB에는 파일 내용이 아니라 'portfolios/abc123.pdf' 같은 저장 위치(키)만 남깁니다.
파일 이름은 사용자가 정한 이름 대신 무작위로 만들어서, 이름이 겹치거나 경로를 조작할 수 없게 합니다.
"""

import uuid
from pathlib import Path

from app.config import UPLOAD_DIR


def save_pdf(content: bytes) -> str:
    """PDF를 저장하고 저장 키를 돌려줍니다."""
    key = f"portfolios/{uuid.uuid4().hex}.pdf"
    path = path_of(key)
    path.parent.mkdir(parents=True, exist_ok=True)  # 폴더가 없으면 만듭니다.
    path.write_bytes(content)
    return key


def path_of(key: str) -> Path:
    """저장 키 → 실제 파일 경로. 업로드 폴더 밖을 가리키면 막습니다."""
    root = UPLOAD_DIR.resolve()
    path = (root / key).resolve()
    if root not in path.parents:
        raise ValueError("업로드 폴더 밖의 경로입니다")
    return path


def file_size(key: str | None) -> int | None:
    """파일 크기(바이트). 파일이 없으면 None."""
    if not key:
        return None
    path = path_of(key)
    return path.stat().st_size if path.is_file() else None


def delete_file(key: str | None) -> None:
    """파일을 지웁니다. 이미 없으면 그냥 넘어갑니다."""
    if key:
        path_of(key).unlink(missing_ok=True)