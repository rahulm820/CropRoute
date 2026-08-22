import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.commodities import router as commodities_router
from routers.search import router as search_router

app = FastAPI(title="CropRoute API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(commodities_router, prefix="/api", tags=["commodities"])
app.include_router(search_router, prefix="/api", tags=["search"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
