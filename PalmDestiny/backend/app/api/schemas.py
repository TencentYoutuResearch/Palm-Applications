"""
Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class ReadingResponse(BaseModel):
    """Response schema for a palm reading result."""

    id: str
    status: str
    image_path: str | None = None
    preprocessed_path: str | None = None

    # CV features
    life_line_score: float | None = None
    head_line_score: float | None = None
    heart_line_score: float | None = None
    fate_line_detected: str | None = None
    cv_features_json: str | None = None

    # Model outputs
    vl_description: str | None = None
    reading_result: str | None = None

    # Metadata
    processing_time_ms: float | None = None
    error_message: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReadingListResponse(BaseModel):
    """Paginated list of readings."""

    total: int
    items: list[ReadingResponse]


class HealthResponse(BaseModel):
    """Health check response - model agnostic."""

    status: str
    model_available: bool
    model_type: str
    deployment_type: str
    model_name: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str
    error_code: str | None = None
