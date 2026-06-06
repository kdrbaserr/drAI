import os
import sys
import tempfile
import types
from datetime import timedelta
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-with-sufficient-length"
os.environ["JWT_ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["CORS_ORIGINS"] = "http://localhost:3000,http://localhost:8081"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.routers.analyze as analyze_router
import app.routers.convert as convert_router
import app.ml.inference.ecg as ecg_inference
import app.ml.inference.eeg as eeg_inference
from app.database import Base, get_db
from app.ml.explainability import build_gradient_signal_explainability
from app.main import app
from app.models.analysis import Analysis
from app.models.audit_log import AuditLog
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.signal import (
    SignalExplainability,
    SourceFormat,
    StandardSignalMetadata,
    infer_source_format,
)
from app.utils.security import create_access_token

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


def test_cors_allows_configured_frontend_origin():
    response = client.options(
        "/api/v1/analyze/eeg",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_allows_expo_web_origin():
    response = client.options(
        "/api/v1/analyze/ecg",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"


def test_standard_signal_metadata_contract_shape():
    metadata = StandardSignalMetadata(
        signal_type="ecg",
        source_format="wfdb",
        sample_rate_hz=500,
        channels=["I", "II"],
        duration_sec=10,
        matrix_shape=[2, 5000],
        signal_preview=[{"time": 0, "value": 0.12, "channel": "II"}],
        converter_warnings=[],
    )

    payload = metadata.model_dump(mode="json")
    assert payload["signal_type"] == "ecg"
    assert payload["source_format"] == "wfdb"
    assert payload["matrix_shape"] == [2, 5000]
    assert payload["signal_preview"][0]["channel"] == "II"
    assert infer_source_format("record.edf") == SourceFormat.EDF


def test_signal_explainability_contract_shape_omits_normal_signal_by_default():
    explainability = SignalExplainability(
        method="saliency",
        target_label="Atrial Fibrillation",
        generated_from_model=True,
        sample_rate_hz=500,
        channels=["II"],
        saliency_scores=[{"time": 1.2, "score": 0.91, "channel": "II"}],
        highlight_zones=[
            {
                "id": "zone-1",
                "start_time": 1.0,
                "end_time": 1.6,
                "severity": "red",
                "score": 0.91,
                "label": "High-attention rhythm segment",
                "reason": "Model saliency peaked in this interval.",
                "channel": "II",
                "preview": [{"time": 1.2, "value": 0.42, "channel": "II"}],
            }
        ],
    )

    payload = explainability.model_dump(mode="json")
    assert payload["schema_version"] == 1
    assert payload["method"] == "saliency"
    assert payload["display"]["normal_signal_policy"] == "omitted"
    assert payload["highlight_zones"][0]["severity"] == "red"
    assert payload["highlight_zones"][0]["preview"][0]["channel"] == "II"


def test_gradient_explainability_builds_red_and_yellow_highlight_zones_only():
    np = __import__("numpy")
    signal = np.sin(np.linspace(0, 8, 200, dtype="float32")).reshape(1, 200)
    saliency = np.zeros((1, 200), dtype="float32")
    saliency[:, 40:90] = 0.6
    saliency[:, 120:170] = 1.0

    explainability = build_gradient_signal_explainability(
        signal=signal,
        saliency=saliency,
        sample_rate_hz=100,
        channels=["II"],
        target_label="left_fist",
        signal_type="eeg",
        max_zones=3,
    )

    assert explainability["generated_from_model"] is True
    assert explainability["method"] == "saliency"
    assert explainability["display"]["normal_signal_policy"] == "omitted"
    assert len(explainability["highlight_zones"]) >= 2
    severities = {zone["severity"] for zone in explainability["highlight_zones"]}
    assert "red" in severities
    assert "yellow" in severities
    assert all(zone["preview"] for zone in explainability["highlight_zones"])
    assert all("EEG attention segment" in zone["label"] for zone in explainability["highlight_zones"])
    assert all("left fist" in zone["reason"] for zone in explainability["highlight_zones"])


def test_ecg_explainability_labels_prediction_specific_rhythm_evidence():
    np = __import__("numpy")
    signal = np.sin(np.linspace(0, 8, 200, dtype="float32")).reshape(1, 200)
    saliency = np.zeros((1, 200), dtype="float32")
    saliency[:, 80:140] = 1.0

    explainability = build_gradient_signal_explainability(
        signal=signal,
        saliency=saliency,
        sample_rate_hz=100,
        channels=["II"],
        target_label="Atrial Fibrillation",
        signal_type="ecg",
        max_zones=1,
    )

    zone = explainability["highlight_zones"][0]
    assert zone["severity"] == "red"
    assert zone["label"] == "Irregular rhythm evidence"
    assert "irregular rhythm prediction" in zone["reason"]


def test_protected_endpoint_requires_token():
    response = client.get("/api/v1/history")

    assert response.status_code == 401


def test_database_diagnostic_endpoint_requires_token():
    response = client.get("/db-test")

    assert response.status_code == 401


def test_expired_token_is_rejected(db_session):
    app.dependency_overrides.pop(get_current_user, None)
    token = create_access_token({"sub": "owner"}, expires_delta=timedelta(minutes=-1))

    response = client.get(
        "/api/v1/history", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


def test_valid_token_accesses_protected_endpoint(db_session):
    app.dependency_overrides.pop(get_current_user, None)
    token = create_access_token({"sub": "owner"})

    response = client.get(
        "/api/v1/history", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200


def test_demo_flow_register_login_ecg_history_result_and_logout_guard(db_session):
    app.dependency_overrides.pop(get_current_user, None)

    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": "demo",
            "email": "demo@example.com",
            "password": "StrongPass123",
        },
    )
    assert register.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        data={"username": "demo", "password": "StrongPass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    upload = client.post(
        "/api/v1/analyze/ecg",
        files={"file": ("demo.dat", b"demo-ecg-signal", "application/octet-stream")},
        headers=auth_headers,
    )
    assert upload.status_code == 200
    uploaded = upload.json()
    assert uploaded["analysis_type"] == "ecg"
    assert uploaded["data"]["filename"] == "demo.dat"
    assert uploaded["data"]["standard_signal"]["signal_type"] == "ecg"
    assert uploaded["data"]["standard_signal"]["source_format"] == "wfdb"
    assert uploaded["data"]["explainability"]["schema_version"] == 1
    assert uploaded["data"]["explainability"]["method"] == "unavailable"
    assert uploaded["data"]["explainability"]["display"]["normal_signal_policy"] == "omitted"
    assert uploaded["data"]["explainability"]["highlight_zones"] == []
    assert uploaded["data"]["model_version"] == "1.0.0"
    assert uploaded["diagnosis"]["result"]

    history = client.get("/api/v1/history", headers=auth_headers)
    assert history.status_code == 200
    history_items = history.json()
    assert len(history_items) == 1
    assert history_items[0]["id"] == uploaded["id"]

    detail = client.get(f"/api/v1/results/{uploaded['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["id"] == uploaded["id"]

    logged_out_history = client.get("/api/v1/history")
    assert logged_out_history.status_code == 401


def test_eeg_error_is_persisted_as_experimental(db_session, monkeypatch):
    monkeypatch.setattr(
        analyze_router,
        "predict_eeg",
        lambda _: {
            "status": "error",
            "prediction": "unknown",
            "confidence": 0.0,
            "model_version": "1.0.0-lora-merged-runtime",
            "preprocessing_info": {"n_channels": 68, "seq_len": 512},
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
    assert payload["data"]["standard_signal"]["signal_type"] == "eeg"
    assert payload["data"]["standard_signal"]["matrix_shape"] == [68, 512]
    assert payload["patient_data_warning"]
    assert payload["clinical_decision_support_warning"]
    persisted = db_session.query(Analysis).filter(Analysis.id == payload["id"]).one()
    audit_log = db_session.query(AuditLog).filter(AuditLog.analysis_id == persisted.id).one()
    assert persisted.status == "experimental"
    assert persisted.diagnosis.details == "Model Version: 1.0.0-lora-merged-runtime"
    assert audit_log.model_version == "1.0.0-lora-merged-runtime"
    assert audit_log.status == "experimental"


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


def test_eeg_edf_metadata_populates_standard_preprocessing_info(monkeypatch):
    monkeypatch.setattr(
        eeg_inference,
        "_read_edf_metadata",
        lambda _: {
            "sample_rate_hz": 256.0,
            "channels": ["Fp1", "Fp2", "C3"],
            "duration_sec": 2.0,
        },
    )

    signal = __import__("numpy").zeros((1, 68, 512), dtype="float32")
    preprocessing = eeg_inference._build_preprocessing_info("sample.edf", signal)

    assert preprocessing["mode"] == "mne_edf_converter"
    assert preprocessing["sample_rate_hz"] == 256.0
    assert preprocessing["channels"] == ["Fp1", "Fp2", "C3"]
    assert preprocessing["duration_sec"] == 2.0
    assert preprocessing["matrix_shape"] == [68, 512]
    assert preprocessing["signal_preview"][0]["channel"] == "CH001"


def test_ecg_csv_is_parsed_into_standard_preprocessing_metadata():
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as sample:
        sample.write("time,lead_i,lead_ii\n")
        sample.write("0.000,0.10,0.20\n")
        sample.write("0.002,0.11,0.21\n")
        sample.write("0.004,0.12,0.22\n")
        sample_path = sample.name

    try:
        result = ecg_inference.predict_ecg(sample_path)
    finally:
        os.remove(sample_path)

    preprocessing = result["preprocessing_info"]
    assert result["status"] == "success"
    assert preprocessing["mode"] == "parsed_numeric_ecg"
    assert preprocessing["sample_rate_hz"] == 500.0
    assert preprocessing["matrix_shape"] == [2, 3]
    assert preprocessing["signal_preview"][0]["channel"] == "CH001"


def test_ecg_wfdb_parser_reads_record_metadata(monkeypatch, tmp_path):
    record_base = tmp_path / "record"
    record_base.with_suffix(".dat").write_bytes(b"wfdb-binary")
    record_base.with_suffix(".hea").write_text("record 2 500 3\n", encoding="utf-8")

    class FakeRecord:
        fs = 500
        sig_name = ["I", "II"]
        p_signal = [[0.1, 0.2], [0.11, 0.21], [0.12, 0.22]]
        d_signal = None

    fake_wfdb = types.SimpleNamespace(rdrecord=lambda _: FakeRecord())
    monkeypatch.setitem(sys.modules, "wfdb", fake_wfdb)

    result = ecg_inference.predict_ecg(str(record_base.with_suffix(".dat")))
    preprocessing = result["preprocessing_info"]

    assert preprocessing["mode"] == "wfdb_converter"
    assert preprocessing["sample_rate_hz"] == 500.0
    assert preprocessing["channels"] == ["I", "II"]
    assert preprocessing["matrix_shape"] == [2, 3]


def test_ecg_aecg_xml_parser_reads_signal_metadata(tmp_path):
    xml_path = tmp_path / "aecg.xml"
    xml_path.write_text(
        """
        <AnnotatedECG sampleRate="500">
          <lead name="I">0.10 0.11 0.12</lead>
          <lead name="II">0.20 0.21 0.22</lead>
        </AnnotatedECG>
        """,
        encoding="utf-8",
    )

    result = ecg_inference.predict_ecg(str(xml_path))
    preprocessing = result["preprocessing_info"]

    assert preprocessing["mode"] == "aecg_xml_converter"
    assert preprocessing["sample_rate_hz"] == 500.0
    assert preprocessing["channels"] == ["I", "II"]
    assert preprocessing["matrix_shape"] == [2, 3]


def test_ecg_dicom_waveform_parser_reads_signal_metadata(monkeypatch, tmp_path):
    dcm_path = tmp_path / "waveform.dcm"
    dcm_path.write_bytes(b"fake-dicom")

    class FakeCode:
        CodeMeaning = "Lead I"
        CodeValue = "I"

    class FakeChannel:
        ChannelSourceSequence = [FakeCode()]

    class FakeWaveform:
        NumberOfWaveformChannels = 1
        NumberOfWaveformSamples = 3
        WaveformBitsAllocated = 16
        SamplingFrequency = 500
        WaveformData = __import__("numpy").array([10, 11, 12], dtype="int16").tobytes()
        ChannelDefinitionSequence = [FakeChannel()]

    class FakeDataset:
        WaveformSequence = [FakeWaveform()]

    fake_pydicom = types.SimpleNamespace(dcmread=lambda _: FakeDataset())
    monkeypatch.setitem(sys.modules, "pydicom", fake_pydicom)

    result = ecg_inference.predict_ecg(str(dcm_path))
    preprocessing = result["preprocessing_info"]

    assert preprocessing["mode"] == "dicom_waveform_converter"
    assert preprocessing["sample_rate_hz"] == 500.0
    assert preprocessing["channels"] == ["Lead I"]
    assert preprocessing["matrix_shape"] == [1, 3]


def test_ecg_multi_file_wfdb_upload_keeps_pair_together(db_session, monkeypatch):
    def fake_predict(path):
        dat_path = Path(path)
        assert dat_path.name == "record.dat"
        assert dat_path.with_suffix(".hea").exists()
        return {
            "status": "success",
            "prediction": "Normal Sinus Rhythm",
            "confidence": 0.91,
            "model_version": "1.0.0",
            "all_probabilities": {"Normal Sinus Rhythm": 0.91},
            "preprocessing_info": {
                "mode": "wfdb_converter",
                "sample_rate_hz": 500,
                "channels": ["I"],
                "duration_sec": 0.004,
                "matrix_shape": [1, 2],
            },
        }

    monkeypatch.setattr(analyze_router, "predict_ecg", fake_predict)

    response = client.post(
        "/api/v1/analyze/ecg",
        files=[
            ("files", ("record.dat", b"wfdb-data", "application/octet-stream")),
            ("files", ("record.hea", b"record 1 500 2", "text/plain")),
        ],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["filenames"] == ["record.dat", "record.hea"]
    assert payload["data"]["standard_signal"]["source_format"] == "wfdb"
    assert payload["data"]["standard_signal"]["matrix_shape"] == [1, 2]


def test_ecg_hea_without_dat_is_rejected_and_audited(db_session):
    response = client.post(
        "/api/v1/analyze/ecg",
        files=[("files", ("record.hea", b"record 1 500 2", "text/plain"))],
    )

    assert response.status_code == 400
    assert "matching .dat" in response.json()["detail"]
    audit_log = db_session.query(AuditLog).one()
    assert audit_log.status == "rejected"


def test_ecg_dicom_and_xml_extensions_are_accepted(db_session, monkeypatch):
    seen = []

    def fake_predict(path):
        seen.append(Path(path).suffix)
        return {
            "status": "success",
            "prediction": "Normal Sinus Rhythm",
            "confidence": 0.9,
            "model_version": "1.0.0",
            "all_probabilities": {"Normal Sinus Rhythm": 0.9},
            "preprocessing_info": {
                "mode": "dicom_or_xml_test",
                "sample_rate_hz": 500,
                "channels": ["I"],
                "matrix_shape": [1, 2],
            },
        }

    monkeypatch.setattr(analyze_router, "predict_ecg", fake_predict)

    dicom_response = client.post(
        "/api/v1/analyze/ecg",
        files={"file": ("waveform.dcm", b"dicom", "application/dicom")},
    )
    xml_response = client.post(
        "/api/v1/analyze/ecg",
        files={"file": ("aecg.xml", b"<ecg />", "application/xml")},
    )

    assert dicom_response.status_code == 200
    assert xml_response.status_code == 200
    assert seen == [".dcm", ".xml"]


def test_convert_preview_ecg_returns_standard_signal(db_session, monkeypatch):
    monkeypatch.setattr(
        convert_router,
        "preview_ecg",
        lambda _: {
            "readable": True,
            "preprocessing_info": {
                "mode": "parsed_numeric_ecg",
                "sample_rate_hz": 500,
                "channels": ["I"],
                "duration_sec": 0.004,
                "matrix_shape": [1, 2],
            },
            "converter_warnings": [],
        },
    )

    response = client.post(
        "/api/v1/convert/preview/ecg",
        files={"file": ("sample.csv", b"0,0.1\n0.002,0.2", "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["readable"] is True
    assert payload["filenames"] == ["sample.csv"]
    assert payload["standard_signal"]["source_format"] == "csv"
    assert payload["standard_signal"]["matrix_shape"] == [1, 2]


def test_convert_preview_ecg_reports_unreadable_file(db_session, monkeypatch):
    monkeypatch.setattr(
        convert_router,
        "preview_ecg",
        lambda _: {
            "readable": False,
            "preprocessing_info": {
                "mode": "parse_failed",
                "converter_warnings": ["no numeric signal"],
            },
            "converter_warnings": ["no numeric signal"],
            "error": "no numeric signal",
        },
    )

    response = client.post(
        "/api/v1/convert/preview/ecg",
        files={"file": ("sample.csv", b"bad", "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["readable"] is False
    assert payload["error"] == "no numeric signal"
    assert payload["converter_warnings"] == ["no numeric signal"]


def test_convert_preview_eeg_returns_standard_signal(db_session, monkeypatch):
    monkeypatch.setattr(
        convert_router,
        "preview_eeg",
        lambda _: {
            "readable": True,
            "preprocessing_info": {
                "mode": "mne_edf_converter",
                "sample_rate_hz": 256,
                "channels": ["Fp1"],
                "duration_sec": 2,
                "matrix_shape": [68, 512],
            },
            "converter_warnings": [],
        },
    )

    response = client.post(
        "/api/v1/convert/preview/eeg",
        files={"file": ("sample.edf", b"edf", "application/octet-stream")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["signal_type"] == "eeg"
    assert payload["standard_signal"]["source_format"] == "edf"
    assert payload["standard_signal"]["sample_rate_hz"] == 256


def test_invalid_file_extension_is_rejected_and_audited(db_session):
    response = client.post(
        "/api/v1/analyze/eeg",
        files={"file": ("sample.txt", b"invalid", "text/plain")},
    )

    assert response.status_code == 400
    audit_log = db_session.query(AuditLog).one()
    assert audit_log.status == "rejected"
    assert audit_log.analysis_type == "eeg"


def test_file_over_size_limit_is_rejected_and_audited(db_session, monkeypatch):
    monkeypatch.setattr(analyze_router, "MAX_UPLOAD_SIZE_BYTES", 4)

    response = client.post(
        "/api/v1/analyze/eeg",
        files={"file": ("sample.edf", b"12345", "application/octet-stream")},
    )

    assert response.status_code == 413
    audit_log = db_session.query(AuditLog).one()
    assert audit_log.status == "rejected"


def test_unexpected_inference_failure_is_audited(db_session, monkeypatch):
    def fail_inference(_):
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr(analyze_router, "predict_eeg", fail_inference)

    response = client.post(
        "/api/v1/analyze/eeg",
        files={"file": ("sample.edf", b"valid-upload", "application/octet-stream")},
    )

    assert response.status_code == 500
    audit_log = db_session.query(AuditLog).one()
    assert audit_log.status == "failed"


def test_ecg_placeholder_is_persisted_as_experimental(db_session):
    response = client.post(
        "/api/v1/analyze/ecg",
        files={"file": ("sample.dat", b"placeholder", "application/octet-stream")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["diagnosis"]["result"]
    audit_log = db_session.query(AuditLog).one()
    assert audit_log.status == "completed"
    assert audit_log.model_version == "1.0.0"


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
    assert own_result.json()["patient_data_warning"]
    assert own_result.json()["clinical_decision_support_warning"]
    assert foreign_result.status_code == 404
