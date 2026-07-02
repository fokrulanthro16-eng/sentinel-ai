"""SQLAlchemy ORM model — external_observations table.

Stores raw data ingested from weather (OpenWeatherMap), climate (NASA POWER),
and fire hotspot (NASA FIRMS) providers. Records are linked to nearby incidents
and carry the AI analysis result produced by intelligence_service.
"""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, Index, Integer, JSON, String, Text, ForeignKey

from app.db.database import Base


class ExternalObservation(Base):
    __tablename__ = "external_observations"

    id = Column(
        String(40),
        primary_key=True,
        default=lambda: f"obs-{uuid4().hex[:8]}",
    )
    # Provider identity
    source          = Column(String(60), nullable=False)   # openweathermap | nasa_power | nasa_firms | mock_*
    provider_type   = Column(String(30), nullable=False)   # weather | climate | fire_hotspot

    # Spatial
    lat             = Column(Float, nullable=False)
    lng             = Column(Float, nullable=False)
    location_name   = Column(String(200))

    # Temporal
    observed_at  = Column(DateTime(timezone=True), nullable=False)
    ingested_at  = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Weather fields (OpenWeatherMap)
    temperature         = Column(Float)    # °C
    humidity            = Column(Float)    # %
    wind_speed          = Column(Float)    # m/s
    wind_direction      = Column(Float)    # degrees 0–360
    precipitation_mm    = Column(Float)    # mm/hr
    weather_code        = Column(Integer)  # OWM numeric code
    weather_description = Column(String(200))

    # Fire hotspot fields (NASA FIRMS)
    fire_radiative_power = Column(Float)   # MW
    brightness           = Column(Float)   # Kelvin
    fire_confidence      = Column(String(20))  # low | nominal | high

    # Climate fields (NASA POWER)
    solar_irradiance = Column(Float)   # W/m²
    soil_moisture    = Column(Float)   # m³/m³

    # Full API response payload
    raw_data = Column(JSON)

    # Optional link to nearest incident
    linked_incident_id = Column(
        String(20),
        ForeignKey("incidents.id", ondelete="SET NULL"),
        nullable=True,
    )

    # AI analysis result (set by intelligence_service, never auto-verifies incident)
    risk_score           = Column(Float)   # 0.0–1.0
    ai_confidence        = Column(Float)   # 0.0–1.0
    ai_summary           = Column(Text)
    recommended_actions  = Column(JSON)    # List[str]

    __table_args__ = (
        Index("ix_obs_provider_type", "provider_type"),
        Index("ix_obs_observed_at",   "observed_at"),
        Index("ix_obs_linked_incident", "linked_incident_id"),
    )
