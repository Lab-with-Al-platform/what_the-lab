from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import (
    auth,
    collab_requests,
    expert,
    expert_history,
    expert_portfolio,
    expert_profile,
    experts,
    insights,
    researcher,
    researcher_research,
    taxonomy,
    verification,
    notifications,
)

app = FastAPI(title="LabBridge API")

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
app.include_router(auth.router)
app.include_router(verification.router)
app.include_router(researcher.router)
app.include_router(insights.router)

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