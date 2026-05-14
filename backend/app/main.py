from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.routers import auth, analyze, history, results, model
from app.database import get_db
from app.schemas.core import HealthResponse

# Create database tables
from app import models  # Ensure models are imported before creating tables
# Base.metadata.create_all(bind=engine) # Geçici olarak kapatıldı


app = FastAPI(title="DrAI Analysis API", description="API for ECG and EEG Analysis")

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(history.router)
app.include_router(results.router)
app.include_router(model.router)

@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check():
    return {"status": "alive", "message": "Fırat Software Engineering ECG Project is running!"}

@app.get("/db-test", tags=["system"])
def test_db_connection(db: Session = Depends(get_db)):
    try:
        # Basit bir SQL sorgusu çalıştırarak bağlantıyı doğrula
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Supabase bağlantısı tıkır tıkır çalışıyor!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
