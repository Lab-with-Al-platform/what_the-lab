from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS

from app.routers import auth, insights

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

app.include_router(auth.router)
app.include_router(insights.router)
