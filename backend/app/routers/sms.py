from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..db import get_db
from ..models import Incident, IncidentEvent, IncidentStatus
from ..schemas import SMSInbound
from ..config import get_settings
from sqlalchemy import func


router = APIRouter(prefix="/sms", tags=["sms"])
settings = get_settings()


def _point_from_lat_lng(lat: float, lng: float):
    return func.ST_GeogFromText(f"SRID=4326;POINT({lng} {lat})")


@router.post("/inbound")
def sms_inbound(payload: SMSInbound, db: Session = Depends(get_db)):
    # Very simple parser: expect body like "URGENT;lat;lng;description"
    try:
        parts = payload.body.split(";", 3)
        urgency = parts[0].strip().lower() if len(parts) > 0 else None
        lat = float(parts[1]) if len(parts) > 1 else 0.0
        lng = float(parts[2]) if len(parts) > 2 else 0.0
        description = parts[3] if len(parts) > 3 else payload.body
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid SMS format")

    geom = _point_from_lat_lng(lat, lng)

    incident = Incident(
        reporter_id=None,
        description=description,
        raw_text=payload.body,
        category=None,
        urgency=urgency,
        location=geom,
        status=IncidentStatus.requested,
    )
    db.add(incident)
    db.flush()

    event = IncidentEvent(
        incident_id=incident.id,
        actor_user_id=None,
        from_status=None,
        to_status=IncidentStatus.requested.value,
        event_type="created_sms",
        note=f"SMS from {payload.from_number} at {payload.received_at.isoformat()}",
    )
    db.add(event)
    db.commit()
    db.refresh(incident)

    return {"incident_id": incident.id}
