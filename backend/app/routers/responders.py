from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Responder, User
from ..schemas import ResponderCreate, ResponderOut
from ..security import get_current_active_user, require_role
from ..models import UserRole


router = APIRouter(prefix="/responders", tags=["responders"])


def _point_from_lat_lng(lat: float, lng: float):
    return func.ST_GeogFromText(f"SRID=4326;POINT({lng} {lat})")


@router.post("/", response_model=ResponderOut)
def create_responder(
    payload: ResponderCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_role(UserRole.admin)),
):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.scalar(select(Responder).where(Responder.user_id == user.id))
    if existing:
        raise HTTPException(status_code=400, detail="Responder already exists for user")

    geom = _point_from_lat_lng(payload.location.lat, payload.location.lng)

    responder = Responder(
        user_id=user.id,
        display_name=payload.display_name,
        skills=payload.skills,
        vehicle_type=payload.vehicle_type,
        location=geom,
    )
    db.add(responder)
    db.commit()
    db.refresh(responder)
    return responder


@router.get("/", response_model=list[ResponderOut])
def list_responders(
    db: Session = Depends(get_db),
    _user=Depends(get_current_active_user),
):
    responders = db.scalars(select(Responder)).all()
    return responders
