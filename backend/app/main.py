from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.routers import auth, analyze
from app.database import engine, Base, get_db

# Create database tables
import app.models  # Ensure models are imported before creating tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ECG Analysis API")

app.include_router(auth.router)
app.include_router(analyze.router)

@app.get("/")
def health_check():
    return {"status": "alive", "message": "Fırat Software Engineering ECG Project is running!"}

@app.get("/db-test")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        # Basit bir SQL sorgusu çalıştırarak bağlantıyı doğrula
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Supabase bağlantısı tıkır tıkır çalışıyor!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
