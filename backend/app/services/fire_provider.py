"""NASA FIRMS-compatible fire hotspot provider.

Live data requires a NASA FIRMS API key (free registration):
  https://firms.modaps.eosdis.nasa.gov/api/

Falls back to two realistic mock hotspots when NASA_FIRMS_API_KEY is absent
or when the upstream request fails.
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)


class FireProvider:

    FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

    def get_hotspots(
        self,
        lat: float,
        lng: float,
        radius_km: float = 25.0,
    ) -> list[dict]:
        if settings.NASA_FIRMS_API_KEY:
            try:
                return self._fetch_firms(lat, lng, radius_km)
            except Exception as exc:
                logger.warning("NASA FIRMS failed — falling back to mock: %s", exc)
        return self._mock(lat, lng)

    # ── Live ──────────────────────────────────────────────────────────────────

    def _fetch_firms(
        self, lat: float, lng: float, radius_km: float
    ) -> list[dict]:
        import httpx
        delta = radius_km / 111.0
        west, east   = lng - delta, lng + delta
        south, north = lat - delta, lat + delta
        url = (
            f"{self.FIRMS_BASE}/{settings.NASA_FIRMS_API_KEY}/MODIS_NRT/"
            f"{west},{south},{east},{north}/1"
        )
        resp = httpx.get(url, timeout=20)
        resp.raise_for_status()
        reader  = csv.DictReader(io.StringIO(resp.text))
        results: list[dict] = []
        for row in reader:
            try:
                results.append({
                    "source":               "nasa_firms",
                    "provider_type":        "fire_hotspot",
                    "lat":                  float(row["latitude"]),
                    "lng":                  float(row["longitude"]),
                    "fire_radiative_power": float(row.get("frp", 0)),
                    "brightness":           float(row.get("brightness", 0)),
                    "fire_confidence":      str(row.get("confidence", "nominal")).lower(),
                    "observed_at":          datetime.now(timezone.utc).isoformat(),
                })
            except (ValueError, KeyError):
                continue
        return results

    # ── Mock ──────────────────────────────────────────────────────────────────

    def _mock(self, lat: float, lng: float) -> list[dict]:
        """Two mock hotspots: one near Kibera (high confidence), one NW Nairobi (nominal)."""
        now = datetime.now(timezone.utc)
        return [
            {
                "source":               "mock_firms",
                "provider_type":        "fire_hotspot",
                "lat":                  -1.3167,   # Kibera area
                "lng":                  36.7845,
                "fire_radiative_power": 58.7,
                "brightness":           319.2,
                "fire_confidence":      "high",
                "observed_at":          (now - timedelta(hours=1, minutes=22)).isoformat(),
            },
            {
                "source":               "mock_firms",
                "provider_type":        "fire_hotspot",
                "lat":                  -1.2480,   # Limuru Road area
                "lng":                  36.7542,
                "fire_radiative_power": 22.4,
                "brightness":           304.1,
                "fire_confidence":      "nominal",
                "observed_at":          (now - timedelta(hours=3, minutes=45)).isoformat(),
            },
        ]


fire_provider = FireProvider()
