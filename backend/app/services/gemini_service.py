"""Gemini AI service for incident classification, alert generation,
multilingual translation, and risk summary.

Falls back to structured mock responses when GEMINI_API_KEY is not set,
so the app runs fully in demo mode without an API key.
"""
import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy-load the Gemini client so the app starts even if the package is missing
_gemini_model = None


def _get_model():
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    if not settings.GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        return _gemini_model
    except Exception as exc:
        logger.warning("Could not initialise Gemini model: %s", exc)
        return None


def _call_gemini(prompt: str) -> str:
    """Call Gemini and return the raw text response."""
    model = _get_model()
    if model is None:
        raise RuntimeError("Gemini model unavailable")
    response = model.generate_content(prompt)
    return response.text


def _safe_json(text: str) -> Any:
    """Strip markdown code fences then parse JSON. Handles multiple fence formats."""
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    if text.startswith("```"):
        parts = text.split("```")
        # parts[1] is the content between first and second fence
        if len(parts) >= 2:
            inner = parts[1]
            if inner.startswith("json"):
                inner = inner[4:]
            text = inner
    # Also handle JSON embedded after a prefix line (e.g. "Here is the JSON:\n{...}")
    brace_start = text.find("{")
    bracket_start = text.find("[")
    if brace_start > 0 or bracket_start > 0:
        start = min(
            brace_start if brace_start >= 0 else len(text),
            bracket_start if bracket_start >= 0 else len(text),
        )
        if start > 0:
            text = text[start:]
    return json.loads(text.strip())


# ── Public API ────────────────────────────────────────────────────────────────

def classify_incident(description: str, location: str = "") -> dict:
    """Return category, severity, and confidence for a free-text incident report."""
    prompt = f"""
You are an emergency management AI. Classify the following community incident report.

Incident description: "{description}"
Location (optional): "{location}"

Return ONLY valid JSON with this exact structure:
{{
  "category": "<concise incident category, e.g. 'Natural Disaster / Flooding'>",
  "severity": "<one of: critical | high | medium | low>",
  "confidence": <float 0.0-1.0>,
  "summary": "<one sentence plain-English classification rationale>",
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"]
}}
"""
    try:
        return _safe_json(_call_gemini(prompt))
    except Exception as exc:
        logger.warning("classify_incident fallback: %s", exc)
        return {
            "category": "Unclassified",
            "severity": "medium",
            "confidence": 0.5,
            "summary": "AI classification unavailable — manual review required.",
            "keywords": [],
        }


def generate_multilingual_alert(
    title: str, message_en: str, target_languages: list[str] | None = None
) -> dict:
    """Translate an alert into multiple languages.

    Returns dict keyed by ISO 639-1 language code.
    """
    if target_languages is None:
        target_languages = ["sw", "fr", "ar"]

    lang_names = {"sw": "Swahili", "fr": "French", "ar": "Arabic", "es": "Spanish"}
    langs_str = ", ".join(f"{lang_names.get(l, l)} ({l})" for l in target_languages)

    prompt = f"""
You are a multilingual emergency alert translator for East Africa.

Original English alert:
Title: "{title}"
Message: "{message_en}"

Translate this alert into these languages: {langs_str}

Return ONLY valid JSON in this format:
{{
  "en": "{message_en}",
  {", ".join(f'"{l}": "<translation in {lang_names.get(l, l)}>"' for l in target_languages)}
}}

Keep translations concise, urgent, and clear. Preserve all numbers, times, and place names.
"""
    try:
        result = _safe_json(_call_gemini(prompt))
        result["en"] = message_en
        return result
    except Exception as exc:
        logger.warning("multilingual_alert fallback: %s", exc)
        return {"en": message_en}


def get_action_recommendations(incidents: list[dict]) -> dict:
    """Generate prioritised action recommendations for a list of active incidents."""
    incident_summary = "\n".join(
        f"- [{i.get('severity','?').upper()}] {i.get('title','?')}: {i.get('description','')[:120]}"
        for i in incidents[:10]
    )

    prompt = f"""
You are an emergency response coordinator AI. Based on the active incidents below,
generate an actionable priority list for authorities.

Active incidents:
{incident_summary}

Return ONLY valid JSON with this structure:
{{
  "priority_actions": [
    {{
      "priority": 1,
      "action": "<action title>",
      "rationale": "<one sentence reason>",
      "agencies": ["<agency1>", "<agency2>"],
      "timeframe": "<e.g. Immediate / Within 1 hour / Within 6 hours>"
    }}
  ],
  "resource_needs": ["<resource1>", "<resource2>"],
  "coordination_notes": "<2-3 sentence strategic overview>"
}}

Provide 4-6 priority actions ordered by urgency.
"""
    try:
        return _safe_json(_call_gemini(prompt))
    except Exception as exc:
        logger.warning("action_recommendations fallback: %s", exc)
        return {
            "priority_actions": [
                {
                    "priority": 1,
                    "action": "Deploy emergency response teams to critical incident zones",
                    "rationale": "Multiple critical incidents require immediate personnel.",
                    "agencies": ["Kenya Red Cross", "NDMA"],
                    "timeframe": "Immediate",
                },
                {
                    "priority": 2,
                    "action": "Open overflow shelter at Ruaraka Community Church",
                    "rationale": "Primary shelter near Kibera approaching capacity.",
                    "agencies": ["Nairobi County", "UNHCR"],
                    "timeframe": "Within 1 hour",
                },
            ],
            "resource_needs": ["Medical supplies", "Emergency vehicles", "Water purification"],
            "coordination_notes": "AI recommendations unavailable — using fallback template.",
        }


