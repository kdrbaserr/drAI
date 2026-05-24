from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional
from datetime import datetime

PATIENT_DATA_WARNING = (
    "Hasta verileri hassastir; yalnizca yetkili kisilerce ve uygun izinlerle "
    "islenmelidir."
)
CLINICAL_DECISION_SUPPORT_WARNING = (
    "Bu sistem klinik karar destek amaclidir; kesin tani veya tedavi onerisi "
    "yerine gecmez. Lutfen bir hekime danisiniz."
)
MEDICAL_DISCLAIMER = CLINICAL_DECISION_SUPPORT_WARNING

class DiagnosisSchema(BaseModel):
    result: str
    confidence: float
    details: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class AnalysisCreate(BaseModel):
    data: Dict[str, Any]

class ECGAnalysisCreate(AnalysisCreate):
    pass

class EEGAnalysisCreate(AnalysisCreate):
    pass

class AnalysisResponse(BaseModel):
    id: int
    user_id: int
    analysis_type: str
    data: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    diagnosis: Optional[DiagnosisSchema] = None
    patient_data_warning: str = PATIENT_DATA_WARNING
    clinical_decision_support_warning: str = CLINICAL_DECISION_SUPPORT_WARNING
    disclaimer: str = MEDICAL_DISCLAIMER
    
    model_config = ConfigDict(from_attributes=True)
