"""OpenWeatherMap-compatible current weather provider.

Degrades gracefully to a structured mock response when OPENWEATHER_API_KEY
is absent or when the upstream API request fails.
Mock values are calibrated to Nairobi long-rains season conditions.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)


class WeatherProvider:

    def get_current(self, lat: float, lng: float) -> dict:
        if settings.OPENWEATHER_API_KEY:
            try:
                return self._fetch_owm(lat, lng)
            except Exception as exc:
                logger.warning("OpenWeatherMap failed — falling back to mock: %s", exc)
        return self._mock(lat, lng)

    # ── Live ──────────────────────────────────────────────────────────────────

    def _fetch_owm(self, lat: float, lng: float) -> dict:
        import httpx
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lng}"
            f"&appid={settings.OPENWEATHER_API_KEY}&units=metric"
        )
        d = httpx.get(url, timeout=10).raise_for_status().json()
        return {
            "source":               "openweathermap",
            "provider_type":        "weather",
            "lat":                  lat,
            "lng":                  lng,
            "temperature":          d["main"]["temp"],
            "humidity":             float(d["main"]["humidity"]),
            "wind_speed":           d["wind"]["speed"],
            "wind_direction":       float(d["wind"].get("deg", 0)),
            "precipitation_mm":     d.get("rain", {}).get("1h", 0.0),
            "weather_code":         d["weather"][0]["id"],
            "weather_description":  d["weather"][0]["description"].capitalize(),
            "observed_at":          datetime.now(timezone.utc).isoformat(),
            "raw_data":             d,
        }

    # ── Mock ──────────────────────────────────────────────────────────────────

    def _mock(self, lat: float, lng: float) -> dict:
        return {
            "source":               "mock_weather",
            "provider_type":        "weather",
            "lat":                  lat,
            "lng":                  lng,
            "temperature":          21.6,
            "humidity":             82.0,
            "wind_speed":           4.8,
            "wind_direction":       155.0,   # SSE — typical Nairobi trade wind
            "precipitation_mm":     14.2,    # active moderate rainfall
            "weather_code":         501,
            "weather_description":  "Moderate rain",
            "observed_at":          datetime.now(timezone.utc).isoformat(),
            "raw_data":             None,
        }


weather_provider = WeatherProvider()
