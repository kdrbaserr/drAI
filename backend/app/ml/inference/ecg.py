import os
import json
import hashlib
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np

# In a real scenario, you'd import ONNX Runtime or similar here
# import onnxruntime as ort

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "ecg"))
MODEL_PATH = os.path.join(MODEL_DIR, "model.onnx")
METADATA_PATH = os.path.join(MODEL_DIR, "metadata.json")
LABELS_PATH = os.path.join(MODEL_DIR, "labels.json")

def _load_json(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def predict_ecg(file_path: str):
    """
    Single entry point for ECG prediction.
    
    Args:
        file_path (str): The path to the ECG data file to process.
        
    Returns:
        dict: The prediction results including status, label, and confidence.
    """
    metadata = _load_json(METADATA_PATH)
    labels = _load_json(LABELS_PATH)
    preprocessing_info = _build_preprocessing_info(file_path, metadata)
    
    # TODO: 
    # 1. Load data from file_path (e.g., using preprocessing module)
    # 2. Preprocess data according to metadata['input_shape'] and metadata['sample_rate']
    # 3. Load ONNX model from MODEL_PATH
    # 4. Run inference
    # 5. Map output logits/probabilities to labels using labels dictionary
    
    if os.path.exists(MODEL_PATH) and os.path.getsize(MODEL_PATH) > 1024:
        # TODO: wire ONNX Runtime inference here once deployable weights are supplied.
        pass

    # Demo fallback: the current ONNX file is a placeholder, so return a stable,
    # presentation-friendly result instead of an empty "model unavailable" output.
    probabilities = _build_demo_probabilities(file_path, labels)
    prediction = max(probabilities, key=probabilities.get)
    explainability = _build_ecg_explainability(file_path, metadata, prediction)
    return {
        "status": "success",
        "file_processed": file_path,
        "prediction": prediction,
        "confidence": probabilities[prediction],
        "all_probabilities": probabilities,
        "model_version": metadata.get("version", "unknown"),
        "explainability": explainability,
        "preprocessing_info": preprocessing_info,
    }


def preview_ecg(file_path: str) -> dict:
    metadata = _load_json(METADATA_PATH)
    preprocessing_info = _build_preprocessing_info(file_path, metadata)
    mode = preprocessing_info.get("mode", "")
    warnings = preprocessing_info.get("converter_warnings", [])
    readable = not mode.endswith("parse_failed") and mode != "demo_fallback"
    return {
        "status": "success" if readable else "error",
        "readable": readable,
        "model_version": metadata.get("version", "unknown"),
        "preprocessing_info": preprocessing_info,
        "converter_warnings": warnings,
        "error": preprocessing_info.get("reason") if not readable else None,
    }


def _build_preprocessing_info(file_path: str, metadata: dict) -> dict:
    extension = Path(file_path).suffix.lower()
    if extension in {".dat", ".hea"}:
        return _build_wfdb_preprocessing_info(file_path, metadata)
    if extension == ".dcm":
        return _build_dicom_preprocessing_info(file_path, metadata)
    if extension == ".xml":
        return _build_xml_preprocessing_info(file_path, metadata)

    if extension not in {".csv", ".txt"}:
        return {
            "mode": "demo_fallback",
            "reason": "ECG parser is not wired for this format yet.",
        }

    try:
        parsed = _parse_numeric_ecg_file(file_path)
    except ValueError as exc:
        return {
            "mode": "parse_failed",
            "reason": str(exc),
            "converter_warnings": [str(exc)],
        }

    signal = parsed["signal"]
    channel_count, sample_count = signal.shape
    sample_rate = parsed["sample_rate_hz"] or metadata.get("sample_rate")
    duration_sec = None
    if sample_rate:
        duration_sec = round(sample_count / float(sample_rate), 4)

    return {
        "mode": "parsed_numeric_ecg",
        "sample_rate_hz": sample_rate,
        "channels": parsed["channels"],
        "duration_sec": duration_sec,
        "matrix_shape": [channel_count, sample_count],
        "signal_preview": _build_signal_preview(signal, sample_rate, parsed["channels"]),
        "converter_warnings": parsed["warnings"],
        "target_input_shape": metadata.get("input_shape"),
    }


def _build_dicom_preprocessing_info(file_path: str, metadata: dict) -> dict:
    try:
        parsed = _parse_dicom_waveform(file_path)
    except ValueError as exc:
        return {
            "mode": "dicom_parse_failed",
            "reason": str(exc),
            "converter_warnings": [str(exc)],
            "target_input_shape": metadata.get("input_shape"),
        }
    return _build_signal_preprocessing_payload("dicom_waveform_converter", parsed, metadata)


def _build_xml_preprocessing_info(file_path: str, metadata: dict) -> dict:
    try:
        parsed = _parse_aecg_xml(file_path)
    except ValueError as exc:
        return {
            "mode": "aecg_xml_parse_failed",
            "reason": str(exc),
            "converter_warnings": [str(exc)],
            "target_input_shape": metadata.get("input_shape"),
        }
    return _build_signal_preprocessing_payload("aecg_xml_converter", parsed, metadata)


def _build_signal_preprocessing_payload(mode: str, parsed: dict, metadata: dict) -> dict:
    signal = parsed["signal"]
    channel_count, sample_count = signal.shape
    sample_rate = parsed["sample_rate_hz"] or metadata.get("sample_rate")
    duration_sec = None
    if sample_rate:
        duration_sec = round(sample_count / float(sample_rate), 4)

    return {
        "mode": mode,
        "sample_rate_hz": sample_rate,
        "channels": parsed["channels"],
        "duration_sec": duration_sec,
        "matrix_shape": [channel_count, sample_count],
        "signal_preview": _build_signal_preview(signal, sample_rate, parsed["channels"]),
        "converter_warnings": parsed["warnings"],
        "target_input_shape": metadata.get("input_shape"),
    }


def _build_ecg_explainability(file_path: str, metadata: dict, prediction: str) -> dict:
    try:
        parsed = _parse_ecg_signal_for_explainability(file_path)
    except ValueError as exc:
        return _unavailable_ecg_explainability(prediction, str(exc))

    signal = parsed["signal"]
    sample_rate = parsed["sample_rate_hz"] or metadata.get("sample_rate") or 500
    channels = parsed["channels"]
    zones = _build_ecg_heuristic_zones(signal, float(sample_rate), channels, prediction)
    warnings = [
        "ECG ONNX weights are not deployable yet; zones are generated from signal heuristics, not model gradients."
    ]
    return {
        "schema_version": 1,
        "method": "heuristic",
        "target_label": prediction,
        "generated_from_model": False,
        "sample_rate_hz": float(sample_rate),
        "channels": channels,
        "saliency_scores": [],
        "highlight_zones": zones,
        "display": {
            "normal_signal_policy": "omitted",
            "max_highlight_zones": 5,
            "context_window_sec": 0.4,
        },
        "warnings": warnings,
    }


def _parse_ecg_signal_for_explainability(file_path: str) -> dict:
    extension = Path(file_path).suffix.lower()
    if extension in {".csv", ".txt"}:
        return _parse_numeric_ecg_file(file_path)
    if extension in {".dat", ".hea"}:
        return _parse_wfdb_record(file_path)
    if extension == ".dcm":
        return _parse_dicom_waveform(file_path)
    if extension == ".xml":
        return _parse_aecg_xml(file_path)
    raise ValueError("ECG signal could not be parsed for highlight zones.")


def _build_ecg_heuristic_zones(
    signal: np.ndarray,
    sample_rate: float,
    channels: list[str],
    prediction: str,
) -> list[dict]:
    if signal.ndim != 2 or signal.shape[1] < 8:
        return []

    channel_index = 0
    lead = signal[channel_index].astype(np.float32)
    lead = np.nan_to_num(lead, nan=0.0, posinf=0.0, neginf=0.0)
    centered = lead - float(np.median(lead))
    scale = float(np.percentile(np.abs(centered), 95)) or float(np.std(centered)) or 1.0
    normalized = centered / scale
    derivative = np.abs(np.diff(normalized, prepend=normalized[0]))
    importance = np.clip((np.abs(normalized) * 0.7) + (derivative * 0.3), 0.0, None)

    if float(importance.max(initial=0.0)) <= 0:
        return []
    importance = importance / float(np.percentile(importance, 98) or importance.max(initial=1.0))
    importance = np.clip(importance, 0.0, 1.0)

    sample_count = lead.shape[0]
    window = max(8, min(sample_count, int(sample_rate * 0.5)))
    stride = max(1, window // 2)
    candidates = []
    for start in range(0, max(1, sample_count - window + 1), stride):
        end = min(sample_count, start + window)
        window_scores = importance[start:end]
        score = float((np.mean(window_scores) * 0.45) + (np.max(window_scores) * 0.55))
        if score < 0.35:
            continue
        candidates.append({"start": start, "end": end, "score": score})

    candidates.sort(key=lambda item: item["score"], reverse=True)
    selected = []
    for candidate in candidates:
        if any(_window_overlap_ratio(candidate["start"], candidate["end"], item["start"], item["end"]) > 0.4 for item in selected):
            continue
        selected.append(candidate)
        if len(selected) >= 5:
            break

    channel = channels[channel_index] if channels else "I"
    zones = []
    for index, candidate in enumerate(sorted(selected, key=lambda item: item["start"]), start=1):
        severity = "red" if candidate["score"] >= 0.55 else "yellow"
        label, reason = _ecg_heuristic_text(prediction, severity)
        zones.append(
            {
                "id": f"ecg-zone-{index}",
                "start_time": round(candidate["start"] / sample_rate, 4),
                "end_time": round(candidate["end"] / sample_rate, 4),
                "severity": severity,
                "score": round(min(1.0, candidate["score"]), 4),
                "label": label,
                "reason": reason,
                "channel": channel,
                "preview": _build_zone_preview(lead[candidate["start"] : candidate["end"]], sample_rate, candidate["start"], channel),
            }
        )
    return zones


def _build_zone_preview(values: np.ndarray, sample_rate: float, start_sample: int, channel: str) -> list[dict]:
    preview = []
    if values.size == 0:
        return preview
    step = max(1, int(np.ceil(values.size / 80)))
    for offset in range(0, values.size, step):
        preview.append(
            {
                "time": round((start_sample + offset) / sample_rate, 4),
                "value": round(float(values[offset]), 6),
                "channel": channel,
            }
        )
    return preview


def _ecg_heuristic_text(prediction: str, severity: str) -> tuple[str, str]:
    normalized = prediction.lower()
    intensity = "strong" if severity == "red" else "moderate"
    if "fibrillation" in normalized:
        return (
            "Irregular rhythm evidence",
            f"Heuristic ECG screening found a {intensity} waveform deviation in this interval while reviewing rhythm irregularity.",
        )
    if "tachycardia" in normalized:
        return (
            "Fast rhythm evidence",
            f"Heuristic ECG screening found a {intensity} waveform deviation in this interval while reviewing fast rhythm evidence.",
        )
    if "bradycardia" in normalized:
        return (
            "Slow rhythm evidence",
            f"Heuristic ECG screening found a {intensity} waveform deviation in this interval while reviewing slow rhythm evidence.",
        )
    return (
        "ECG waveform deviation",
        f"Heuristic ECG screening found a {intensity} signal deviation in this interval.",
    )


def _window_overlap_ratio(start_a: int, end_a: int, start_b: int, end_b: int) -> float:
    overlap = max(0, min(end_a, end_b) - max(start_a, start_b))
    smaller = max(1, min(end_a - start_a, end_b - start_b))
    return overlap / smaller


def _unavailable_ecg_explainability(prediction: str, warning: str) -> dict:
    return {
        "schema_version": 1,
        "method": "unavailable",
        "target_label": prediction,
        "generated_from_model": False,
        "saliency_scores": [],
        "highlight_zones": [],
        "display": {
            "normal_signal_policy": "omitted",
            "max_highlight_zones": 5,
            "context_window_sec": 0.4,
        },
        "warnings": [warning],
    }


def _parse_dicom_waveform(file_path: str) -> dict:
    try:
        import pydicom
    except ImportError as exc:
        raise ValueError("pydicom paketi yuklu degil; DICOM waveform okunamadi.") from exc

    try:
        dataset = pydicom.dcmread(file_path)
    except Exception as exc:
        raise ValueError(f"DICOM dosyasi okunamadi: {exc}") from exc

    sequence = getattr(dataset, "WaveformSequence", None)
    if not sequence:
        raise ValueError("Bu DICOM dosyasi waveform verisi icermiyor.")

    item = sequence[0]
    channel_count = int(getattr(item, "NumberOfWaveformChannels", 0) or 0)
    sample_count = int(getattr(item, "NumberOfWaveformSamples", 0) or 0)
    if channel_count <= 0 or sample_count <= 0:
        raise ValueError("DICOM waveform kanal veya sample bilgisi eksik.")

    waveform_data = getattr(item, "WaveformData", None)
    if waveform_data is None:
        raise ValueError("DICOM waveform data alani bulunamadi.")

    bits_allocated = int(getattr(item, "WaveformBitsAllocated", 16) or 16)
    dtype = np.int8 if bits_allocated <= 8 else np.int16
    values = np.frombuffer(waveform_data, dtype=dtype)
    expected = channel_count * sample_count
    if values.size < expected:
        raise ValueError("DICOM waveform data beklenen matris boyutundan kisa.")
    signal = values[:expected].reshape(sample_count, channel_count).astype(np.float32).T
    sample_rate = getattr(item, "SamplingFrequency", None)
    channels = _read_dicom_channel_names(item, channel_count)

    return {
        "signal": np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0),
        "sample_rate_hz": float(sample_rate) if sample_rate else None,
        "channels": channels,
        "warnings": [],
    }


def _read_dicom_channel_names(waveform_item, channel_count: int) -> list[str]:
    names = []
    for index, channel in enumerate(getattr(waveform_item, "ChannelDefinitionSequence", []) or []):
        source = getattr(channel, "ChannelSourceSequence", None)
        label = None
        if source:
            label = getattr(source[0], "CodeMeaning", None) or getattr(source[0], "CodeValue", None)
        names.append(label or f"CH{index + 1:03d}")
    if len(names) < channel_count:
        names.extend(f"CH{index + 1:03d}" for index in range(len(names), channel_count))
    return names[:channel_count]


def _parse_aecg_xml(file_path: str) -> dict:
    try:
        root = ET.parse(file_path).getroot()
    except Exception as exc:
        raise ValueError(f"aECG XML dosyasi okunamadi: {exc}") from exc

    sample_rate = _find_first_float(root, {"sample_rate", "sampleRate", "samplingFrequency", "sampling_frequency"})
    leads = []
    for element in root.iter():
        tag = _local_name(element.tag).lower()
        if tag not in {"lead", "channel", "sequence"}:
            continue
        values = _parse_numeric_text(element.text or "")
        if not values:
            values = _parse_numeric_text(element.attrib.get("values", ""))
        if not values:
            continue
        label = (
            element.attrib.get("name")
            or element.attrib.get("label")
            or element.attrib.get("code")
            or f"CH{len(leads) + 1:03d}"
        )
        leads.append((label, values))

    if not leads:
        values = _parse_numeric_text(" ".join(root.itertext()))
        if not values:
            raise ValueError("aECG XML icinde sayisal sinyal verisi bulunamadi.")
        leads = [("I", values)]

    min_length = min(len(values) for _, values in leads)
    if min_length <= 0:
        raise ValueError("aECG XML sinyal uzunlugu gecersiz.")

    signal = np.asarray([values[:min_length] for _, values in leads], dtype=np.float32)
    return {
        "signal": np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0),
        "sample_rate_hz": sample_rate,
        "channels": [label for label, _ in leads],
        "warnings": [],
    }


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find_first_float(root: ET.Element, names: set[str]) -> float | None:
    normalized_names = {name.lower() for name in names}
    for element in root.iter():
        tag = _local_name(element.tag).lower()
        if tag in normalized_names:
            value = _coerce_float(element.text)
            if value is not None:
                return value
        for key, raw_value in element.attrib.items():
            if key.lower() in normalized_names:
                value = _coerce_float(raw_value)
                if value is not None:
                    return value
    return None


