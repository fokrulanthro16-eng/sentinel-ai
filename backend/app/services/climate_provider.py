"""NASA POWER-compatible climate data provider.

NASA POWER is a free API (no key required):
  https://power.larc.nasa.gov/api/temporal/daily/point

Falls back to mock when the request fails or times out.
Mock values are calibrated to Nairobi's typical rainy-season climate.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class ClimateProvider:

    BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
    PARAMS   = "T2M,RH2M,WS10M,PRECTOTCORR,ALLSKY_SFC_SW_DWN"

    def get_climate(self, lat: float, lng: float) -> dict:
        try:
            result = self._fetch_power(lat, lng)
            # Fall back to mock if NASA POWER returned all fill values (data lag)
            key_fields = ("temperature", "humidity", "wind_speed", "precipitation_mm", "solar_irradiance")
            if all(result.get(f) is None for f in key_fields):
                logger.info("NASA POWER returned all fill values — falling back to mock")
                return self._mock(lat, lng)
            return result
        except Exception as exc:
            logger.warning("NASA POWER failed — falling back to mock: %s", exc)
        return self._mock(lat, lng)

    # ── Live ──────────────────────────────────────────────────────────────────

    def _fetch_power(self, lat: float, lng: float) -> dict:
        import httpx
        today = datetime.now(timezone.utc)
        start = (today - timedelta(days=7)).strftime("%Y%m%d")
        end   = today.strftime("%Y%m%d")
        url   = (
            f"{self.BASE_URL}"
            f"?parameters={self.PARAMS}"
            f"&community=RE&longitude={lng}&latitude={lat}"
            f"&start={start}&end={end}&format=JSON"
        )
        data  = httpx.get(url, timeout=30).raise_for_status().json()
        props = data.get("properties", {}).get("parameter", {})

        def latest(key: str) -> float | None:
            vals = props.get(key, {})
            v = list(vals.values())[-1] if vals else None
            # NASA POWER uses -999 as a fill value for missing/unavailable data
            return None if (v is None or v < -900) else v

        return {
            "source":           "nasa_power",
            "provider_type":    "climate",
            "lat":              lat,
            "lng":              lng,
            "temperature":      latest("T2M"),
            "humidity":         latest("RH2M"),
            "wind_speed":       latest("WS10M"),
            "precipitation_mm": latest("PRECTOTCORR"),
            "solar_irradiance": latest("ALLSKY_SFC_SW_DWN"),
            "soil_moisture":    None,  # not in free POWER tier
            "observed_at":      datetime.now(timezone.utc).isoformat(),
            "raw_data":         None,  # large payload omitted
        }

    # ── Mock ──────────────────────────────────────────────────────────────────

    def _mock(self, lat: float, lng: float) -> dict:
        return {
            "source":           "mock_nasa_power",
            "provider_type":    "climate",
            "lat":              lat,
            "lng":              lng,
            "temperature":      20.8,
            "humidity":         79.0,
            "wind_speed":       3.9,
            "precipitation_mm": 11.3,
            "solar_irradiance": 142.5,   # W/m² — overcast Nairobi
            "soil_moisture":    0.38,    # m³/m³ — post-rain saturated
            "observed_at":      datetime.now(timezone.utc).isoformat(),
            "raw_data":         None,
        }


climate_provider = ClimateProvider()
