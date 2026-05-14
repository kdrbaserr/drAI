from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database import Base

if TYPE_CHECKING:
    from app.models.analysis import Analysis

class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"), unique=True)
    result: Mapped[str] = mapped_column(String, nullable=False) # E.g., Normal Sinus Rhythm, Atrial Fibrillation
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    details: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    analysis: Mapped["Analysis"] = relationship(back_populates="diagnosis")