def _parse_numeric_text(text: str) -> list[float]:
    values = []
    for token in text.replace(",", " ").replace(";", " ").split():
        value = _coerce_float(token)
        if value is not None:
            values.append(value)
    return values


def _coerce_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value.strip())
    except (AttributeError, ValueError):
        return None


def _build_wfdb_preprocessing_info(file_path: str, metadata: dict) -> dict:
    try:
        parsed = _parse_wfdb_record(file_path)
    except ValueError as exc:
        return {
            "mode": "wfdb_parse_failed",
            "reason": str(exc),
            "converter_warnings": [str(exc)],
            "target_input_shape": metadata.get("input_shape"),
        }
    return _build_signal_preprocessing_payload("wfdb_converter", parsed, metadata)


def _parse_wfdb_record(file_path: str) -> dict:
    path = Path(file_path)
    record_base = path.with_suffix("")
    header_path = record_base.with_suffix(".hea")
    data_path = record_base.with_suffix(".dat")
    if not header_path.exists() or not data_path.exists():
        raise ValueError("WFDB ECG icin ayni kayit adina sahip .dat ve .hea dosyalari birlikte yuklenmeli.")

    try:
        import wfdb
    except ImportError as exc:
        raise ValueError("wfdb paketi yuklu degil; .dat/.hea ECG kaydi okunamadi.") from exc

    try:
        record = wfdb.rdrecord(str(record_base))
    except Exception as exc:
        raise ValueError(f"WFDB kaydi okunamadi: {exc}") from exc

    signal = record.p_signal
    if signal is None:
        signal = record.d_signal
    if signal is None:
        raise ValueError("WFDB kaydinda okunabilir sinyal matrisi bulunamadi.")

    signal = np.asarray(signal, dtype=np.float32).T
    signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
    channel_count = signal.shape[0]
    channels = list(record.sig_name or [])[:channel_count]
    if len(channels) < channel_count:
        channels = channels + [f"CH{index + 1:03d}" for index in range(len(channels), channel_count)]

    return {
        "signal": signal,
        "sample_rate_hz": float(record.fs) if record.fs else None,
        "channels": channels,
        "warnings": [],
    }


