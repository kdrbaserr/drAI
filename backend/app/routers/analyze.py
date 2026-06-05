import os
import shutil
import tempfile
from pathlib import Path
from typing import Callable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.inference.ecg import predict_ecg
from app.ml.inference.eeg import predict_eeg
from app.models.analysis import Analysis
from app.models.audit_log import AuditLog
from app.models.diagnosis import Diagnosis
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.analysis import AnalysisResponse, MEDICAL_DISCLAIMER
from app.schemas.signal import build_standard_signal_metadata

router = APIRouter(prefix="/analyze", tags=["analyze"])

MAX_UPLOAD_SIZE_BYTES = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "10")) * 1024 * 1024
ALLOWED_EXTENSIONS = {
    "ecg": {".dat", ".hea", ".csv", ".txt"},
    "eeg": {".edf"},
}


def _write_audit_log(
    db: Session,
    *,
    user_id: int,
    analysis_type: str,
    status_value: str,
    filename: str | None,
    model_version: str | None = None,
    analysis_id: int | None = None,
    details: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            analysis_id=analysis_id,
            event="analysis_submission",
            analysis_type=analysis_type,
            status=status_value,
            model_version=model_version,
            filename=filename,
            details=details,
        )
    )


async def _store_validated_upload(file: UploadFile, analysis_type: str) -> str:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    allowed_extensions = ALLOWED_EXTENSIONS[analysis_type]
    if extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {analysis_type.upper()} file extension. Allowed: {allowed}.",
        )

    tmp_path = ""
    total_bytes = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp:
            tmp_path = tmp.name
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail="Uploaded file exceeds the configured size limit.",
                    )
                tmp.write(chunk)
        return tmp_path
    except Exception:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def _validate_upload_extension(filename: str, analysis_type: str) -> str:
    extension = Path(filename).suffix.lower()
    allowed_extensions = ALLOWED_EXTENSIONS[analysis_type]
    if extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {analysis_type.upper()} file extension. Allowed: {allowed}.",
        )
    return extension


async def _store_validated_upload_group(
    uploads: list[UploadFile], analysis_type: str
) -> tuple[str, str, UploadFile, list[str]]:
    if not uploads:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one upload file is required.",
        )

    tmp_dir = tempfile.mkdtemp(prefix=f"drai-{analysis_type}-")
    stored_paths: list[tuple[UploadFile, str]] = []
    total_bytes = 0
    try:
        for upload in uploads:
            filename = Path(upload.filename or "").name
            extension = _validate_upload_extension(filename, analysis_type)
            target_path = os.path.join(tmp_dir, filename or f"upload{extension}")
            with open(target_path, "wb") as target:
                while chunk := await upload.read(1024 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                            detail="Uploaded files exceed the configured size limit.",
                        )
                    target.write(chunk)
            stored_paths.append((upload, target_path))

        primary_upload, primary_path = _select_primary_upload(stored_paths, analysis_type)
        return primary_path, tmp_dir, primary_upload, [Path(path).name for _, path in stored_paths]
    except Exception:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise


def _select_primary_upload(
    stored_paths: list[tuple[UploadFile, str]], analysis_type: str
) -> tuple[UploadFile, str]:
    if analysis_type != "ecg":
        return stored_paths[0]

    by_extension = {Path(path).suffix.lower(): (upload, path) for upload, path in stored_paths}
    if ".dat" in by_extension:
        dat_stem = Path(by_extension[".dat"][1]).stem
        hea_path = by_extension.get(".hea", (None, ""))[1]
        if hea_path and Path(hea_path).stem != dat_stem:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="WFDB .dat and .hea files must share the same record name.",
            )
        return by_extension[".dat"]

    if ".hea" in by_extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WFDB .hea upload also requires the matching .dat file.",
        )

    return stored_paths[0]


async def _prepare_upload(
    file: UploadFile, analysis_type: str, current_user: User, db: Session
) -> str:
    try:
        return await _store_validated_upload(file, analysis_type)
    except HTTPException as exc:
        _write_audit_log(
            db,
            user_id=current_user.id,
            analysis_type=analysis_type,
            status_value="rejected",
            filename=file.filename,
            details=str(exc.detail),
        )
        db.commit()
        raise


