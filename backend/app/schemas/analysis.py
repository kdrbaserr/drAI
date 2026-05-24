from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional
from datetime import datetime

MEDICAL_DISCLAIMER = (
    "BU SISTEM BIR YAPAY ZEKA ASISTANIDIR VE KESIN TIBBI TANI KOYMAZ. "
    "LUTFEN BIR HEKIME DANISINIZ."
)

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
    disclaimer: str = MEDICAL_DISCLAIMER
    
    model_config = ConfigDict(from_attributes=True)
