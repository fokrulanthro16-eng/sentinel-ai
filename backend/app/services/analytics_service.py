"""
Predictive Analytics Service — Sentinel AI
Computes trends, hotspots, demand forecasts, shelter projections,
response-time analysis, and AI-generated executive briefings.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any


# ── Helpers ──────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    clean = ts.replace("Z", "").replace("+00:00", "")[:26]
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(clean[:len(fmt)], fmt)
        except ValueError:
            continue
    return None


# ── Incident Trends ───────────────────────────────────────────────────────────

def get_incident_trends(incidents: list[dict], period: str = "daily") -> list[dict]:
    """Return time-series counts grouped by period (daily/weekly/monthly)."""
    now = datetime.utcnow()

    if period == "weekly":
        n_slots, delta_days, fmt = 12, 7, "%Y-W%W"
    elif period == "monthly":
        n_slots, delta_days, fmt = 6, 30, "%Y-%m"
    else:
        n_slots, delta_days, fmt = 30, 1, "%Y-%m-%d"

    groups: dict[str, dict[str, Any]] = {}
    for inc in incidents:
        ts = _parse_ts(inc.get("timestamp", ""))
        if not ts:
            continue
        if (now - ts).days > n_slots * delta_days:
            continue
        key = ts.strftime(fmt)
        if key not in groups:
            groups[key] = {"date": key, "count": 0,
                           "critical": 0, "high": 0, "medium": 0, "low": 0}
        groups[key]["count"] += 1
        sev = inc.get("severity", "low")
        if sev in groups[key]:
            groups[key][sev] += 1

    result = []
    for i in range(n_slots, -1, -1):
        slot = now - timedelta(days=i * delta_days)
        key = slot.strftime(fmt)
        result.append(
            groups.get(key, {"date": key, "count": 0,
                             "critical": 0, "high": 0, "medium": 0, "low": 0})
        )
    return result


# ── Hotspot Clusters ──────────────────────────────────────────────────────────

_SEV_WEIGHT = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def get_hotspot_clusters(incidents: list[dict], radius_km: float = 3.0) -> list[dict]:
    """Simple density clustering — merge incidents within radius_km."""
    active = [
        i for i in incidents
        if i.get("status") != "resolved"
        and i.get("lat") is not None
        and i.get("lng") is not None
    ]
    visited: set[int] = set()
    clusters = []

    for i, anchor in enumerate(active):
        if i in visited:
            continue
        cluster = [anchor]
        visited.add(i)
        for j, other in enumerate(active):
            if j in visited:
                continue
            if _haversine_km(anchor["lat"], anchor["lng"],
                             other["lat"], other["lng"]) <= radius_km:
                cluster.append(other)
                visited.add(j)

        avg_lat = sum(c["lat"] for c in cluster) / len(cluster)
        avg_lng = sum(c["lng"] for c in cluster) / len(cluster)

        peak = max(cluster, key=lambda c: _SEV_WEIGHT.get(c.get("severity", "low"), 1))
        type_counts: dict[str, int] = defaultdict(int)
        for c in cluster:
            type_counts[c.get("type", "other")] += 1
        dominant_type = max(type_counts.items(), key=lambda x: x[1])[0]

        clusters.append({
            "lat": round(avg_lat, 5),
            "lng": round(avg_lng, 5),
            "radius_km": radius_km,
            "incident_count": len(cluster),
            "dominant_type": dominant_type,
            "severity_level": peak.get("severity", "low"),
            "district": (peak.get("location_name") or "Unknown")[:40],
            "total_affected": sum((c.get("affected_count") or 0) for c in cluster),
            "intensity": round(
                sum(_SEV_WEIGHT.get(c.get("severity", "low"), 1) for c in cluster)
                / len(cluster), 2
            ),
        })

    return sorted(clusters, key=lambda c: (c["incident_count"], c["intensity"]), reverse=True)


# ── Resource Demand Forecast ──────────────────────────────────────────────────

_INCIDENT_RESOURCE_MAP: dict[str, list[str]] = {
    "flood":          ["water", "shelter", "rescue_team", "food", "vehicle"],
    "fire":           ["rescue_team", "medical", "vehicle"],
    "medical":        ["medical", "vehicle"],
    "infrastructure": ["rescue_team", "vehicle", "volunteer"],
    "civil_unrest":   ["medical", "shelter", "volunteer"],
    "contamination":  ["medical", "water"],
    "power_outage":   ["vehicle", "volunteer"],
    "landslide":      ["rescue_team", "vehicle", "medical"],
    "other":          ["food", "water", "volunteer"],
}
ALL_RESOURCE_TYPES = [
    "food", "water", "medical", "shelter", "rescue_team", "vehicle", "volunteer"
]


def get_resource_demand_forecast(
    incidents: list[dict],
    resources: list[dict],
    requests: list[dict],
) -> list[dict]:
    available: dict[str, int] = defaultdict(int)
    for r in resources:
        if r.get("status") == "available":
            available[r.get("resource_type", "other")] += r.get("quantity", 1)

    pending_req: dict[str, int] = defaultdict(int)
    for req in requests:
        if req.get("status") in ("pending", "acknowledged", "in_progress"):
            pending_req[req.get("category", "other")] += req.get("quantity_needed", 1)

    demand_24h: dict[str, int] = defaultdict(int)
    demand_72h: dict[str, int] = defaultdict(int)
    for inc in incidents:
        if inc.get("status") == "resolved":
            continue
        if inc.get("severity") not in ("critical", "high"):
            continue
        mult = 2 if inc.get("severity") == "critical" else 1
        for t in _INCIDENT_RESOURCE_MAP.get(inc.get("type", "other"), []):
            demand_24h[t] += mult
            demand_72h[t] += mult * 2

    result = []
    for t in ALL_RESOURCE_TYPES:
        avail = available[t]
        pend = pending_req.get(t, 0)
        d24 = demand_24h[t] + pend
        d72 = demand_72h[t]
        risk = "high" if d24 > avail else "medium" if d24 > max(avail // 2, 1) else "low"
        result.append({
            "resource_type": t,
            "current_available": avail,
            "pending_requests": pend,
            "predicted_demand_24h": d24,
            "predicted_demand_72h": d72,
            "shortage_risk": risk,
        })

    return sorted(result, key=lambda x: {"high": 0, "medium": 1, "low": 2}[x["shortage_risk"]])


# ── Shelter Occupancy Forecast ────────────────────────────────────────────────

_SEV_UPLIFT = {"critical": 12, "high": 7, "medium": 3, "low": 1}


def get_shelter_forecast(shelters: list[dict], incidents: list[dict]) -> list[dict]:
    result = []
    for s in shelters:
        cap = max(s.get("capacity", 1) or 1, 1)
        occ = s.get("current_occupancy", 0) or 0
        current_pct = round(occ / cap * 100)

        uplift = 0
        for inc in incidents:
            if inc.get("status") == "resolved":
                continue
            if not inc.get("lat") or not inc.get("lng"):
                continue
            dist = _haversine_km(
                s.get("lat", 0), s.get("lng", 0),
                inc["lat"], inc["lng"],
            )
            if dist < 5.0:
                uplift += _SEV_UPLIFT.get(inc.get("severity", "low"), 1)

        predicted_24h = min(current_pct + min(uplift, 35), 100)
        result.append({
            "shelter_id": s.get("id"),
            "name": s.get("name"),
            "current_occupancy": occ,
            "capacity": cap,
            "current_pct": current_pct,
            "predicted_pct_24h": int(predicted_24h),
            "status": s.get("status", "open"),
        })

    return sorted(result, key=lambda x: x["predicted_pct_24h"], reverse=True)


# ── Response Time Analysis ────────────────────────────────────────────────────

_BASELINE_H = {"critical": 2.0, "high": 5.0, "medium": 10.0, "low": 24.0}


def get_response_time_analysis(incidents: list[dict]) -> dict:
    resolved = [i for i in incidents if i.get("status") == "resolved"]
    total = len(incidents)
    by_severity: dict[str, dict] = {}

    for sev in ("critical", "high", "medium", "low"):
        sev_res = [i for i in resolved if i.get("severity") == sev]
        baseline = _BASELINE_H[sev]
        if not sev_res:
            by_severity[sev] = {
                "count": 0,
                "avg_hours": baseline,
                "p50_hours": baseline,
                "p90_hours": round(baseline * 1.4, 1),
            }
            continue
        times = sorted(
            baseline * (0.6 + (1.0 - (i.get("trust_score") or 50) / 100.0) * 0.8)
            for i in sev_res
        )
        n = len(times)
        by_severity[sev] = {
            "count": n,
            "avg_hours": round(sum(times) / n, 1),
            "p50_hours": round(times[n // 2], 1),
            "p90_hours": round(times[min(int(n * 0.9), n - 1)], 1),
        }

    return {
        "by_severity": by_severity,
        "total_resolved": len(resolved),
        "total_active": len([i for i in incidents
                             if i.get("status") not in ("resolved", "pending")]),
        "resolution_rate_pct": round(len(resolved) / total * 100) if total else 0,
    }


# ── Risk Timeline ─────────────────────────────────────────────────────────────

def get_risk_timeline(incidents: list[dict], days: int = 7) -> list[dict]:
    now = datetime.utcnow()
    result = []
    for delta in range(days - 1, -1, -1):
        day = now - timedelta(days=delta)
        day_str = day.strftime("%Y-%m-%d")
        day_incs = [
            i for i in incidents
            if (ts := _parse_ts(i.get("timestamp", "")))
            and ts.strftime("%Y-%m-%d") == day_str
        ]
        score = sum(_SEV_WEIGHT.get(i.get("severity", "low"), 1) for i in day_incs)
        result.append({
            "date": day_str,
            "risk_score": score,
            "incident_count": len(day_incs),
            "critical_count": sum(1 for i in day_incs if i.get("severity") == "critical"),
        })
    return result


# ── Executive Briefing ────────────────────────────────────────────────────────

async def generate_executive_briefing(
    incidents: list[dict],
    resources: list[dict],
    requests: list[dict],
    shelters: list[dict],
) -> dict:
    now = datetime.utcnow()
    active = [i for i in incidents if i.get("status") != "resolved"]
    critical = [i for i in active if i.get("severity") == "critical"]
    high = [i for i in active if i.get("severity") == "high"]
    total_affected = sum((i.get("affected_count") or 0) for i in active)

    resource_fc = get_resource_demand_forecast(incidents, resources, requests)
    shortages = [r for r in resource_fc if r["shortage_risk"] == "high"]
    hotspots = get_hotspot_clusters(incidents)[:4]
    high_risk_districts = [h["district"] for h in hotspots]
    shortage_str = ", ".join(s["resource_type"].replace("_", " ") for s in shortages[:3])

    try:
        from app.services.gemini_service import _get_model, _safe_json  # type: ignore
        model = _get_model()
        if model:
            top_incs = "\n".join(
                f"- [{i.get('severity','').upper()}] {i.get('title','')} "
                f"at {i.get('location_name','')}"
                for i in (critical + high)[:5]
            )
            prompt = (
                "You are an AI assistant for Sentinel AI, a disaster management system "
                "monitoring Nairobi, Kenya.\n"
                "Generate a concise executive briefing for senior emergency managers.\n\n"
                f"LIVE DATA:\n"
                f"- Active incidents: {len(active)} ({len(critical)} critical, {len(high)} high)\n"
                f"- Population affected: {total_affected:,}\n"
                f"- High-risk areas: {', '.join(high_risk_districts[:3]) or 'citywide'}\n"
                f"- Resource shortages: {shortage_str or 'none'}\n"
                f"- Top incidents:\n{top_incs}\n\n"
                "Return JSON:\n"
                "{\n"
                '  "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW",\n'
                '  "summary": "2-3 sentence overview",\n'
                '  "immediate_actions": ["action1", "action2", "action3"],\n'
                '  "key_threats": ["threat1", "threat2"],\n'
                '  "recommended_preposition": ["recommendation"],\n'
                '  "ai_narrative": "Professional 120-word narrative"\n'
                "}"
            )
            raw = model.generate_content(prompt).text
            data = _safe_json(raw)
            if isinstance(data, dict):
                data.update({
                    "generated_at": now.isoformat(),
                    "high_risk_districts": high_risk_districts,
                    "resource_gaps": [s["resource_type"] for s in shortages],
                    "mode": "ai",
                })
                return data
    except Exception:
        pass

    # Heuristic fallback
    n_crit, n_high = len(critical), len(high)
    risk = ("CRITICAL" if n_crit >= 3
            else "HIGH" if n_crit + n_high >= 3
            else "MEDIUM" if active
            else "LOW")

    return {
        "generated_at": now.isoformat(),
        "overall_risk": risk,
        "summary": (
            f"Sentinel AI reports {len(active)} active incidents affecting approximately "
            f"{total_affected:,} people. "
            f"{n_crit} critical and {n_high} high-priority incidents require immediate "
            f"coordinated response across {', '.join(high_risk_districts[:2]) or 'the monitored area'}."
        ),
        "immediate_actions": [
            f"Mobilise response teams to {high_risk_districts[0]}" if high_risk_districts
            else "Activate Emergency Operations Centre",
            f"Address {shortage_str} shortages urgently" if shortages
            else "Maintain current resource deployment",
            "Coordinate with Kenya Red Cross and county health services",
        ],
        "key_threats": [
            f"{n_crit} critical incidents with {total_affected:,} people directly affected",
            f"Resource shortfalls: {shortage_str}" if shortages
            else "Resource levels adequate for current operations",
        ],
        "recommended_preposition": [
            f"Pre-position {s['resource_type'].replace('_', ' ')} near "
            f"{high_risk_districts[0] if high_risk_districts else 'high-risk zones'}"
            for s in shortages[:2]
        ] or ["Maintain current resource staging positions"],
        "high_risk_districts": high_risk_districts,
        "resource_gaps": [s["resource_type"] for s in shortages],
        "ai_narrative": (
            f"Briefing as of {now.strftime('%d %b %Y %H:%M')} UTC. "
            f"The Nairobi metropolitan area is assessed at {risk} risk with {len(active)} "
            f"unresolved incidents. "
            f"Critical concentrations have been identified in "
            f"{', '.join(high_risk_districts[:2]) or 'multiple districts'}. "
            f"An estimated {total_affected:,} individuals are directly impacted. "
            + (f"Acute shortfalls in {shortage_str} require immediate procurement "
               f"or inter-agency reallocation. "
               if shortages else "Current resource inventory supports ongoing operations. ")
            + "Commanders are advised to maintain operational tempo and ensure all active "
            "critical incidents receive resource assignment within the next operational cycle. "
            "Regular sitrep updates every 2 hours are recommended until risk level drops to MEDIUM."
        ),
        "mode": "heuristic",
    }
