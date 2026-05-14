from fastapi import APIRouter

from app.schemas.core import ModelInfoResponse

router = APIRouter(prefix="/model", tags=["model"])


@router.get("/info", response_model=ModelInfoResponse)
def get_model_info():
    """
    Provides current ML model metadata and status.
    """
    return {
        "model_name": "DrAI-ECG-EEG-Net",
        "version": "1.0.0",
        "accuracy": 0.98,
        "description": (
            "A robust deep learning model trained on PhysioNet data to "
            "classify ECG and EEG signals."
)
    }
