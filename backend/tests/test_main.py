import os

os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.routers.analyze as analyze_router
import app.ml.inference.eeg as eeg_inference
from app.database import Base, get_db
from app.main import app
from app.models.analysis import Analysis
from app.models.user import User
from app.routers.auth import get_current_user

client = TestClient(app)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    user = User(id=1, username="owner", email="owner@example.com", hashed_password="unused")
    other = User(id=2, username="other", email="other@example.com", hashed_password="unused")
    session.add_all([user, other])
    session.commit()

    def override_db():
        yield session

    def override_user():
        return user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    yield session
    app.dependency_overrides.clear()
    session.close()


def test_health_check():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "alive"


def test_model_info_lists_ecg_and_eeg_status():
    response = client.get("/api/v1/model/info")

    assert response.status_code == 200
    models = response.json()["models"]
    assert models["ecg"]["status"] == "experimental"
    assert models["eeg"]["status"] == "active"
    assert models["eeg"]["version"] == "1.0.0-lora-merged-runtime"


def test_eeg_error_is_persisted_as_experimental(db_session, monkeypatch):
    monkeypatch.setattr(
        analyze_router,
        "predict_eeg",
        lambda _: {
            "status": "error",
            "prediction": "unknown",
            "confidence": 0.0,
            "model_version": "1.0.0-lora-merged-runtime",
            "preprocessing_info": {"n_channels": 68},
        },
    )

    response = client.post(
        "/api/v1/analyze/eeg",
        files={"file": ("sample.edf", b"not-an-edf", "application/octet-stream")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "experimental"
    assert payload["data"]["model_version"] == "1.0.0-lora-merged-runtime"
    persisted = db_session.query(Analysis).filter(Analysis.id == payload["id"]).one()
    assert persisted.status == "experimental"
    assert persisted.diagnosis.details == "Model Version: 1.0.0-lora-merged-runtime"


def test_eeg_preprocessing_runs_before_experimental_model_fallback(monkeypatch):
    preprocessing_ran = {"value": False}
    model_attempted = {"value": False}

    def fake_preprocess(_):
        preprocessing_ran["value"] = True
        return [[[0.0]]]

    def unavailable_model():
        model_attempted["value"] = True
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(eeg_inference, "_preprocess_edf", fake_preprocess)
    monkeypatch.setattr(eeg_inference, "_load_model", unavailable_model)

    result = eeg_inference.predict_eeg("sample.edf")

    assert preprocessing_ran["value"] is True
    assert model_attempted["value"] is True
    assert result["status"] == "error"
    assert result["preprocessing_info"]["n_channels"] == 68


def test_history_and_results_are_restricted_to_current_user(db_session):
    owned = Analysis(user_id=1, analysis_type="eeg", data={}, status="completed")
    foreign = Analysis(user_id=2, analysis_type="eeg", data={}, status="completed")
    db_session.add_all([owned, foreign])
    db_session.commit()
    db_session.refresh(owned)
    db_session.refresh(foreign)

    history = client.get("/api/v1/history")
    own_result = client.get(f"/api/v1/results/{owned.id}")
    foreign_result = client.get(f"/api/v1/results/{foreign.id}")

    assert history.status_code == 200
    assert [entry["id"] for entry in history.json()] == [owned.id]
    assert own_result.status_code == 200
    assert foreign_result.status_code == 404
