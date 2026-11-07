"""The interfaces the engine depends on. A real connector only has to match these."""
from abc import ABC, abstractmethod


class AssetSource(ABC):
    @abstractmethod
    def get_assets(self) -> list[dict]:
        """Return assets as {asset_id, description, asset_class, company, acquired, cost}."""


class ProjectSource(ABC):
    @abstractmethod
    def get_projects(self) -> list[dict]:
        """Return projects as {id, project_number, name, company, site_id, start_date,
        completion_date, phases: [{task_name, start, finish}],
        needs: [{asset_class, qty, start, finish, phase}]}."""
