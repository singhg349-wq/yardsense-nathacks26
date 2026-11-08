"""YardSense API entry point.

Run from the backend/ folder:
    uvicorn app.main:app --reload
"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from yardsense.api import router

# Repo root, resolved with pathlib so paths work on Windows and macOS.
REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = REPO_ROOT / "data" / "seed"

app = FastAPI(title="YardSense API", version="0.1.0")
app.include_router(router)

# Allow the Vite dev server to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                  *[u for u in os.environ.get("FRONTEND_URLS", "").split(",") if u]],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "seed_dir_found": SEED_DIR.is_dir()}
