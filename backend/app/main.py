import os

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.routers import auth, analyze, history, results, model
from app.database import get_db
from app.schemas.core import HealthResponse

# Create database tables
from app import models  # Ensure models are imported before creating tables
# Base.metadata.create_all(bind=engine) # Geçici olarak kapatıldı


app = FastAPI(title="DrAI Analysis API", description="API for ECG and EEG Analysis")

allowed_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(history.router)
app.include_router(results.router)
app.include_router(model.router)

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth.router)
api_v1.include_router(analyze.router)
api_v1.include_router(history.router)
api_v1.include_router(results.router)
api_v1.include_router(model.router)
app.include_router(api_v1)

@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check():
    return {"status": "alive", "message": "Fırat Software Engineering ECG Project is running!"}

@app.get("/db-test", tags=["system"])
def test_db_connection(
    db: Session = Depends(get_db),
    _current_user=Depends(auth.get_current_user),
):
    try:
        # Basit bir SQL sorgusu çalıştırarak bağlantıyı doğrula
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Supabase bağlantısı tıkır tıkır çalışıyor!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
