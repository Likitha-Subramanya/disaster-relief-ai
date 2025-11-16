from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Incident, Assignment, AssignmentStatus
from ..schemas import DispatchRequest, AssignmentOut
from ..dispatch import score_responders_for_incident
from ..security import get_current_active_user, require_role
from ..models import UserRole


router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.post("/auto", response_model=list[AssignmentOut])
def auto_dispatch(
    payload: DispatchRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_role(UserRole.admin)),
):
    incident = db.get(Incident, payload.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    scores = score_responders_for_incident(db, incident, max_radius_km=payload.max_radius_km)

    assignments: list[Assignment] = []
    for score in scores[: payload.limit]:
        assignment = Assignment(
            incident_id=incident.id,
            responder_id=score.responder_id,
            status=AssignmentStatus.pending,
            score=score.score,
            eta_minutes=score.eta_minutes,
        )
        db.add(assignment)
        assignments.append(assignment)

    db.commit()
    for a in assignments:
        db.refresh(a)
    return assignments
