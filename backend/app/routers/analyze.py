from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.routers.auth import get_current_user
from app.database import get_db
from app.models.analysis import Analysis
from app.models.diagnosis import Diagnosis
from app.models.user import User
from app.schemas.analysis import AnalysisCreate, AnalysisResponse
from typing import List

router = APIRouter(prefix="/analyze", tags=["analyze"])

@router.post("/ecg", response_model=AnalysisResponse)
def analyze_ecg(
    request: AnalysisCreate,
    current_user_data: dict = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Accepts raw ECG data, runs a mock diagnosis, and securely logs it into the Supabase database.
    """
    # Grab the mapped user from db
    user = db.query(User).filter(User.username == current_user_data["username"]).first()

    # Step 1: Commit Analysis Base
    new_analysis = Analysis(user_id=user.id, data=request.data, status="completed")
    db.add(new_analysis)
    db.flush() # Gather primary key ID without releasing session
    
    # Step 2: Create Mock Diagnosis Tied to Analysis
    import random
    mock_options = ["Normal Sinus Rhythm", "Atrial Fibrillation", "Bradycardia", "Tachycardia"]
    diagnosis = Diagnosis(
        analysis_id=new_analysis.id,
        result=random.choice(mock_options),
        confidence=round(random.uniform(75.5, 99.9), 2),
        details="Generated algorithmically via mock parameters."
    )
    db.add(diagnosis)
    db.commit()
    db.refresh(new_analysis)

    return new_analysis

@router.get("/history", response_model=List[AnalysisResponse])
def get_analysis_history(
    current_user_data: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches the full chronologically sorted history of analyses performed by the authenticated user.
    """
    user = db.query(User).filter(User.username == current_user_data["username"]).first()
    analyses = db.query(Analysis).filter(Analysis.user_id == user.id).order_by(Analysis.created_at.desc()).all()
    return analyses