def _persist_analysis(
    *,
    db: Session,
    current_user: User,
    analysis_type: str,
    file: UploadFile,
    inference_result: dict,
    upload_filenames: list[str] | None = None,
) -> Analysis:
    model_version = inference_result.get("model_version", "experimental")
    inference_succeeded = inference_result.get("status") == "success"
    analysis_status = "completed" if inference_succeeded else "experimental"
    file_metadata = {
        "filename": file.filename,
        "filenames": upload_filenames or [file.filename],
        "content_type": file.content_type,
        "inference_status": inference_result.get("status"),
        "preprocessing": inference_result.get("preprocessing_info", {}),
        "standard_signal": build_standard_signal_metadata(
            signal_type=analysis_type,
            filename=file.filename,
            content_type=file.content_type,
            preprocessing_info=inference_result.get("preprocessing_info", {}),
            converter_warnings=inference_result.get("converter_warnings", []),
        ).model_dump(mode="json"),
        "model_version": model_version,
        "prediction": inference_result.get("prediction", "Unknown"),
        "confidence": inference_result.get("confidence", 0.0),
        "probabilities": inference_result.get("all_probabilities", {}),
    }

    analysis = Analysis(
        user_id=current_user.id,
        analysis_type=analysis_type,
        data=file_metadata,
        status=analysis_status,
    )
    db.add(analysis)
    db.flush()

    db.add(
        Diagnosis(
            analysis_id=analysis.id,
            result=inference_result.get("prediction", "Unknown"),
            confidence=inference_result.get("confidence", 0.0) * 100,
            details=f"Model Version: {model_version}",
        )
    )
    _write_audit_log(
        db,
        user_id=current_user.id,
        analysis_type=analysis_type,
        status_value=analysis_status,
        filename=file.filename,
        model_version=model_version,
        analysis_id=analysis.id,
    )
    db.commit()
    db.refresh(analysis)
    analysis.disclaimer = MEDICAL_DISCLAIMER
    return analysis


def _run_inference_and_persist(
    *,
    db: Session,
    current_user: User,
    analysis_type: str,
    file: UploadFile,
    tmp_path: str,
    predictor: Callable[[str], dict],
    upload_filenames: list[str] | None = None,
) -> Analysis:
    try:
        inference_result = predictor(tmp_path)
    except Exception:
        _write_audit_log(
            db,
            user_id=current_user.id,
            analysis_type=analysis_type,
            status_value="failed",
            filename=file.filename,
            details="Inference failed before a result was produced.",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis could not be completed.",
        )

    return _persist_analysis(
        db=db,
        current_user=current_user,
        analysis_type=analysis_type,
        file=file,
        inference_result=inference_result,
        upload_filenames=upload_filenames,
    )


@router.post("/ecg", response_model=AnalysisResponse)
async def analyze_ecg(
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a validated ECG upload, run inference, and audit its result."""
    uploads = files or ([file] if file else [])
    try:
        tmp_path, tmp_dir, primary_file, upload_filenames = await _store_validated_upload_group(
            uploads, "ecg"
        )
    except HTTPException as exc:
        _write_audit_log(
            db,
            user_id=current_user.id,
            analysis_type="ecg",
            status_value="rejected",
            filename=", ".join(upload.filename or "" for upload in uploads) or None,
            details=str(exc.detail),
        )
        db.commit()
        raise

    try:
        return _run_inference_and_persist(
            db=db,
            current_user=current_user,
            analysis_type="ecg",
            file=primary_file,
            tmp_path=tmp_path,
            predictor=predict_ecg,
            upload_filenames=upload_filenames,
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/eeg", response_model=AnalysisResponse)
async def analyze_eeg(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a validated EEG upload, infer when available, and audit its result."""
    tmp_path = await _prepare_upload(file, "eeg", current_user, db)
    try:
        return _run_inference_and_persist(
            db=db,
            current_user=current_user,
            analysis_type="eeg",
            file=file,
            tmp_path=tmp_path,
            predictor=predict_eeg,
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
