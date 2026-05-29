"""
Application configuration module.
Loads settings from environment variables with sensible defaults.
"""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Model Configuration
    # MODEL_TYPE: "qwen" or "hunyuan"
    # DEPLOYMENT_TYPE: "local" (Ollama) or "cloud" (Cloud API)
    MODEL_TYPE: str = "qwen"
    DEPLOYMENT_TYPE: str = "local"

    # ---- Local Deployment (Ollama) ----
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    # Ollama model name for Qwen local
    OLLAMA_MODEL_QWEN: str = "qwen2.5vl:7b"
    # Ollama model name for Hunyuan local
    OLLAMA_MODEL_HUNYUAN: str = "hunyuan:latest"

    # ---- Cloud Deployment: Tencent Hunyuan ----
    HUNYUAN_SECRET_ID: str = ""
    HUNYUAN_SECRET_KEY: str = ""
    HUNYUAN_HOST: str = "hunyuan.tencentcloudapi.com"
    HUNYUAN_SERVICE: str = "hunyuan"
    HUNYUAN_REGION: str = "ap-guangzhou"
    HUNYUAN_ACTION: str = "ChatCompletions"
    HUNYUAN_VERSION: str = "2023-09-01"
    HUNYUAN_MODEL: str = "hunyuan-vision"
    # 纯文本场景使用的混元模型（八字/星座/宜忌/运势分数等无图任务）。
    # hunyuan-vision 仅适合带图调用，纯文本调用容易触发 InvalidParameter。
    HUNYUAN_TEXT_MODEL: str = "hunyuan-turbo"

    # ---- Cloud Deployment: Qwen (DashScope / compatible API) ----
    QWEN_CLOUD_API_KEY: str = ""
    QWEN_CLOUD_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_CLOUD_MODEL: str = "qwen-vl-max"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./palmistry.db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # 并发控制
    MAX_CONCURRENT_REQUESTS: int = 256
    UVICORN_WORKERS: int = 4

    # Upload
    UPLOAD_DIR: str = "./static/uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:8000"]

    # ---- 掌纹识别服务 1:N 接口配置（Bearer Token 鉴权） ----
    # 替换为你的刷掌算法服务网址和路径
    PALM_API_BASE_URL: str = "https://your-palm-api-host.example.com"
    PALM_API_BEARER_TOKEN: str = ""
    PALM_REGISTER_PATH: str = "/your-palm-register-api-path"
    PALM_SEARCH_PATH: str = "/your-palm-search-api-path"
    PALM_API_TIMEOUT: int = 15

    # ---- 旧协议字段（已废弃，保留仅为向后兼容） ----
    PALM_API_APP_ID: str = ""
    PALM_API_SECRET_ID: str = ""
    PALM_API_SECRET_KEY: str = ""

    model_config = {
        "env_file": str(Path(__file__).resolve().parents[4] / ".env"),
        "env_file_encoding": "utf-8",
        # 兼容 .env 中未来新增的字段，避免 extra_forbidden 报错
        "extra": "ignore",
    }

    @property
    def active_ollama_model(self) -> str:
        """Return the Ollama model name based on MODEL_TYPE (for local deployment)."""
        if self.MODEL_TYPE == "hunyuan":
            return self.OLLAMA_MODEL_HUNYUAN
        return self.OLLAMA_MODEL_QWEN

    @property
    def model_display_name(self) -> str:
        """Human-readable description of current model configuration."""
        return f"{self.MODEL_TYPE} ({self.DEPLOYMENT_TYPE})"


settings = Settings()

# Ensure upload directory exists
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)