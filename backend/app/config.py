from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./critpath.db"
    jwt_secret: str = "development-only-change-this-secret"
    jwt_exp_minutes: int = 720
    cors_origins: str = "http://localhost:5173"
    seed_demo: bool = False
    demo_email: str = "demo@critpath.io"
    demo_password: str = "critpath-demo"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


settings = Settings()
