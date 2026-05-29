"""
Core palm reading service.
Orchestrates the full pipeline: upload -> preprocess -> CV extract -> VL describe -> reading.
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.reading import PalmReading
from app.services.model_factory import model_factory
from app.utils.image_processing import extract_palm_features, preprocess_palm_image

# 线程池用于 CPU 密集型的 OpenCV 操作
_cv_executor = ThreadPoolExecutor(max_workers=8)


class PalmReadingService:
    """Orchestrates the palm reading pipeline."""

    @staticmethod
    async def create_reading(image_path: str, db: AsyncSession) -> PalmReading:
        """
        Full pipeline: preprocess -> feature extraction -> VL description -> reading.

        Args:
            image_path: Path to the uploaded palm image.
            db: Async database session.

        Returns:
            PalmReading record with all results populated.
        """
        start_time = time.time()

        # 创建数据库记录
        record = PalmReading(image_path=image_path, status="processing")
        db.add(record)
        await db.commit()
        await db.refresh(record)

        try:
            import asyncio

            loop = asyncio.get_event_loop()

            # Step 1: 图像预处理 (CPU-bound, run in thread pool)
            preprocess_result = await loop.run_in_executor(
                _cv_executor,
                preprocess_palm_image,
                image_path,
                settings.UPLOAD_DIR,
            )
            record.preprocessed_path = preprocess_result["preprocessed_path"]

            # Step 2 & 3: CV 特征提取 和 VL 图像描述 **并行执行**
            # CV 是 CPU 密集型（线程池），VL 是 IO 密集型（网络请求），可以同时进行
            cv_task = loop.run_in_executor(
                _cv_executor,
                extract_palm_features,
                preprocess_result["preprocessed_path"],
            )
            vl_task = model_factory.describe_palm_image(image_path)

            cv_features, vl_description = await asyncio.gather(cv_task, vl_task)

            record.cv_features_json = json.dumps(cv_features, ensure_ascii=False)
            record.life_line_score = cv_features.get("life_line_ratio")
            record.head_line_score = cv_features.get("head_line_ratio")
            record.heart_line_score = cv_features.get("heart_line_ratio")
            record.fate_line_detected = cv_features.get("fate_line_detected", "unknown")
            record.vl_description = vl_description

            # Step 4: 基于描述 + CV 特征生成解读
            reading = await model_factory.generate_reading(vl_description, cv_features)
            record.reading_result = reading

            # 完成
            record.status = "done"
            elapsed = (time.time() - start_time) * 1000
            record.processing_time_ms = round(elapsed, 2)

            logger.info(
                f"Reading completed for {record.id}, "
                f"took {record.processing_time_ms}ms"
            )

        except Exception as e:
            record.status = "error"
            record.error_message = str(e)
            logger.error(f"Reading failed for {record.id}: {e}")

        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def get_reading(reading_id: str, db: AsyncSession) -> PalmReading | None:
        """Fetch a reading by ID."""
        return await db.get(PalmReading, reading_id)

    @staticmethod
    async def list_readings(
        db: AsyncSession, skip: int = 0, limit: int = 20
    ) -> list[PalmReading]:
        """List recent readings with pagination."""
        from sqlalchemy import select

        stmt = (
            select(PalmReading)
            .order_by(PalmReading.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


palm_reading_service = PalmReadingService()
