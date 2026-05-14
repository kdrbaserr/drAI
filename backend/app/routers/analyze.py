from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.routers.auth import get_current_user
from app.database import get_db
from app.models.analysis import Analysis
from app.models.diagnosis import Diagnosis
from app.models.user import User
from app.schemas.analysis import AnalysisResponse, ECGAnalysisCreate, EEGAnalysisCreate
import random

router = APIRouter(prefix="/analyze", tags=["analyze"])

@router.post("/ecg", response_model=AnalysisResponse)
def analyze_ecg(
    request: ECGAnalysisCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts raw ECG data, runs a mock diagnosis, and securely logs it into the Supabase database.
    """
    new_analysis = Analysis(user_id=current_user.id, analysis_type="ecg", data=request.data, status="completed")
    db.add(new_analysis)
    db.flush() 
    
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

@router.post("/eeg", response_model=AnalysisResponse)
def analyze_eeg(
    request: EEGAnalysisCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts raw EEG data, runs a mock diagnosis, and securely logs it into the Supabase database.
    """
    new_analysis = Analysis(user_id=current_user.id, analysis_type="eeg", data=request.data, status="completed")
    db.add(new_analysis)
    db.flush() 
    
    mock_options = ["Normal Brain Activity", "Epileptiform Discharges", "Slow Wave Activity"]
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
