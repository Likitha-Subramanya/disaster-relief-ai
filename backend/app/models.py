import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Enum,
    ForeignKey,
    Float,
    Boolean,
    Text,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from geoalchemy2 import Geography

from .db import Base


class UserRole(str, enum.Enum):
    citizen = "citizen"
    responder = "responder"
    admin = "admin"


class IncidentStatus(str, enum.Enum):
    requested = "requested"
    triaged = "triaged"
    assigned = "assigned"
    en_route = "en_route"
    arrived = "arrived"
    resolved = "resolved"


class AssignmentStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    cancelled = "cancelled"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.citizen)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    responder_profile: Mapped["Responder" | None] = relationship("Responder", back_populates="user", uselist=False)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    category: Mapped[str | None] = mapped_column(String(64), index=True)
    urgency: Mapped[str | None] = mapped_column(String(32), index=True)

    injured_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trapped: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    water_level_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    address: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), default=IncidentStatus.requested, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments: Mapped[list["Assignment"]] = relationship("Assignment", back_populates="incident")
    events: Mapped[list["IncidentEvent"]] = relationship("IncidentEvent", back_populates="incident")
    media_items: Mapped[list["IncidentMedia"]] = relationship("IncidentMedia", back_populates="incident")


class IncidentMedia(Base):
    __tablename__ = "incident_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))  # image, audio
    url: Mapped[str] = mapped_column(String(512))
    metadata: Mapped[str | None] = mapped_column(Text, nullable=True)

    incident: Mapped[Incident] = relationship("Incident", back_populates="media_items")


class Responder(Base):
    __tablename__ = "responders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str] = mapped_column(String(255))
    skills: Mapped[str] = mapped_column(String(255))  # comma-separated skills
    vehicle_type: Mapped[str | None] = mapped_column(String(64))
    trust_score: Mapped[float] = mapped_column(Float, default=0.5)

    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    user: Mapped[User] = relationship("User", back_populates="responder_profile")
    assignments: Mapped[list["Assignment"]] = relationship("Assignment", back_populates="responder")


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    responder_id: Mapped[int] = mapped_column(ForeignKey("responders.id"), index=True)

    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus), default=AssignmentStatus.pending, index=True
    )
    score: Mapped[float] = mapped_column(Float, default=0.0)
    eta_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    incident: Mapped[Incident] = relationship("Incident", back_populates="assignments")
    responder: Mapped[Responder] = relationship("Responder", back_populates="assignments")


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    from_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64))  # status_change, note, created, assigned, etc.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    incident: Mapped[Incident] = relationship("Incident", back_populates="events")

