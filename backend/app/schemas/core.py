from typing import Dict

from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    message: str

class ModelDetails(BaseModel):
    name: str
    version: str
    status: str
    metrics: Dict[str, float]
    description: str


class ModelInfoResponse(BaseModel):
    models: Dict[str, ModelDetails]
