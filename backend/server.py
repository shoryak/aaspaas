import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from lib.db import client, db, ensure_indexes
from lib.rate_limit import RateLimitMiddleware
from models.aaspaas import IdeaResponse
from routers.analytics import router as analytics_router
from routers.discovery import router as discovery_router
from routers.engagement import router as engagement_router
from routers.fundamentals import router as fundamentals_router
from routers.market import router as market_router
from routers.voice import router as voice_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    yield
    client.close()


app = FastAPI(title="Aaspaas API", lifespan=lifespan)
api_router = APIRouter(prefix="/api")


@api_router.get("/", response_model=dict)
async def root():
    return {"message": "Aaspaas is ready"}


api_router.include_router(discovery_router)
api_router.include_router(engagement_router)
api_router.include_router(analytics_router)
api_router.include_router(market_router)
api_router.include_router(voice_router)
api_router.include_router(fundamentals_router)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app.include_router(api_router)