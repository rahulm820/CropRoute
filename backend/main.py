import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.collectors import router as collectors_router
from routers.commodities import router as commodities_router
from routers.mandi import router as mandi_router
from routers.search import router as search_router
from services import refresh_job, self_heal_monitor


@asynccontextmanager
async def lifespan(_: FastAPI):
    # baseline Agmarknet refresh every REFRESH_INTERVAL_HOURS (docs/DATA-SOURCES.md),
    # plus an immediate first pass so compose doesn't start with an empty feed
    refresh_job.start_scheduler()
    # hourly self-heal monitor cycle (docs/SELF-HEAL.md); manual runs go through
    # POST /api/collectors/trigger and do not wait for the schedule
    self_heal_monitor.start_scheduler()
    yield
    refresh_job.stop_scheduler()
    self_heal_monitor.stop_scheduler()


app = FastAPI(title="CropRoute API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(commodities_router, prefix="/api", tags=["commodities"])
app.include_router(mandi_router, prefix="/api", tags=["mandi"])
app.include_router(search_router, prefix="/api", tags=["search"])
app.include_router(collectors_router, prefix="/api", tags=["collectors"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
