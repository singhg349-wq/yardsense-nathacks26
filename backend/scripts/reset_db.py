"""Rebuild the database from data/seed: python backend/scripts/reset_db.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import db  # noqa: E402

if __name__ == "__main__":
    db.reset_db()
    print("Database reset from data/seed.")
