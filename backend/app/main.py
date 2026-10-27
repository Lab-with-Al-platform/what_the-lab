import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS

from app.discord_bot import bot_ready
from app.notification_sender import run_forever, wake_up

from app.routers import (
    analytics,
    auth,
    collab_requests,
    expert,
    expert_history,
    expert_portfolio,
    expert_profile,
    experts,
    insights,
    operations,
    researcher,
    researcher_research,
    taxonomy,
    verification,
    notifications,
    profile_photo,
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """서버가 켜질 때 디스코드 알림 보내기를 시작하고, 꺼질 때 멈춰요. 봇 설정이 없으면 시작하지 않아요."""
    task = asyncio.create_task(run_forever()) if bot_ready() else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="LabBridge API", lifespan=lifespan)

@app.middleware("http")
async def send_notifications_soon(request, call_next):
    """협업 요청을 보내거나 수락·거절·취소·시작하면, 처리가 끝난 직후 디스코드 알림을 바로 보내요."""
    response = await call_next(request)
    if request.method == "POST" and "/requests" in request.url.path and response.status_code < 400:
        wake_up()
    return response

# 프론트(localhost:3000)에서 이 서버로 요청을 보낼 수 있게 허용합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,  # 쿠키(JWT) 주고받기 허용
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    """서버가 살아 있는지 확인하는 주소입니다."""
    return {"status": "ok"}


# 회원·인증 API와 인사이트 API를 모두 등록해야 한쪽 기능이 사라지지 않습니다.
app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(verification.router)
app.include_router(researcher.router)
app.include_router(insights.router)
app.include_router(operations.router)

app.include_router(expert.router)
app.include_router(expert_profile.router)
app.include_router(expert_portfolio.router)
app.include_router(expert_history.router)
app.include_router(experts.router)
app.include_router(taxonomy.router)
app.include_router(researcher_research.router)
app.include_router(collab_requests.researcher_router)
app.include_router(collab_requests.expert_router)
app.include_router(notifications.router)
app.include_router(profile_photo.router)