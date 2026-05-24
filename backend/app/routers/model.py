from fastapi import APIRouter

from app.ml.inference.eeg import MODEL_VERSION as EEG_MODEL_VERSION
from app.schemas.core import ModelInfoResponse

router = APIRouter(prefix="/model", tags=["model"])


@router.get("/info", response_model=ModelInfoResponse)
def get_model_info():
    """
    Provides current ML model metadata and status.
    """
    return {
        "models": {
            "ecg": {
                "name": "DrAI-ECG-Net",
                "version": "1.0.0",
                "status": "experimental",
                "metrics": {"accuracy": 0.86, "f1_macro": 0.855, "auc_roc": 0.978},
                "description": "ECG metadata exists, but the ONNX file is still a placeholder.",
            },
            "eeg": {
                "name": "EEG-ECG-READER",
                "version": EEG_MODEL_VERSION,
                "status": "active",
                "metrics": {"accuracy": 0.3792, "f1_macro": 0.3737, "auc_roc": 0.7756},
                "description": "MOMENT-1-small with the LoRA adapter merged at runtime.",
            },
        }
    }
