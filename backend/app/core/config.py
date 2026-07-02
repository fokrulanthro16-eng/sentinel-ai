from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Sentinel AI: Community ActionGrid"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # External intelligence providers (all optional — app runs in mock mode without them)
    OPENWEATHER_API_KEY: str = ""   # https://openweathermap.org/api
    NASA_FIRMS_API_KEY:  str = ""   # https://firms.modaps.eosdis.nasa.gov/api/
    # NASA POWER is a free API — no key required

    # Database — leave empty to use in-memory mock store
    DATABASE_URL: str = ""

    # Redis — leave empty for single-instance mode
    REDIS_URL: str = ""

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # SMS (leave blank → mock mode)
    SMS_GATEWAY_URL: str = ""
    SMS_API_KEY: str = ""

    # Email (leave blank → mock mode)
    EMAIL_SMTP_HOST: str = ""
    EMAIL_SMTP_PORT: int = 587
    EMAIL_SMTP_USER: str = ""
    EMAIL_SMTP_PASS: str = ""
    EMAIL_FROM: str = "alerts@sentinel-ai.ke"

    # WhatsApp Cloud API (leave blank → mock mode)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