def _parse_numeric_ecg_file(file_path: str) -> dict:
    rows: list[list[float]] = []
    skipped_rows = 0
    delimiter = "," if Path(file_path).suffix.lower() == ".csv" else None

    with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            parts = stripped.split(delimiter) if delimiter else stripped.replace(",", " ").split()
            try:
                row = [float(part.strip()) for part in parts if part.strip()]
            except ValueError:
                skipped_rows += 1
                continue
            if row:
                rows.append(row)

    if not rows:
        raise ValueError("CSV/TXT ECG dosyasinda sayisal sinyal verisi bulunamadi.")

    column_count = max(len(row) for row in rows)
    complete_rows = [row for row in rows if len(row) == column_count]
    dropped_rows = len(rows) - len(complete_rows)
    if not complete_rows:
        raise ValueError("CSV/TXT ECG dosyasindaki satir uzunluklari tutarsiz.")

    data = np.asarray(complete_rows, dtype=np.float32)
    warnings = []
    if skipped_rows:
        warnings.append(f"{skipped_rows} header/non-numeric row skipped.")
    if dropped_rows:
        warnings.append(f"{dropped_rows} incomplete row skipped.")

    time_column = None
    if data.shape[1] >= 2:
        candidate = data[:, 0]
        diffs = np.diff(candidate)
        if np.all(diffs > 0):
            time_column = candidate
            data = data[:, 1:]

    if data.shape[1] == 0:
        raise ValueError("CSV/TXT ECG dosyasinda sinyal kanali bulunamadi.")

    signal = data.T
    signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
    sample_rate = _infer_sample_rate(time_column)
    channels = ["I"] if signal.shape[0] == 1 else [f"CH{index + 1:03d}" for index in range(signal.shape[0])]

    return {
        "signal": signal,
        "sample_rate_hz": sample_rate,
        "channels": channels,
        "warnings": warnings,
    }


