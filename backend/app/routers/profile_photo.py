"""프로필 사진 (프로필 설정 > 기본 정보). 이 서비스 안에서만 쓰는 사진이에요. (디스코드 사진과 별개)

올린 사진은 가운데를 정사각형으로 잘라 400×400 JPG 한 장으로 저장해요.
원본은 남기지 않고, 사진 속 촬영 위치 같은 정보(EXIF)도 이때 지워져요.
"""

import time
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError

from app import upload_store
from app.db import get_connection
from app.security import get_current_user_id

router = APIRouter(prefix="/api/v1", tags=["profile-photo"])

MAX_PHOTO_MB = 5
MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024
PHOTO_SIZE = 400  # 저장할 한 변 길이(px)
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def photo_key(user_id: int) -> str:
    """사진 파일 위치. 회원마다 한 장이라 새로 올리면 덮어써요."""
    return f"profile/{user_id}.jpg"


async def read_image_body(request: Request) -> bytes:
    """요청 본문(사진 파일 그대로)을 읽어요. 5MB를 넘으면 끝까지 읽지 않고 멈춰요."""
    if request.headers.get("content-type", "") not in IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="JPG·PNG·WEBP 사진만 올릴 수 있어요")
    content = bytearray()
    async for chunk in request.stream():
        content += chunk
        if len(content) > MAX_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail=f"사진은 {MAX_PHOTO_MB}MB까지 올릴 수 있어요")
    return bytes(content)


def to_square_jpeg(content: bytes) -> bytes:
    """사진 → 가운데 정사각형 400×400 JPG. 사진이 아니면 415."""
    try:
        image = Image.open(BytesIO(content))
        image = ImageOps.exif_transpose(image)  # 폰으로 찍은 사진이 옆으로 눕지 않게 방향을 바로잡아요
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=415, detail="사진 파일을 읽을 수 없어요") from None
    image = ImageOps.fit(image.convert("RGB"), (PHOTO_SIZE, PHOTO_SIZE))  # 가운데 기준으로 잘라 맞춤
    output = BytesIO()
    image.save(output, format="JPEG", quality=85)  # 새로 저장하면 EXIF는 따라오지 않아요
    return output.getvalue()


@router.put("/me/photo")
def upload_photo(
    user_id: int = Depends(get_current_user_id), content: bytes = Depends(read_image_body)
) -> dict:
    """[사진 바꾸기] 저장. users.user_photo에는 사진 주소를 남겨요.

    주소 끝 ?v=시각: 같은 주소로 덮어써도 브라우저가 예전 사진을 계속 보여 주지 않게 해요.
    """
    path = upload_store.path_of(photo_key(user_id))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(to_square_jpeg(content))
    photo = f"/users/{user_id}/photo?v={int(time.time())}"
    set_user_photo(user_id, photo)
    return {"user_photo": photo}


@router.delete("/me/photo")
def delete_photo(user_id: int = Depends(get_current_user_id)) -> dict:
    """[기본 이미지로] 사진을 지우고 기본 이미지로 돌아가요."""
    set_user_photo(user_id, None)
    upload_store.delete_file(photo_key(user_id))
    return {"user_photo": None}


@router.get("/users/{user_id}/photo")
def view_photo(user_id: int) -> FileResponse:
    """사진 보기. 프로필 사진은 협업 상대에게 보여 주는 거라 로그인 없이도 볼 수 있어요."""
    path = upload_store.path_of(photo_key(user_id))
    if not path.is_file():
        raise HTTPException(status_code=404, detail="사진이 없어요")
    # 주소에 ?v=가 붙어 있어서 오래 저장해 둬도 돼요 (사진을 바꾸면 주소가 바뀌어요)
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=604800"})


def set_user_photo(user_id: int, photo: str | None) -> None:
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("UPDATE users SET user_photo = %s WHERE user_id = %s", (photo, user_id))