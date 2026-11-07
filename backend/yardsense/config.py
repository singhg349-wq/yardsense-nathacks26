"""Where the rates and seed files live."""
import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = REPO_ROOT / "data" / "seed"


def load_rates(path=None):
    """Read rates.json. Env YARDSENSE_RATES overrides the default path."""
    path = path or os.environ.get("YARDSENSE_RATES") or SEED_DIR / "rates.json"
    with open(path) as f:
        return json.load(f)
