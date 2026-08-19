import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CropRoute API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}
