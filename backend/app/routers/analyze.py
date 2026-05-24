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
from app.ml.inference.eeg import predict_eeg
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
async def analyze_eeg(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accepts an EEG file upload, runs basic preprocessing and experimental inference, and logs it.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        inference_result = predict_eeg(tmp_path)

        file_metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "inference_status": inference_result.get("status"),
            "preprocessing": inference_result.get("preprocessing_info", {})
        }

        new_analysis = Analysis(
            user_id=current_user.id,
            analysis_type="eeg",
            data=file_metadata,
            status=inference_result.get("status", "experimental")
        )
        db.add(new_analysis)
        db.flush()

        diagnosis = Diagnosis(
            analysis_id=new_analysis.id,
            result=inference_result.get("prediction", "Unknown"),
            confidence=inference_result.get("confidence", 0.0) * 100,
            details=f"Model Version: {inference_result.get('model_version', 'experimental')}"
        )
        db.add(diagnosis)
        db.commit()
        db.refresh(new_analysis)

        new_analysis.disclaimer = "BU SİSTEM BİR YAPAY ZEKA ASİSTANIDIR VE KESİN TIBBİ TANI KOYMAZ. LÜTFEN BİR HEKİME DANIŞINIZ."
        return new_analysis

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
