"""Metadata about where the demo's numbers come from."""
import json

from .config import SEED_DIR


def load_sources(path=None):
    """Read the committed provenance metadata."""
    path = path or SEED_DIR / "sources.json"
    with open(path) as handle:
        return json.load(handle)
