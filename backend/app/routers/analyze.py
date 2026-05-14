import os
import shutil
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from app.routers.auth import get_current_user
from app.database import get_db
from app.models.analysis import Analysis
from app.models.diagnosis import Diagnosis
from app.models.user import User
from app.schemas.analysis import AnalysisResponse, ECGAnalysisCreate, EEGAnalysisCreate
from app.ml.inference.ecg import predict_ecg
import random

router = APIRouter(prefix="/analyze", tags=["analyze"])

@router.post("/ecg", response_model=AnalysisResponse)
async def analyze_ecg(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts an ECG file upload, runs inference, and securely logs it into the Supabase database.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        inference_result = predict_ecg(tmp_path)
        
        file_metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "inference_status": inference_result.get("status")
        }
        
        new_analysis = Analysis(
            user_id=current_user.id, 
            analysis_type="ecg", 
            data=file_metadata, 
            status="completed"
        )
        db.add(new_analysis)
        db.flush() 
        
        diagnosis = Diagnosis(
            analysis_id=new_analysis.id,
            result=inference_result.get("prediction", "Unknown"),
            confidence=inference_result.get("confidence", 0.0) * 100,
            details=f"Model Version: {inference_result.get('model_version', 'N/A')}"
        )
        db.add(diagnosis)
        db.commit()
        db.refresh(new_analysis)
        
        new_analysis.disclaimer = "BU SİSTEM BİR YAPAY ZEKA ASİSTANIDIR VE KESİN TIBBİ TANI KOYMAZ. LÜTFEN BİR HEKİME DANIŞINIZ."
        return new_analysis
        
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

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
    
    new_analysis.disclaimer = "BU SİSTEM BİR YAPAY ZEKA ASİSTANIDIR VE KESİN TIBBİ TANI KOYMAZ. LÜTFEN BİR HEKİME DANIŞINIZ."
    return new_analysis
