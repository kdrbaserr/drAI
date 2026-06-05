import os
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.ml.inference.ecg import preview_ecg
from app.ml.inference.eeg import preview_eeg
from app.models.user import User
from app.routers.analyze import _prepare_upload, _store_validated_upload_group
from app.routers.auth import get_current_user
from app.schemas.signal import ConvertPreviewResponse, build_standard_signal_metadata

router = APIRouter(prefix="/convert", tags=["convert"])


@router.post("/preview/{signal_type}", response_model=ConvertPreviewResponse)
async def preview_signal_conversion(
    signal_type: str,
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    _current_user: User = Depends(get_current_user),
):
    """Preview converter metadata before creating an analysis record."""
    if signal_type not in {"ecg", "eeg"}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unsupported signal type.",
        )

    uploads = files or ([file] if file else [])
    if signal_type == "ecg":
        return await _preview_ecg(uploads)
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="EEG preview requires one file.",
        )
    return await _preview_eeg(file)


async def _preview_ecg(uploads: list[UploadFile]) -> ConvertPreviewResponse:
    tmp_path, tmp_dir, primary_file, upload_filenames = await _store_validated_upload_group(
        uploads, "ecg"
    )
    try:
        preview = preview_ecg(tmp_path)
        return _build_preview_response(
            signal_type="ecg",
            primary_file=primary_file,
            upload_filenames=upload_filenames,
            preview=preview,
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _preview_eeg(file: UploadFile) -> ConvertPreviewResponse:
    tmp_path = await _prepare_upload(file, "eeg", _PreviewUser(), _NullDb())
    try:
        preview = preview_eeg(tmp_path)
        return _build_preview_response(
            signal_type="eeg",
            primary_file=file,
            upload_filenames=[file.filename or ""],
            preview=preview,
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _build_preview_response(
    *,
    signal_type: str,
    primary_file: UploadFile,
    upload_filenames: list[str],
    preview: dict,
) -> ConvertPreviewResponse:
    preprocessing = preview.get("preprocessing_info", {})
    warnings = preview.get("converter_warnings", [])
    return ConvertPreviewResponse(
        signal_type=signal_type,
        readable=bool(preview.get("readable")),
        filenames=upload_filenames,
        standard_signal=build_standard_signal_metadata(
            signal_type=signal_type,
            filename=primary_file.filename,
            content_type=primary_file.content_type,
            preprocessing_info=preprocessing,
            converter_warnings=warnings,
        ),
        preprocessing=preprocessing,
        converter_warnings=warnings,
        error=preview.get("error"),
    )


class _PreviewUser:
    id = 0


class _NullDb:
    def add(self, _):
        return None

    def commit(self):
        return None
