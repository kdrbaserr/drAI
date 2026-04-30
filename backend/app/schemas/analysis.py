from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class DiagnosisSchema(BaseModel):
    result: str
    confidence: float
    details: Optional[str] = None
    
    class Config:
        from_attributes = True

class AnalysisCreate(BaseModel):
    data: Dict[str, Any]

class AnalysisResponse(BaseModel):
    id: int
    user_id: int
    data: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    diagnosis: Optional[DiagnosisSchema] = None
    
    class Config:
        from_attributes = True
