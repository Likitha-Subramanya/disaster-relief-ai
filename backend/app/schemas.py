from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from .models import IncidentStatus, AssignmentStatus, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=6)
    role: UserRole = UserRole.citizen


class UserOut(BaseModel):
    id: int
    email: EmailStr
    phone: Optional[str]
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: EmailStr
    password: str


class GeoPoint(BaseModel):
    lat: float
    lng: float


class IncidentCreate(BaseModel):
    description: str
    raw_text: Optional[str] = None
    category: Optional[str] = None
    urgency: Optional[str] = None
    injured_count: Optional[int] = None
    trapped: Optional[bool] = None
    water_level_m: Optional[float] = None
    location: GeoPoint
    address: Optional[str] = None


class IncidentUpdateStatus(BaseModel):
    status: IncidentStatus
    note: Optional[str] = None


class IncidentOut(BaseModel):
    id: int
    reporter_id: Optional[int]
    description: str
    category: Optional[str]
    urgency: Optional[str]
    injured_count: Optional[int]
    trapped: Optional[bool]
    water_level_m: Optional[float]
    address: Optional[str]
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncidentEventOut(BaseModel):
    id: int
    incident_id: int
    actor_user_id: Optional[int]
    from_status: Optional[str]
    to_status: Optional[str]
    event_type: str
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ResponderCreate(BaseModel):
    user_id: int
    display_name: str
    skills: str
    vehicle_type: Optional[str] = None
    location: GeoPoint


class ResponderOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    skills: str
    vehicle_type: Optional[str]
    trust_score: float
    is_available: bool

    class Config:
        from_attributes = True


class AssignmentCreate(BaseModel):
    incident_id: int
    responder_id: int


class AssignmentOut(BaseModel):
    id: int
    incident_id: int
    responder_id: int
    status: AssignmentStatus
    score: float
    eta_minutes: Optional[float]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DispatchScore(BaseModel):
    responder_id: int
    score: float
    distance_km: float
    eta_minutes: float


class DispatchRequest(BaseModel):
    incident_id: int
    max_radius_km: float = 50.0
    limit: int = 5


class SMSInbound(BaseModel):
    from_number: str
    body: str
    received_at: datetime
