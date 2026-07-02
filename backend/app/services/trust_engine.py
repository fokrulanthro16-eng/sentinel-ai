"""Heuristic Trust Score Engine.

Calculates a 0–100 composite trust score for an incident from multiple signals.
Pure CPU computation — no async, no I/O, no external API calls.

Score breakdown (max per component):
  Report Completeness   15 pts
  AI Classification     15 pts
  Corroborating Reports 20 pts
  Weather Compatibility 15 pts
  Satellite Hotspots    10 pts
  Reporter Auth         10 pts
  Recency               10 pts
  AI Semantic Bonus      5 pts  (optional, from Gemini)
  ─────────────────────────────
  Max                  100 pts

Confidence levels:
  76–100 → verified_candidate (strong evidence, still needs human approval)
  51–75  → high
  26–50  → medium
  0–25   → low
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


CONFIDENCE_THRESHOLDS = [
    (76, "verified_candidate"),
    (51, "high"),
    (26, "medium"),
    (0,  "low"),
]


def calculate_trust_score(
    incident: dict,
    *,
    weather: Optional[dict] = None,
    fire_hotspots: Optional[list] = None,
    nearby_reports: Optional[list] = None,
    ai_semantic_bonus: int = 0,
    ai_semantic_reasons: Optional[list] = None,
) -> dict:
    """Return trust_score (0-100), confidence_level, validation_reasons."""
    score = 0
    reasons: list[str] = []
    nearby_reports = nearby_reports or []
    fire_hotspots = fire_hotspots or []
    inc_type = incident.get("type", "other")

    # ── 1. Report Completeness (max 15) ──────────────────────────────────────
    desc = incident.get("description", "") or ""
    if len(desc) >= 100:
        score += 5
        reasons.append("Detailed description provided (100+ characters)")
    elif len(desc) >= 50:
        score += 3
        reasons.append("Adequate description provided")

    if incident.get("reporter_name"):
        score += 4
        reasons.append("Reporter identity provided")
    if incident.get("reporter_phone"):
        score += 3
        reasons.append("Contact phone number provided")
    affected = incident.get("affected_count")
    if affected is not None and affected > 0:
        score += 3
        reasons.append(f"Affected count reported: {affected:,} people")

    # ── 2. AI Classification (max 15) ─────────────────────────────────────────
    ai_conf = incident.get("ai_confidence") or 0
    ai_cat = incident.get("ai_category") or "Unclassified"
    if ai_cat and ai_cat != "Unclassified" and ai_conf > 0:
        ai_pts = min(15, round(ai_conf * 15))
        score += ai_pts
        reasons.append(f"AI classified as '{ai_cat}' ({round(ai_conf * 100)}% confidence)")

    # ── 3. Corroborating Reports (max 20) ─────────────────────────────────────
    n_corr = len(nearby_reports)
    if n_corr >= 3:
        score += 20
        reasons.append(f"{n_corr} corroborating reports within 5 km / 48 h")
    elif n_corr == 2:
        score += 14
        reasons.append("2 corroborating reports within 5 km / 48 h")
    elif n_corr == 1:
        score += 8
        reasons.append("1 corroborating nearby report")

    # ── 4. Weather Compatibility (max 15) ─────────────────────────────────────
    if weather:
        rain = weather.get("precipitation_mm") or 0
        humidity = weather.get("humidity") or 50
        temp = weather.get("temperature") or 20

        if inc_type == "flood":
            if rain > 5:
                score += 15
                reasons.append(f"Heavy rain ({rain:.1f} mm/hr) strongly corroborates flood")
            elif rain > 2:
                score += 10
                reasons.append(f"Moderate rain ({rain:.1f} mm/hr) supports flood report")
            elif rain > 0:
                score += 5
        elif inc_type == "fire":
            if humidity < 30 or temp > 32:
                score += 12
                reasons.append(f"Dry/hot conditions (humidity {humidity:.0f}%, {temp:.1f}°C) support fire")
            elif humidity < 50:
                score += 6
        elif inc_type == "contamination":
            if rain > 3:
                score += 10
                reasons.append("Rainfall may cause contamination runoff — consistent")
            else:
                score += 3
        elif inc_type in ("medical", "civil_unrest", "infrastructure", "power_outage", "landslide"):
            if weather.get("source"):
                score += 5
                reasons.append("Weather data available for cross-reference")

    # ── 5. Satellite / Fire Hotspot Compatibility (max 10) ───────────────────
    if fire_hotspots:
        high_conf = sum(1 for h in fire_hotspots if h.get("fire_confidence") == "high")
        if inc_type == "fire":
            score += 10
            reasons.append(
                f"Satellite confirms {len(fire_hotspots)} fire hotspot(s) at location"
                + (f" ({high_conf} high-confidence)" if high_conf else "")
            )
        else:
            score += 4
            reasons.append(f"{len(fire_hotspots)} satellite hotspot(s) detected in area")

    # ── 6. Reporter Authentication (max 10) ───────────────────────────────────
    if incident.get("reporter_id"):
        score += 10
        reasons.append("Submitted by verified registered user")

    # ── 7. Recency (max 10) ───────────────────────────────────────────────────
    ts_raw = incident.get("timestamp")
    if ts_raw:
        try:
            if isinstance(ts_raw, str):
                dt = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            else:
                dt = ts_raw
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            age_h = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
            if age_h < 1:
                score += 10
                reasons.append("Very recent report (< 1 hour ago)")
            elif age_h < 6:
                score += 7
                reasons.append(f"Recent report ({age_h:.1f} hours ago)")
            elif age_h < 24:
                score += 4
        except Exception:
            pass

    # ── 8. AI Semantic Bonus (max 5, optional Gemini component) ──────────────
    bonus = min(5, max(0, ai_semantic_bonus))
    if bonus > 0:
        score += bonus
        if ai_semantic_reasons:
            reasons.extend(ai_semantic_reasons)

    score = max(0, min(100, score))

    confidence_level = "low"
    for threshold, level in CONFIDENCE_THRESHOLDS:
        if score >= threshold:
            confidence_level = level
            break

    return {
        "trust_score": float(score),
        "confidence_level": confidence_level,
        "validation_reasons": reasons,
    }


def is_public_alert(incident: dict) -> bool:
    """Return True if this incident should generate a public alert broadcast."""
    verified = incident.get("verified", False)
    severity = incident.get("severity", "medium")
    confidence_level = incident.get("confidence_level", "low")
    trust_score = incident.get("trust_score") or 0

    return bool(
        verified
        or (severity == "critical" and confidence_level in ("high", "verified_candidate"))
        or trust_score >= 75
    )
