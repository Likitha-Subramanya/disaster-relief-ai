import math
from typing import Iterable, List

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .models import Incident, Responder
from .schemas import DispatchScore


AVERAGE_SPEED_KM_PER_HOUR = 30.0


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Haversine formula
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _parse_point(geom_wkt: str) -> tuple[float, float]:
    # Expecting 'POINT(lon lat)'
    inner = geom_wkt.strip()[6:-1]
    lon_str, lat_str = inner.split()
    return float(lat_str), float(lon_str)


def score_responders_for_incident(
    db: Session,
    incident: Incident,
    max_radius_km: float = 50.0,
) -> List[DispatchScore]:
    # Fetch available responders; we do distance filtering in Python for now.
    responders: Iterable[Responder] = db.scalars(
        select(Responder).where(Responder.is_available.is_(True))
    ).all()

    incident_lat, incident_lon = _parse_point(db.scalar(select(func.ST_AsText(incident.location))))

    items: List[DispatchScore] = []
    for resp in responders:
        lat, lon = _parse_point(db.scalar(select(func.ST_AsText(resp.location))))
        distance = _distance_km(incident_lat, incident_lon, lat, lon)
        if distance > max_radius_km:
            continue

        eta_hours = distance / AVERAGE_SPEED_KM_PER_HOUR if AVERAGE_SPEED_KM_PER_HOUR > 0 else 0
        eta_minutes = eta_hours * 60

        # Simple score combining distance, trust_score, and urgency priority.
        urgency_weight = 1.0
        if incident.urgency == "critical":
            urgency_weight = 1.5
        elif incident.urgency == "urgent":
            urgency_weight = 1.2

        distance_penalty = distance / max_radius_km
        trust = resp.trust_score or 0.5

        score = urgency_weight * (trust * 1.5 + (1 - distance_penalty))

        items.append(
            DispatchScore(
                responder_id=resp.id,
                score=score,
                distance_km=distance,
                eta_minutes=eta_minutes,
            )
        )

    items.sort(key=lambda x: x.score, reverse=True)
    return items
