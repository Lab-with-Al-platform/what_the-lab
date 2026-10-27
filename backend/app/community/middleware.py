"""게시판의 오류 응답까지 캐시에서 제외하고 JSON 요청 크기를 제한합니다."""

from fastapi import Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_REQUEST_BYTES = 128 * 1024


async def validation_error(request: Request, exc: RequestValidationError):
    if not request.url.path.startswith("/api/v1/community/"):
        return await request_validation_exception_handler(request, exc)
    # 입력 원문(개인 문의·인증정보)을 오류 응답에 복사하지 않습니다.
    errors = [
        {
            "loc": [
                part.encode("utf-8", "replace").decode() if isinstance(part, str) else part
                for part in error["loc"]
            ],
            "msg": error["msg"].encode("utf-8", "replace").decode(),
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return JSONResponse({"detail": errors}, status_code=422)


class CommunityPrivacyMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not (
            path == "/api/v1/community" or path.startswith("/api/v1/community/")
        ):
            await self.app(scope, receive, send)
            return

        async def private_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "private, no-store, max-age=0"
                headers["X-Robots-Tag"] = "noindex, nofollow"
                vary = {value.strip() for value in headers.get("Vary", "").split(",") if value}
                headers["Vary"] = ", ".join(sorted(vary | {"Cookie", "Origin"}))
            await send(message)

        # 미리 크기를 제한한 뒤에만 FastAPI/Pydantic이 JSON을 파싱합니다.
        if scope["method"] in {"POST", "PUT", "PATCH", "DELETE"}:
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > MAX_REQUEST_BYTES:
                    response = JSONResponse(
                        {"detail": "요청이 너무 큽니다. 글·댓글의 입력 길이를 확인해 주세요."},
                        status_code=413,
                    )
                    await response(scope, receive, private_send)
                    return
                if not message.get("more_body", False):
                    break
            consumed = False

            async def bounded_receive() -> Message:
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            await self.app(scope, bounded_receive, private_send)
        else:
            await self.app(scope, receive, private_send)
