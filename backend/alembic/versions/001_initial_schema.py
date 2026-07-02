"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-06-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── incidents (referenced by FKs below) ──────────────────────────────────
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=False),
        sa.Column("reporter_name", sa.String(200)),
        sa.Column("reporter_phone", sa.String(50)),
        sa.Column("reporter_id", sa.String(100)),
        sa.Column("affected_count", sa.Integer()),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ai_category", sa.String(100)),
        sa.Column("ai_confidence", sa.Float()),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("admin_notes", sa.Text()),
        sa.Column("trust_score", sa.Float()),
        sa.Column("confidence_level", sa.String(30)),
        sa.Column("validation_reasons", sa.JSON()),
    )
    op.create_index("ix_incidents_severity", "incidents", ["severity"])
    op.create_index("ix_incidents_status", "incidents", ["status"])
    op.create_index("ix_incidents_reporter_id", "incidents", ["reporter_id"])
    op.create_index("ix_incidents_timestamp", "incidents", ["timestamp"])

    # ── external_observations ─────────────────────────────────────────────────
    op.create_table(
        "external_observations",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("source", sa.String(60), nullable=False),
        sa.Column("provider_type", sa.String(30), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("location_name", sa.String(200)),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("temperature", sa.Float()),
        sa.Column("humidity", sa.Float()),
        sa.Column("wind_speed", sa.Float()),
        sa.Column("wind_direction", sa.Float()),
        sa.Column("precipitation_mm", sa.Float()),
        sa.Column("weather_code", sa.Integer()),
        sa.Column("weather_description", sa.String(200)),
        sa.Column("fire_radiative_power", sa.Float()),
        sa.Column("brightness", sa.Float()),
        sa.Column("fire_confidence", sa.String(20)),
        sa.Column("solar_irradiance", sa.Float()),
        sa.Column("soil_moisture", sa.Float()),
        sa.Column("raw_data", sa.JSON()),
        sa.Column(
            "linked_incident_id",
            sa.String(20),
            sa.ForeignKey("incidents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("risk_score", sa.Float()),
        sa.Column("ai_confidence", sa.Float()),
        sa.Column("ai_summary", sa.Text()),
        sa.Column("recommended_actions", sa.JSON()),
    )
    op.create_index("ix_obs_provider_type", "external_observations", ["provider_type"])
    op.create_index("ix_obs_observed_at", "external_observations", ["observed_at"])
    op.create_index("ix_obs_linked_incident", "external_observations", ["linked_incident_id"])

    # ── trust_audit_log ───────────────────────────────────────────────────────
    op.create_table(
        "trust_audit_log",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column(
            "incident_id",
            sa.String(20),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("actor", sa.String(200)),
        sa.Column("previous_status", sa.String(20)),
        sa.Column("new_status", sa.String(20)),
        sa.Column("trust_score_before", sa.Float()),
        sa.Column("trust_score_after", sa.Float()),
        sa.Column("confidence_before", sa.String(30)),
        sa.Column("confidence_after", sa.String(30)),
        sa.Column("notes", sa.Text()),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_trust_audit_log_incident_id", "trust_audit_log", ["incident_id"])

    # ── alerts ────────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message_en", sa.Text(), nullable=False),
        sa.Column("message_sw", sa.Text()),
        sa.Column("message_fr", sa.Text()),
        sa.Column("message_ar", sa.Text()),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("affected_areas", sa.JSON()),
        sa.Column("source", sa.String(200), nullable=False, server_default="Sentinel AI System"),
        sa.Column("ai_generated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("incident_id", sa.String(20)),
        sa.Column("notification_channels", sa.JSON()),
        sa.Column("delivery_status", sa.JSON()),
        sa.Column("radius_km", sa.Float()),
        sa.Column("lat", sa.Float()),
        sa.Column("lng", sa.Float()),
        sa.Column("recommended_actions", sa.JSON()),
        sa.Column("evacuation_guidance", sa.Text()),
        sa.Column("public_safety_message", sa.Text()),
        sa.Column("districts", sa.JSON()),
    )

    # ── resources ─────────────────────────────────────────────────────────────
    op.create_table(
        "resources",
        sa.Column("id", sa.String(24), primary_key=True),
        sa.Column("resource_type", sa.String(30), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(30), server_default="units"),
        sa.Column("status", sa.String(30), nullable=False, server_default="available"),
        sa.Column("owner_org", sa.String(200)),
        sa.Column("contact", sa.String(100)),
        sa.Column("lat", sa.Float()),
        sa.Column("lng", sa.Float()),
        sa.Column("location_name", sa.String(300)),
        sa.Column("assigned_incident_id", sa.String(24)),
        sa.Column("deployment_notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("tags", sa.JSON()),
    )
    op.create_index("ix_resources_resource_type", "resources", ["resource_type"])
    op.create_index("ix_resources_status", "resources", ["status"])
    op.create_index("ix_resources_assigned_incident_id", "resources", ["assigned_incident_id"])

    # ── resource_requests ─────────────────────────────────────────────────────
    op.create_table(
        "resource_requests",
        sa.Column("id", sa.String(24), primary_key=True),
        sa.Column("requester_name", sa.String(200), nullable=False),
        sa.Column("requester_phone", sa.String(50)),
        sa.Column("requester_location", sa.String(300)),
        sa.Column("lat", sa.Float()),
        sa.Column("lng", sa.Float()),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("quantity_needed", sa.Integer(), server_default="1"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("incident_id", sa.String(24)),
        sa.Column("urgency", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("fulfilled_by_resource_id", sa.String(24)),
        sa.Column("responder_notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("fulfilled_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_resource_requests_category", "resource_requests", ["category"])
    op.create_index("ix_resource_requests_urgency", "resource_requests", ["urgency"])
    op.create_index("ix_resource_requests_status", "resource_requests", ["status"])
    op.create_index("ix_resource_requests_incident_id", "resource_requests", ["incident_id"])

    # ── sentinel_api_users ────────────────────────────────────────────────────
    op.create_table(
        "sentinel_api_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="USER"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_sentinel_api_users_email"),
    )
    op.create_index("ix_sentinel_api_users_email", "sentinel_api_users", ["email"])


def downgrade() -> None:
    op.drop_index("ix_sentinel_api_users_email", "sentinel_api_users")
    op.drop_table("sentinel_api_users")
    op.drop_index("ix_resource_requests_incident_id", "resource_requests")
    op.drop_index("ix_resource_requests_status", "resource_requests")
    op.drop_index("ix_resource_requests_urgency", "resource_requests")
    op.drop_index("ix_resource_requests_category", "resource_requests")
    op.drop_table("resource_requests")
    op.drop_index("ix_resources_assigned_incident_id", "resources")
    op.drop_index("ix_resources_status", "resources")
    op.drop_index("ix_resources_resource_type", "resources")
    op.drop_table("resources")
    op.drop_table("alerts")
    op.drop_index("ix_trust_audit_log_incident_id", "trust_audit_log")
    op.drop_table("trust_audit_log")
    op.drop_index("ix_obs_linked_incident", "external_observations")
    op.drop_index("ix_obs_observed_at", "external_observations")
    op.drop_index("ix_obs_provider_type", "external_observations")
    op.drop_table("external_observations")
    op.drop_index("ix_incidents_timestamp", "incidents")
    op.drop_index("ix_incidents_reporter_id", "incidents")
    op.drop_index("ix_incidents_status", "incidents")
    op.drop_index("ix_incidents_severity", "incidents")
    op.drop_table("incidents")
