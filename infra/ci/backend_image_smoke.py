"""backend 이미지 안에서 실행하는 점검이에요. (docs/aws-deployment/09-deployment-roadmap.md B7)

t4g(ARM64)에서는 C로 만든 라이브러리가 ARM용으로 설치됐는지가 중요해요.
"설치는 됐는데 실행하면 깨지는" 경우를 잡으려고, 불러오기만 하지 않고 실제로 한 번씩 써 봐요.

사용 (이미지 밖의 이 파일을 읽기 전용으로 넣어서 실행):
    docker run --rm -v "$PWD/infra/ci:/ci:ro" <이미지> python /ci/backend_image_smoke.py
"""

import importlib
import io
import os
import platform
import subprocess
import sys

APP_DIR = "/app"  # 이미지의 WORKDIR. 이 파일은 /ci 에서 실행되므로 앱 폴더를 직접 알려 줘요.

# C 확장이 들어 있는 라이브러리 (uv.lock 기준)
NATIVE_MODULES = [
    "cryptography", "psycopg", "PIL", "pydantic_core", "sqlalchemy", "greenlet",
    "uvloop", "httptools", "aiohttp", "multidict", "yarl", "frozenlist",
]

# app.config 가 불러올 때 꼭 필요한 값 (점검용 가짜 값)
DUMMY_ENV = {
    "DISCORD_CLIENT_ID": "smoke",
    "DISCORD_CLIENT_SECRET": "smoke",
    "DISCORD_REDIRECT_URI": "http://localhost/callback",
    "JWT_SECRET": "smoke-check-secret-at-least-32-characters",
}


def check_imports() -> None:
    """C 확장 라이브러리를 모두 불러와요."""
    for name in NATIVE_MODULES:
        module = importlib.import_module(name)
        print(f"  import {name} {getattr(module, '__version__', '')}")


def check_psycopg_binary() -> None:
    """psycopg가 ARM용 libpq(binary)를 쓰는지 봐요. 'python'이면 DB 연결이 안 돼요."""
    import psycopg

    assert psycopg.pq.__impl__ == "binary", f"psycopg 구현이 {psycopg.pq.__impl__} 예요"
    print(f"  psycopg pq={psycopg.pq.__impl__} libpq={psycopg.pq.version()}")


def check_cryptography() -> None:
    """암호화·복호화를 한 번 해 봐요 (OpenSSL이 실제로 도는지)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    box = AESGCM(key)
    assert box.decrypt(nonce, box.encrypt(nonce, b"labbridge", None), None) == b"labbridge"
    print("  cryptography AES-GCM ok")


def check_pillow() -> None:
    """이미지를 PNG·JPEG·WebP로 저장해 봐요 (프로필 사진 업로드에 써요)."""
    from PIL import Image

    image = Image.new("RGB", (8, 8), "white")
    for fmt in ["PNG", "JPEG", "WEBP"]:
        image.save(io.BytesIO(), format=fmt)
    print("  pillow PNG/JPEG/WEBP ok")


def check_app_import() -> None:
    """앱(backend)과 디스코드 봇 코드를 불러와요. DB에는 연결하지 않아요."""
    sys.path.insert(0, APP_DIR)
    os.environ.update({key: os.environ.get(key, value) for key, value in DUMMY_ENV.items()})
    importlib.import_module("app.main")
    importlib.import_module("app.discord_gateway")
    print("  app.main, app.discord_gateway import ok")


def check_migrations() -> None:
    """이미지에 마이그레이션이 들어 있고, 마지막 버전(head)이 하나인지 봐요."""
    result = subprocess.run(["alembic", "heads"], capture_output=True, text=True, check=True, cwd=APP_DIR)
    heads = [line for line in result.stdout.splitlines() if "(head)" in line]
    assert len(heads) == 1, f"alembic head가 {len(heads)}개예요: {result.stdout}"
    print(f"  alembic {heads[0]}")


def main() -> None:
    print(f"backend 이미지 점검: {platform.machine()} / Python {platform.python_version()}")
    for check in [check_imports, check_psycopg_binary, check_cryptography, check_pillow,
                  check_app_import, check_migrations]:
        check()
    print("모두 통과")


if __name__ == "__main__":
    main()