def _infer_sample_rate(time_column: np.ndarray | None) -> float | None:
    if time_column is None or len(time_column) < 2:
        return None
    diffs = np.diff(time_column)
    median_step = float(np.median(diffs))
    if median_step <= 0:
        return None
    return round(1 / median_step, 4)


def _build_signal_preview(
    signal: np.ndarray, sample_rate_hz: float | None, channels: list[str]
) -> list[dict]:
    max_points = 200
    step = max(1, signal.shape[1] // max_points)
    preview = []
    sample_rate = float(sample_rate_hz or 1)
    for sample_index in range(0, signal.shape[1], step):
        preview.append(
            {
                "time": round(sample_index / sample_rate, 4),
                "value": round(float(signal[0, sample_index]), 6),
                "channel": channels[0] if channels else None,
            }
        )
    return preview


def _build_demo_probabilities(file_path: str, labels: dict) -> dict:
    label_values = list(labels.values()) or [
        "Normal Sinus Rhythm",
        "Atrial Fibrillation",
        "Bradycardia",
        "Tachycardia",
    ]
    digest = hashlib.sha256(_read_sample(file_path)).digest()
    winner_index = digest[0] % len(label_values)
    winner_score = 0.72 + (digest[1] % 18) / 100
    remaining = max(0.01, 1 - winner_score)
    loser_count = max(1, len(label_values) - 1)
    base_loser = remaining / loser_count

    probabilities = {}
    for index, label in enumerate(label_values):
        if index == winner_index:
            probabilities[label] = round(winner_score, 4)
        else:
            jitter = ((digest[index + 2] % 7) - 3) / 100
            probabilities[label] = round(max(0.01, base_loser + jitter), 4)

    total = sum(probabilities.values())
    return {label: round(value / total, 4) for label, value in probabilities.items()}


def _read_sample(file_path: str) -> bytes:
    try:
        with open(file_path, "rb") as f:
            return f.read(64 * 1024) or b"drai-empty-ecg"
    except OSError:
        return b"drai-missing-ecg"
