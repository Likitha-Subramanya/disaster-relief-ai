from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Incident, IncidentStatus
from ..security import require_role
from ..models import UserRole


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    _admin=Depends(require_role(UserRole.admin)),
):
    total = db.scalar(select(func.count(Incident.id))) or 0

    by_status = db.execute(
        select(Incident.status, func.count(Incident.id)).group_by(Incident.status)
    ).all()

    last_24h = datetime.utcnow() - timedelta(hours=24)
    recent = db.scalar(
        select(func.count(Incident.id)).where(Incident.created_at >= last_24h)
    ) or 0

    return {
        "total_incidents": total,
        "incidents_by_status": {status.value: count for status, count in by_status},
        "incidents_last_24h": recent,
    }


@router.get("/hotspots")
def hotspots(
    db: Session = Depends(get_db),
    _admin=Depends(require_role(UserRole.admin)),
):
    """Return simple geospatial aggregation (centroids and counts).

    This is a stub: in production, use proper clustering or heatmap tiles.
    """

    rows = db.execute(
        select(
            func.round(func.ST_Y(func.ST_Centroid(Incident.location)), 3).label("lat"),
            func.round(func.ST_X(func.ST_Centroid(Incident.location)), 3).label("lng"),
            func.count(Incident.id).label("count"),
        )
        .group_by("lat", "lng")
    ).all()

    return [
        {"lat": float(lat), "lng": float(lng), "count": int(count)}
        for lat, lng, count in rows
    ]
