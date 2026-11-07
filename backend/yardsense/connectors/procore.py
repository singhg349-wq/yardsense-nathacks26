"""Procore project schedule connector (mock)."""
import json

from .base import ProjectSource


class ProcoreConnector(ProjectSource):
    """Reads Procore-shaped projects from a JSON file: projects, phases and planned needs.

    Swap for a real API client with the same methods.
    """

    def __init__(self, path):
        self.path = path

    def get_projects(self):
        with open(self.path) as f:
            rows = json.load(f)
        projects = []
        for row in rows:
            projects.append({
                "id": row["id"],
                "project_number": row["project_number"],
                "name": row["name"],
                "company": row["company"],
                "site_id": row["site_id"],
                "start_date": row["start_date"],
                "completion_date": row["completion_date"],
                "phases": [{"task_name": t["task_name"], "start": t["start"], "finish": t["finish"]}
                           for t in row["schedule"]],
                "needs": [{"asset_class": n["class"], "qty": n["qty"], "start": n["start"],
                           "finish": n["finish"], "phase": n["phase"]}
                          for n in row["planned_equipment"]],
            })
        return projects
