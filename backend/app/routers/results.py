from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.routers.auth import get_current_user
from app.database import get_db
from app.models.analysis import Analysis
from app.models.user import User
from app.schemas.analysis import AnalysisResponse

router = APIRouter(prefix="/results", tags=["results"])

@router.get("/{id}", response_model=AnalysisResponse)
def get_analysis_result(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches a specific analysis result by ID.
    """
    analysis = db.query(Analysis).filter(Analysis.id == id, Analysis.user_id == current_user.id).first()
    
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis result not found")
        
    return analysis
