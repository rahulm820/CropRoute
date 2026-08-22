"""Collector status + manual trigger - issue #21 (docs/API.md "Collectors").

GET /api/collectors/status  - one panel entry per scrapers/*.json registry file with
its latest state and run history from collector_runs.

POST /api/collectors/trigger - queue a monitor cycle now: a plain re-run
({"collector": name}), the demo break lever (force_break=true) or the demo heal lever
(heal=true). Runs in the background - a real Bright Data cycle polls for up to 300s -
and returns 202 immediately; the panel picks up the new collector_runs rows via GET.
"""

import json
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from db.session import SessionLocal
from models import CollectorRun
from services import brightdata_service, self_heal_monitor

router = APIRouter()

RUN_HISTORY = 10


def _registry() -> list[dict]:
    """Raw configs from scrapers/*.json. Deliberately NOT load_collector(): a
    collector whose id is still a TBD placeholder must still appear on the panel
    (its config problem is visible in collector_id), not vanish because it cannot
    run yet."""
    try:
        directory = brightdata_service._collectors_dir()
    except brightdata_service.BrightDataError:
        return []
    entries = []
    for path in sorted(directory.glob("*.json")):
        try:
            cfg = json.loads(path.read_text())
        except (ValueError, OSError):
            cfg = {}
        entries.append({
            "name": path.stem,
            "collector_id": str(cfg.get("collector_id") or "").strip(),
            "target_url": cfg.get("target_url"),
            # configs may declare their target state; fall back to the registry name
            "target_state": cfg.get("state") or path.stem.split("_")[0].title(),
        })
    return entries


@router.get("/collectors/status")
def collectors_status():
    db = SessionLocal()
    try:
        panels = []
        for entry in _registry():
            rows = db.scalars(
                select(CollectorRun)
                .where(CollectorRun.collector_id == entry["name"])
                .order_by(CollectorRun.ran_at.desc(), CollectorRun.id.desc())
                .limit(RUN_HISTORY)
            ).all()

            def run_view(row: CollectorRun | None) -> dict | None:
                if row is None:
                    return None
                return {
                    "status": row.status,
                    "ran_at": row.ran_at.isoformat(),
                    "notes": row.notes or "",
                    "field_completeness": float(row.field_completeness)
                    if row.field_completeness is not None else None,
                }

            latest = run_view(rows[0]) if rows else None
            panels.append({
                "collector": entry["name"],
                "collector_id": entry["collector_id"],
                "target_state": entry["target_state"],
                "target_url": entry["target_url"],
                "status": latest["status"] if latest else None,
                "last_run": latest["ran_at"] if latest else None,
                "field_completeness": latest["field_completeness"] if latest else None,
                "runs": [run_view(r) for r in rows],
            })
        return panels
    finally:
        db.close()


class TriggerBody(BaseModel):
    collector: str | None = None
    force_break: bool = False
    heal: bool = False


@router.post("/collectors/trigger", status_code=202)
def collectors_trigger(body: TriggerBody, background: BackgroundTasks):
    names = [body.collector] if body.collector else None
    if body.collector:
        known = {e["name"] for e in _registry()}
        if body.collector not in known:
            raise HTTPException(
                status_code=404,
                detail=f"unknown collector {body.collector!r} - registered: {sorted(known)}",
            )
    run_id = uuid.uuid4().hex[:12]
    background.add_task(self_heal_monitor.run_monitor, collector=names[0] if names else None,
                        force_break=body.force_break, heal=body.heal)
    return {"run_id": run_id, "status": "running",
            "collector": body.collector, "force_break": body.force_break,
            "heal": body.heal}
