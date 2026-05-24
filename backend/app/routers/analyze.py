import os
import shutil
import tempfile

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.inference.ecg import predict_ecg
from app.ml.inference.eeg import predict_eeg
from app.models.analysis import Analysis
from app.models.diagnosis import Diagnosis
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.analysis import AnalysisResponse, MEDICAL_DISCLAIMER

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/ecg", response_model=AnalysisResponse)
async def analyze_ecg(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept an ECG upload, run inference, and persist its result."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        inference_result = predict_ecg(tmp_path)
        model_version = inference_result.get("model_version", "unknown")
        file_metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "inference_status": inference_result.get("status"),
            "model_version": model_version,
        }

        new_analysis = Analysis(
            user_id=current_user.id,
            analysis_type="ecg",
            data=file_metadata,
            status="completed",
        )
        db.add(new_analysis)
        db.flush()

        diagnosis = Diagnosis(
            analysis_id=new_analysis.id,
            result=inference_result.get("prediction", "Unknown"),
            confidence=inference_result.get("confidence", 0.0) * 100,
            details=f"Model Version: {model_version}",
        )
        db.add(diagnosis)
        db.commit()
        db.refresh(new_analysis)

        new_analysis.disclaimer = MEDICAL_DISCLAIMER
        return new_analysis
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/eeg", response_model=AnalysisResponse)
async def analyze_eeg(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept an EEG upload, preprocess it, infer when available, and persist it."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        inference_result = predict_eeg(tmp_path)
        model_version = inference_result.get("model_version", "experimental")
        inference_succeeded = inference_result.get("status") == "success"
        analysis_status = "completed" if inference_succeeded else "experimental"

        file_metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "inference_status": inference_result.get("status"),
            "preprocessing": inference_result.get("preprocessing_info", {}),
            "model_version": model_version,
        }

        new_analysis = Analysis(
            user_id=current_user.id,
            analysis_type="eeg",
            data=file_metadata,
            status=analysis_status,
        )
        db.add(new_analysis)
        db.flush()

        diagnosis = Diagnosis(
            analysis_id=new_analysis.id,
            result=inference_result.get("prediction", "Unknown"),
            confidence=inference_result.get("confidence", 0.0) * 100,
            details=f"Model Version: {model_version}",
        )
        db.add(diagnosis)
        db.commit()
        db.refresh(new_analysis)

        new_analysis.disclaimer = MEDICAL_DISCLAIMER
        return new_analysis
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
