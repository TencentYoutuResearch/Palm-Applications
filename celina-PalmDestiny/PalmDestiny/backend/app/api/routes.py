"""
API routes for palm reading endpoints.
"""

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    ErrorResponse,
    HealthResponse,
    ReadingListResponse,
    ReadingResponse,
)
from app.core.config import settings
from app.core.database import get_db
from app.services.model_factory import model_factory
from app.services.reading_service import palm_reading_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check system health and model availability."""
    model_ok = await model_factory.check_health()
    return HealthResponse(
        status="healthy" if model_ok else "degraded",
        model_available=model_ok,
        model_type=settings.MODEL_TYPE,
        deployment_type=settings.DEPLOYMENT_TYPE,
        model_name=settings.model_display_name,
    )


@router.post(
    "/readings",
    response_model=ReadingResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    tags=["Palm Reading"],
    summary="Upload palm image and get reading",
)
async def create_reading(
    file: UploadFile = File(..., description="Palm image file (JPG/PNG/WebP)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a palm image and receive a comprehensive palmistry reading.

    The pipeline:
    1. Image preprocessing (contrast enhancement, binarization)
    2. Computer vision feature extraction (line detection, density analysis)
    3. Multimodal model visual description
    4. Traditional palmistry interpretation

    **Supported formats**: JPG, JPEG, PNG, WebP, BMP
    **Max file size**: 10MB
    **Recommended resolution**: 512x512 ~ 1024x1024 pixels
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTENSIONS}",
        )

    # Validate file size
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    # Save uploaded file
    file_id = str(uuid.uuid4())
    save_path = Path(settings.UPLOAD_DIR) / f"{file_id}{ext}"
    save_path.parent.mkdir(parents=True, exist_ok=True)

    with open(save_path, "wb") as f:
        f.write(content)

    # Execute the full palm reading pipeline
    try:
        record = await palm_reading_service.create_reading(str(save_path), db)
        return ReadingResponse.model_validate(record)
    except Exception as e:
        logger.error(f"Reading pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reading failed: {str(e)}")


@router.get(
    "/readings/{reading_id}",
    response_model=ReadingResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["Palm Reading"],
    summary="Get reading by ID",
)
async def get_reading(reading_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve a palm reading result by its ID."""
    record = await palm_reading_service.get_reading(reading_id, db)
    if not record:
        raise HTTPException(status_code=404, detail="Reading not found")
    return ReadingResponse.model_validate(record)


@router.get(
    "/readings",
    response_model=ReadingListResponse,
    tags=["Palm Reading"],
    summary="List recent readings",
)
async def list_readings(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List recent palm readings with pagination."""
    items = await palm_reading_service.list_readings(db, skip=skip, limit=limit)
    return ReadingListResponse(
        total=len(items),
        items=[ReadingResponse.model_validate(r) for r in items],
    )
