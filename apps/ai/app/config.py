"""Cấu hình service — đọc từ env (.env cạnh apps/ai)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ai_mock: bool = True
    openai_api_key: str = ""
    # Cùng một model cho mọi việc, như demo onemoretime đang chạy thật.
    # Đừng đổi sang gpt-5: đo 19/08 cho thấy một lượt gợi ý quà mất 78s so với
    # ~10s của luna, và toàn bộ độ trễ người dùng thấy nằm ở call này.
    model_analysis: str = "gpt-5.6-luna"
    model_suggest: str = "gpt-5.6-luna"
    host: str = "127.0.0.1"
    port: int = 8000
    internal_token: str = ""


@lru_cache
def settings() -> Settings:
    return Settings()
