"""SAP asset register connector (mock)."""
import json

from .base import AssetSource

# SAP field name -> internal field name
FIELD_MAP = {"ANLN1": "asset_id", "TXT50": "description", "ANLKL": "asset_class",
             "BUKRS": "company", "AKTIV": "acquired", "ANSWL": "cost"}


class SAPConnector(AssetSource):
    """Reads an SAP-shaped asset register from a JSON file.

    Swap for a real API client with the same methods.
    """

    def __init__(self, path):
        self.path = path

    def get_assets(self):
        with open(self.path) as f:
            rows = json.load(f)
        return [{internal: row[sap] for sap, internal in FIELD_MAP.items()} for row in rows]
