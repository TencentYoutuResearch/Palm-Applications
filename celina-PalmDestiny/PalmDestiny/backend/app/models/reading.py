"""
SQLAlchemy ORM models for palm reading records.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class PalmReading(Base):
    """Stores each palm reading analysis result."""

    __tablename__ = "palm_readings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    image_path = Column(String(512), nullable=False, comment="Path to uploaded palm image")
    preprocessed_path = Column(String(512), nullable=True, comment="Path to preprocessed image")

    # CV feature extraction results
    life_line_score = Column(Float, nullable=True, comment="Life line length ratio")
    head_line_score = Column(Float, nullable=True, comment="Head line length ratio")
    heart_line_score = Column(Float, nullable=True, comment="Heart line length ratio")
    fate_line_detected = Column(String(10), nullable=True, comment="Whether fate line is detected")
    cv_features_json = Column(Text, nullable=True, comment="Full CV features as JSON")

    # VL model description
    vl_description = Column(Text, nullable=True, comment="Qwen-VL image description")

    # Final palmistry reading
    reading_result = Column(Text, nullable=True, comment="Final palmistry interpretation")

    # Metadata
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    processing_time_ms = Column(Float, nullable=True, comment="Total processing time in ms")
    status = Column(String(20), default="pending", comment="pending/processing/done/error")
    error_message = Column(Text, nullable=True)

    def __repr__(self):
        return f"<PalmReading id={self.id} status={self.status}>"
