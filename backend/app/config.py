from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    app_name: str = "Relief.AI Backend"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "CHANGE_ME_SECRET"  # override in .env
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    # Database
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_user: str = "relief"
    postgres_password: str = "relief_password"
    postgres_db: str = "relief"

    # CORS
    backend_cors_origins: List[AnyHttpUrl] | List[str] = []

    # SMS / external
    sms_webhook_secret: str = "CHANGE_ME_SMS_SECRET"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
