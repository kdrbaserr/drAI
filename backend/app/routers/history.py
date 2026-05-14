from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.routers.auth import get_current_user
from app.database import get_db
from app.models.analysis import Analysis
from app.models.user import User
from app.schemas.analysis import AnalysisResponse
from typing import List

router = APIRouter(prefix="/history", tags=["history"])

@router.get("", response_model=List[AnalysisResponse])
def get_analysis_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches the full chronologically sorted history of analyses performed by the authenticated user.
    """
    analyses = db.query(Analysis).filter(Analysis.user_id == current_user.id).order_by(Analysis.created_at.desc()).all()
    return analyses
