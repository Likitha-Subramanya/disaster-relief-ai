from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..models import Incident, IncidentEvent, IncidentStatus
from ..schemas import IncidentCreate, IncidentOut, IncidentUpdateStatus, IncidentEventOut
from ..security import get_current_active_user
from ..config import get_settings
from ..ml import classify_text, extract_structured


router = APIRouter(prefix="/incidents", tags=["incidents"])
settings = get_settings()


def _point_from_lat_lng(lat: float, lng: float):
    # PostGIS geography from lon/lat
    return func.ST_GeogFromText(f"SRID=4326;POINT({lng} {lat})")


@router.post("/", response_model=IncidentOut)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_active_user),
):
    geom = _point_from_lat_lng(payload.location.lat, payload.location.lng)

    # Use description + raw_text for ML enrichment
    text_source = payload.raw_text or payload.description

    category = payload.category
    urgency = payload.urgency
    injured_count = payload.injured_count
    trapped = payload.trapped
    water_level_m = payload.water_level_m

    if text_source:
        if category is None or urgency is None:
            cls = classify_text(text_source)
            if category is None:
                category = cls.category
            if urgency is None:
                urgency = cls.urgency

        if injured_count is None or trapped is None or water_level_m is None:
            ext = extract_structured(text_source)
            if injured_count is None:
                injured_count = ext.injured_count
            if trapped is None:
                trapped = ext.trapped
            if water_level_m is None:
                water_level_m = ext.water_level_m

    incident = Incident(
        reporter_id=user.id,
        description=payload.description,
        raw_text=payload.raw_text,
        category=category,
        urgency=urgency,
        injured_count=injured_count,
        trapped=trapped,
        water_level_m=water_level_m,
        location=geom,
        address=payload.address,
        status=IncidentStatus.requested,
    )
    db.add(incident)
    db.flush()

    event = IncidentEvent(
        incident_id=incident.id,
        actor_user_id=user.id,
        from_status=None,
        to_status=IncidentStatus.requested.value,
        event_type="created",
        note="Incident created",
    )
    db.add(event)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/", response_model=list[IncidentOut])
def list_incidents(
    db: Session = Depends(get_db),
    user=Depends(get_current_active_user),
):
    incidents = db.scalars(select(Incident).order_by(Incident.created_at.desc())).all()
    return incidents


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: int, db: Session = Depends(get_db), user=Depends(get_current_active_user)):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.get("/{incident_id}/events", response_model=list[IncidentEventOut])
def get_incident_events(incident_id: int, db: Session = Depends(get_db), user=Depends(get_current_active_user)):
    events = db.scalars(
        select(IncidentEvent).where(IncidentEvent.incident_id == incident_id).order_by(IncidentEvent.created_at)
    ).all()
    return events


@router.patch("/{incident_id}/status", response_model=IncidentOut)
def update_incident_status(
    incident_id: int,
    payload: IncidentUpdateStatus,
    db: Session = Depends(get_db),
    user=Depends(get_current_active_user),
):
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    from_status = incident.status.value
    incident.status = payload.status

    event = IncidentEvent(
        incident_id=incident.id,
        actor_user_id=user.id,
        from_status=from_status,
        to_status=payload.status.value,
        event_type="status_change",
        note=payload.note,
    )
    db.add(event)
    db.commit()
    db.refresh(incident)
    return incident
