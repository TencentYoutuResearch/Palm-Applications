"""
Model factory for selecting between Qwen and Hunyuan models with local/cloud deployment options.
Provides unified interface for all model deployment combinations.

Supported combinations:
  - qwen   + local  -> OllamaClient (Qwen2.5-VL via Ollama)
  - qwen   + cloud  -> QwenCloudClient (DashScope API)
  - hunyuan + local  -> OllamaClient (Hunyuan via Ollama)
  - hunyuan + cloud  -> HunyuanClient (Tencent Cloud API)
"""

from loguru import logger

from app.core.config import settings


class ModelFactory:
    """Factory class for model service selection with deployment type support.

    The client is resolved once at startup and cached for the lifetime of the process.
    """

    def __init__(self):
        self.model_type = settings.MODEL_TYPE
        self.deployment_type = settings.DEPLOYMENT_TYPE
        self._client = None

    def get_client(self):
        """Get the appropriate model client based on configuration.

        Lazy-loads and caches the client instance so heavy imports only happen
        for the combination that is actually used.
        """
        if self._client is not None:
            return self._client

        if self.deployment_type == "local":
            from app.services.ollama_client import ollama_client
            self._client = ollama_client

        elif self.model_type == "qwen" and self.deployment_type == "cloud":
            from app.services.qwen_cloud_client import qwen_cloud_client
            self._client = qwen_cloud_client

        elif self.model_type == "hunyuan" and self.deployment_type == "cloud":
            from app.services.hunyuan_client import hunyuan_client
            self._client = hunyuan_client

        else:
            raise ValueError(
                f"Unsupported model/deployment combination: "
                f"{self.model_type}/{self.deployment_type}. "
                f"MODEL_TYPE must be 'qwen' or 'hunyuan', "
                f"DEPLOYMENT_TYPE must be 'local' or 'cloud'."
            )

        return self._client

    async def check_health(self) -> bool:
        """Check health of the selected model service."""
        client = self.get_client()
        return await client.check_health()

    async def describe_palm_image(self, image_path: str) -> str:
        """Send palm image for description using selected model."""
        client = self.get_client()
        return await client.describe_palm_image(image_path)

    async def generate_reading(self, vl_description: str, cv_features: dict) -> str:
        """Generate palmistry reading using selected model."""
        client = self.get_client()
        return await client.generate_reading(vl_description, cv_features)


# Global factory instance
model_factory = ModelFactory()