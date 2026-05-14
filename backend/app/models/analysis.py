from typing import Optional, Any, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.diagnosis import Diagnosis


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # e.g. 'ecg' or 'eeg'
    analysis_type: Mapped[str] = mapped_column(
        String, nullable=False, default="ecg"
    )
    # E.g., raw signal array or parameters
    data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(
        JSON, nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="completed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="analyses")
    diagnosis: Mapped[Optional["Diagnosis"]] = relationship(
        back_populates="analysis", uselist=False
    )