def generate_risk_summary(incidents: list[dict], alerts: list[dict]) -> dict:
    """Generate a comprehensive AI risk summary of the current situation."""
    active_critical = sum(1 for i in incidents if i.get("severity") == "critical")
    active_high = sum(1 for i in incidents if i.get("severity") == "high")
    total_affected = sum(i.get("affected_count") or 0 for i in incidents)

    incident_text = "\n".join(
        f"- [{i.get('severity','?').upper()}] {i.get('title','?')} @ {i.get('location_name','?')}"
        for i in incidents
    )
    alert_text = "\n".join(f"- {a.get('title','?')}" for a in alerts)

    prompt = f"""
You are an emergency management AI generating a situation report (SITREP) for authorities.

Current situation:
- {len(incidents)} total incidents ({active_critical} critical, {active_high} high severity)
- Estimated {total_affected:,} people affected
- {len(alerts)} active public alerts

Active incidents:
{incident_text}

Active alerts:
{alert_text}

Generate a comprehensive SITREP. Return ONLY valid JSON:
{{
  "overall_risk_level": "<CRITICAL | HIGH | MEDIUM | LOW>",
  "executive_summary": "<3-4 sentence situation overview>",
  "key_threats": ["<threat1>", "<threat2>", "<threat3>"],
  "population_at_risk": <integer>,
  "incident_hotspots": ["<area1>", "<area2>"],
  "forecast": "<2-3 sentence outlook for next 6-12 hours>",
  "immediate_priorities": ["<priority1>", "<priority2>", "<priority3>"],
  "generated_at": "<ISO timestamp>"
}}
"""
    try:
        result = _safe_json(_call_gemini(prompt))
        from datetime import datetime, timezone
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        return result
    except Exception as exc:
        logger.warning("risk_summary fallback: %s", exc)
        from datetime import datetime, timezone
        return {
            "overall_risk_level": "HIGH",
            "executive_summary": (
                f"There are currently {len(incidents)} active incidents affecting an estimated "
                f"{total_affected:,} residents. The situation requires coordinated multi-agency "
                "response with priority on flood management and medical support. AI analysis is "
                "operating in fallback mode — connect Gemini API for enhanced insights."
            ),
            "key_threats": ["Flash flooding", "Medical mass casualty", "Water contamination"],
            "population_at_risk": total_affected,
            "incident_hotspots": ["Westlands", "Kibera", "Mathare"],
            "forecast": "Conditions expected to remain elevated for the next 6-8 hours. Monitor weather updates.",
            "immediate_priorities": [
                "Medical triage at Kibera market",
                "Flood barrier deployment in Westlands",
                "Water distribution in Mathare",
            ],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


def generate_alert_content(incident: dict) -> dict:
    """Generate rich alert content from an incident.

    Returns:
        title, summary, recommended_actions (list),
        evacuation_guidance, public_safety_message
    """
    inc_type = incident.get("type", "other").replace("_", " ")
    sev = incident.get("severity", "medium").upper()
    location = incident.get("location_name", "Unknown Location")

    prompt = f"""
You are an emergency management AI generating a public alert for Sentinel AI disaster response platform.

INCIDENT
  Type:        {inc_type}
  Severity:    {sev}
  Title:       {incident.get('title', '')}
  Location:    {location}
  Description: {str(incident.get('description',''))[:400]}
  Affected:    {incident.get('affected_count', 'Unknown')} people

Generate a concise, actionable emergency alert. Return ONLY valid JSON:
{{
  "title": "<short alert title — max 60 chars, UPPERCASE for critical/high>",
  "summary": "<2-3 sentence public alert summary — clear, urgent, informative>",
  "recommended_actions": ["<action1>", "<action2>", "<action3>", "<action4>"],
  "evacuation_guidance": "<1-2 sentences on evacuation routes or shelter options>",
  "public_safety_message": "<1 sentence public safety instruction — simple language>"
}}

Guidelines:
- Be direct and actionable, not bureaucratic.
- Include emergency numbers (999 in Kenya) for critical incidents.
- Avoid technical jargon — audience is general public.
- Recommended actions should be specific to this incident type.
"""
    try:
        return _safe_json(_call_gemini(prompt))
    except Exception as exc:
        logger.warning("generate_alert_content fallback: %s", exc)

    # Heuristic fallback
    type_actions = {
        "flood": [
            "Move to higher ground immediately",
            "Avoid flooded roads and low-lying areas",
            "Do not attempt to cross flooded areas on foot or by vehicle",
            "Call 999 or 0800 720 000 if you need rescue",
        ],
        "fire": [
            "Evacuate the area immediately",
            "Call Kenya Fire Brigade: 020 2222181",
            "Do not re-enter burning buildings",
            "Stay low to avoid smoke inhalation",
        ],
        "medical": [
            "Call 999 or Nairobi Ambulance: 0722 207 877",
            "Do not move injured persons unless in immediate danger",
            "Keep area clear for emergency responders",
            "Follow instructions from medical personnel on scene",
        ],
        "contamination": [
            "Do not use tap water for drinking or cooking",
            "Use bottled water only",
            "Report symptoms to nearest health facility",
            "Follow Kenya Ministry of Health advisories",
        ],
    }
    inc_key = incident.get("type", "other")
    actions = type_actions.get(inc_key, [
        f"Avoid the {location} area",
        "Follow instructions from emergency responders",
        "Monitor Sentinel AI for updates",
        "Call 999 in case of emergency",
    ])

    return {
        "title": f"{sev} ALERT — {inc_type.title()} at {location}",
        "summary": (
            f"A {sev.lower()} {inc_type} incident has been confirmed at {location}. "
            f"{incident.get('description', '')[:120]}. "
            f"Emergency services have been notified. Follow safety instructions below."
        ),
        "recommended_actions": actions,
        "evacuation_guidance": (
            f"If you are in the {location} area, evacuate immediately using main roads away from the incident. "
            f"Nearest safe assembly point will be announced by authorities."
        ),
        "public_safety_message": (
            f"Stay away from {location}. Emergency services are on scene. Call 999 if you need help."
        ),
    }


def calculate_trust(incident: dict, nearby_reports: list[dict]) -> dict:
    """Semantic trust analysis — checks report consistency and red flags.

    Returns semantic_bonus (0-5) and semantic_reasons list.
    Called optionally by the trust recalculate endpoint.
    """
    nearby_str = "\n".join(
        f"  [{r.get('severity','?').upper()}] {r.get('title','?')} — {r.get('description','')[:60]}"
        for r in nearby_reports[:3]
    ) or "  None"

    prompt = f"""
You are a trust verification analyst for an emergency incident platform.
Evaluate the semantic consistency and plausibility of this citizen report.

INCIDENT
  Type:        {incident.get('type')}
  Title:       {incident.get('title')}
  Severity:    {incident.get('severity')}
  Location:    {incident.get('location_name')}
  Description: {str(incident.get('description',''))[:400]}

NEARBY REPORTS (within 5 km / 48 h):
{nearby_str}

Score the semantic trust on a scale of 0–5:
  5 = Highly consistent, plausible, matches nearby reports
  4 = Consistent with minor gaps
  3 = Plausible but lacks detail
  2 = Some inconsistencies or vague
  1 = Implausible or significantly inconsistent
  0 = Likely false or contradicted by nearby reports

Return ONLY valid JSON:
{{
  "semantic_bonus": <int 0-5>,
  "semantic_reasons": ["<reason1>", "<reason2>"]
}}
"""
    try:
        result = _safe_json(_call_gemini(prompt))
        return {
            "semantic_bonus": max(0, min(5, int(result.get("semantic_bonus", 2)))),
            "semantic_reasons": result.get("semantic_reasons", []),
        }
    except Exception as exc:
        logger.warning("calculate_trust fallback: %s", exc)
        return {"semantic_bonus": 2, "semantic_reasons": ["AI semantic analysis unavailable — using heuristic score"]}


def analyze_with_intelligence(
    incident: dict,
    weather: dict,
    fire_hotspots: list[dict],
    nearby_obs: list[dict],
    nearby_reports: list[dict],
) -> dict:
    """
    Combined intelligence analysis using all available data sources.

    Inputs
    ------
    incident      — citizen/responder report dict
    weather       — current weather at incident location
    fire_hotspots — NASA FIRMS hotspots within 25 km
    nearby_obs    — stored observations within 25 km / 48 h
    nearby_reports — other incidents within 5 km / 48 h (corroborating reports)

    Returns
    -------
    dict with: risk_score, ai_confidence, summary, recommended_actions,
               risk_factors, corroboration_level

    CONTRACT: never sets or recommends changing incident.verified.
              Human Admin/Responder must perform verification.
    """
    rain  = weather.get("precipitation_mm", 0) or 0
    desc  = weather.get("weather_description", "unknown conditions")
    wind  = weather.get("wind_speed", 0) or 0

    fire_str = (
        f"{len(fire_hotspots)} active satellite fire hotspot(s) within 25 km "
        f"(peak FRP: {max((h.get('fire_radiative_power') or 0) for h in fire_hotspots):.1f} MW)"
        if fire_hotspots
        else "No satellite fire hotspots detected nearby"
    )

    nearby_str = "\n".join(
        f"  [{r.get('severity','?').upper()}] {r.get('title','?')} @ {r.get('location_name','?')}"
        for r in nearby_reports[:5]
    ) or "  None"

    prompt = f"""
You are an emergency intelligence analyst inside Sentinel AI, a disaster-response platform.
Analyze the following incident using ALL available environmental and corroborating data.

RULES:
- Do NOT recommend verifying the incident — only human Admin/Responder may verify.
- Base risk_score on the combined data, not just the citizen's severity claim.
- Be concise and actionable.

CITIZEN REPORT
  ID:          {incident.get('id')}
  Title:       {incident.get('title')}
  Type:        {incident.get('type')}
  Severity:    {incident.get('severity')}
  Location:    {incident.get('location_name')} ({incident.get('lat'):.4f}, {incident.get('lng'):.4f})
  Description: {str(incident.get('description',''))[:300]}
  AI Category: {incident.get('ai_category','N/A')} (conf {incident.get('ai_confidence','N/A')})

WEATHER AT INCIDENT LOCATION
  Conditions:    {desc}
  Temperature:   {weather.get('temperature','N/A')} °C
  Humidity:      {weather.get('humidity','N/A')} %
  Wind:          {wind} m/s @ {weather.get('wind_direction','N/A')}°
  Precipitation: {rain:.1f} mm/hr
  Source:        {weather.get('source','N/A')}

SATELLITE INTELLIGENCE
  {fire_str}

CORROBORATING REPORTS ({len(nearby_reports)} within 5 km / 48 h)
{nearby_str}

Return ONLY valid JSON:
{{
  "risk_score": <float 0.0-1.0>,
  "ai_confidence": <float 0.0-1.0>,
  "summary": "<3-4 sentences combining all data sources>",
  "recommended_actions": ["<action1>", "<action2>", "<action3>"],
  "risk_factors": ["<factor1>", "<factor2>", "<factor3>"],
  "corroboration_level": "<none|low|medium|high>"
}}
"""
    try:
        return _safe_json(_call_gemini(prompt))
    except Exception as exc:
        logger.warning("analyze_with_intelligence fallback: %s", exc)

    # ── Heuristic fallback ────────────────────────────────────────────────────
    sev_base = {"critical": 0.90, "high": 0.72, "medium": 0.45, "low": 0.20}
    risk = sev_base.get(incident.get("severity", "medium"), 0.45)
    risk = min(1.0, risk
               + min(0.12, rain / 100)
               + min(0.10, len(fire_hotspots) * 0.05)
               + min(0.08, len(nearby_reports) * 0.03))

    corr = (
        "high"   if len(nearby_reports) >= 3 else
        "medium" if len(nearby_reports) >= 1 else
        "none"
    )

    actions = [
        f"Dispatch assessment team to {incident.get('location_name', 'incident site')}",
        f"Monitor {desc} — current precipitation {rain:.1f} mm/hr",
    ]
    if fire_hotspots:
        actions.append("Alert fire response units — active satellite hotspots detected nearby")
    else:
        actions.append("Maintain situational awareness and update status as conditions evolve")

    factors = [f"Reported severity: {incident.get('severity','?').upper()}", f"Weather: {desc} ({rain:.1f} mm/hr)"]
    if fire_hotspots:
        factors.append(f"Satellite hotspot(s) detected within 25 km")
    if len(nearby_reports) >= 2:
        factors.append("Multiple corroborating citizen reports")

    return {
        "risk_score":           round(risk, 3),
        "ai_confidence":        0.68,
        "summary": (
            f"Incident at {incident.get('location_name','unknown')} classified as "
            f"{incident.get('severity','?')} severity ({incident.get('type','?').replace('_',' ')}). "
            f"Weather shows {desc} with {rain:.1f} mm/hr precipitation"
            f"{' — elevated flood risk.' if rain > 5 else '.'} "
            f"{'Satellite data: ' + fire_str + '.' if fire_hotspots else ''} "
            f"{'Corroborated by ' + str(len(nearby_reports)) + ' nearby report(s).' if nearby_reports else 'No corroborating reports found.'}"
        ).strip(),
        "recommended_actions":  actions,
        "risk_factors":         factors,
        "corroboration_level":  corr,
    }
