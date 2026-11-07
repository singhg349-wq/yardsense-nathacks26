"""Every test gets its own throwaway database, built from the seed."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from yardsense import db  # noqa: E402


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("YARDSENSE_DB", str(tmp_path / "test.db"))
    db.reset_db()
