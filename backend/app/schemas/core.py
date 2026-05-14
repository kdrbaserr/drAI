from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    message: str

class ModelInfoResponse(BaseModel):
    model_name: str
    version: str
    accuracy: float
    description: str
