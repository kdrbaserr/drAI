"""Inference support for the published EEG-ECG-READER LoRA adapter.

Base model: AutonLab/MOMENT-1-small
Adapter: kdrbaserr/EEG-ECG-READER
Input: EDF file converted to 68 channels with 512 samples per channel.
"""

import logging
import os
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

from app.ml.explainability import build_gradient_signal_explainability

logger = logging.getLogger(__name__)
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

BASE_MODEL_ID = "AutonLab/MOMENT-1-small"
ADAPTER_ID = "kdrbaserr/EEG-ECG-READER"
MODEL_VERSION = "1.0.0-lora-merged-runtime"

LABEL_MAP = {
    0: "rest",
    1: "left_fist",
    2: "right_fist",
    3: "both_fists",
    4: "both_feet",
}
NUM_CLASSES = len(LABEL_MAP)
SEQ_LEN = 512
N_CHANNELS = 68

_model = None


class _SafeConfig:
    """Expose the config helpers PEFT expects from a MOMENT pipeline."""

    def __init__(self, base_config):
        object.__setattr__(self, "_base", base_config)

    def __getattr__(self, key):
        return getattr(object.__getattribute__(self, "_base"), key, None)

    def get(self, key, default=None):
        return getattr(object.__getattribute__(self, "_base"), key, default)

    def to_dict(self):
        return {"model_type": "moment", "tie_word_embeddings": False}


def _load_model():
    """Load the compatible base model, merge the LoRA adapter, and cache it."""
    global _model
    if _model is not None:
        return _model

    try:
        import torch.nn as nn
        from momentfm import MOMENTPipeline
        from peft import PeftModel

        logger.info("Loading compatible base model: %s", BASE_MODEL_ID)
        base = MOMENTPipeline.from_pretrained(
            BASE_MODEL_ID,
            model_kwargs={
                "task_name": "classification",
                "n_channels": N_CHANNELS,
                "num_class": NUM_CLASSES,
            },
        )
        base.init()
        base.config = _SafeConfig(base.config)

        try:
            base.head.linear = nn.Linear(base.head.linear.in_features, NUM_CLASSES)
        except AttributeError:
            logger.debug("MOMENT classification head has no replaceable linear layer.")

        logger.info("Applying and merging LoRA adapter: %s", ADAPTER_ID)
        model = PeftModel.from_pretrained(base, ADAPTER_ID)
        model = model.merge_and_unload()
        model.eval()

        _model = model
        logger.info("Merged EEG model is ready.")
        return _model
    except Exception as exc:
        logger.exception("Failed to load EEG model: %s", exc)
        raise


def _preprocess_edf(file_path: str) -> np.ndarray:
    """Return an EDF signal tensor shaped as (1, N_CHANNELS, SEQ_LEN)."""
    try:
        import mne

        mne.set_log_level("WARNING")
        raw = mne.io.read_raw_edf(file_path, preload=True, verbose=False)
        data, _ = raw[:]
        segment = data[:N_CHANNELS, :SEQ_LEN].astype(np.float32)
        segment = np.pad(
            segment,
            (
                (0, max(0, N_CHANNELS - segment.shape[0])),
                (0, max(0, SEQ_LEN - segment.shape[1])),
            ),
        )
        segment = segment[:N_CHANNELS, :SEQ_LEN]
        segment = (segment - segment.mean(axis=1, keepdims=True)) / (
            segment.std(axis=1, keepdims=True) + 1e-8
        )
        return segment.reshape(1, N_CHANNELS, SEQ_LEN)
    except ImportError:
        logger.warning("MNE is unavailable; using random signal in demo mode.")
        return np.random.randn(1, N_CHANNELS, SEQ_LEN).astype(np.float32)
    except Exception as exc:
        logger.error("EDF preprocessing failed (%s); using zero signal.", exc)
        return np.zeros((1, N_CHANNELS, SEQ_LEN), dtype=np.float32)


def _read_edf_metadata(file_path: str) -> dict:
    try:
        import mne

        mne.set_log_level("WARNING")
        raw = mne.io.read_raw_edf(file_path, preload=False, verbose=False)
        sample_rate = float(raw.info["sfreq"]) if raw.info.get("sfreq") else None
        return {
            "sample_rate_hz": sample_rate,
            "channels": list(raw.ch_names),
            "duration_sec": round(raw.n_times / sample_rate, 4) if sample_rate else None,
        }
    except ImportError:
        return {"converter_warnings": ["MNE is unavailable; EDF metadata could not be read."]}
    except Exception as exc:
        logger.error("EDF metadata extraction failed: %s", exc)
        return {"converter_warnings": [f"EDF metadata could not be read: {exc}"]}


def _build_signal_preview(signal: np.ndarray, sample_rate_hz: float | None) -> list[dict]:
    signal = np.asarray(signal, dtype=np.float32)
    matrix = signal[0] if signal.ndim == 3 else signal
    if matrix.ndim != 2 or matrix.shape[0] == 0 or matrix.shape[1] == 0:
        return []
    max_points = 200
    step = max(1, matrix.shape[1] // max_points)
    sample_rate = float(sample_rate_hz or 1)
    preview = []
    for sample_index in range(0, matrix.shape[1], step):
        preview.append(
            {
                "time": round(sample_index / sample_rate, 4),
                "value": round(float(matrix[0, sample_index]), 6),
                "channel": "CH001",
            }
        )
    return preview


def _build_preprocessing_info(file_path: str, signal: np.ndarray) -> dict:
    metadata = _read_edf_metadata(file_path)
    warnings = metadata.get("converter_warnings", [])
    channels = metadata.get("channels") or [f"CH{index + 1:03d}" for index in range(N_CHANNELS)]
    sample_rate = metadata.get("sample_rate_hz")

    return {
        "mode": "mne_edf_converter",
        "seq_len": SEQ_LEN,
        "n_channels": N_CHANNELS,
        "file": os.path.basename(file_path),
        "sample_rate_hz": sample_rate,
        "channels": channels[:N_CHANNELS],
        "duration_sec": metadata.get("duration_sec"),
        "matrix_shape": [N_CHANNELS, SEQ_LEN],
        "signal_preview": _build_signal_preview(signal, sample_rate),
        "converter_warnings": warnings,
    }


def predict_eeg(file_path: str) -> dict:
    """Run EEG motor-imagery classification on an uploaded EDF file."""
    preprocessing_info = {
        "seq_len": SEQ_LEN,
        "n_channels": N_CHANNELS,
        "file": os.path.basename(file_path),
    }
    try:
        import torch

        signal = _preprocess_edf(file_path)
        preprocessing_info = _build_preprocessing_info(file_path, signal)
        tensor = torch.tensor(signal, requires_grad=True)
        model = _load_model()

        output = model(x_enc=tensor)

        if hasattr(output, "logits"):
            logits = output.logits
        elif isinstance(output, dict) and "logits" in output:
            logits = output["logits"]
        elif isinstance(output, (tuple, list)):
            logits = output[0]
        else:
            logits = output

        probs = torch.softmax(logits, dim=-1).squeeze()
        probs_py = probs.tolist()
        if isinstance(probs_py, float):
            probs_py = [probs_py]

        pred_idx = int(np.argmax(probs_py))
        confidence = float(probs_py[pred_idx])
        label = LABEL_MAP.get(pred_idx, "unknown")
        all_probs = {LABEL_MAP[i]: round(float(p), 4) for i, p in enumerate(probs_py)}
        explainability = _build_eeg_explainability(
            tensor=tensor,
            logits=logits,
            pred_idx=pred_idx,
            signal=signal,
            preprocessing_info=preprocessing_info,
            label=label,
        )

        return {
            "status": "success",
            "prediction": label,
            "confidence": round(confidence, 4),
            "all_probabilities": all_probs,
            "model_version": MODEL_VERSION,
            "explainability": explainability,
            "preprocessing_info": preprocessing_info,
        }
    except Exception as exc:
        logger.exception("EEG inference failed: %s", exc)
        return {
            "status": "error",
            "prediction": "unknown",
            "confidence": 0.0,
            "all_probabilities": {},
            "model_version": MODEL_VERSION,
            "error": str(exc),
            "preprocessing_info": preprocessing_info,
        }


def _build_eeg_explainability(
    *,
    tensor,
    logits,
    pred_idx: int,
    signal: np.ndarray,
    preprocessing_info: dict,
    label: str,
) -> dict:
    try:
        if tensor.grad is not None:
            tensor.grad.zero_()
        target_logit = logits.reshape(-1)[pred_idx]
        target_logit.backward()
        gradient = tensor.grad.detach().cpu().numpy()
        saliency = np.abs(gradient * signal)
        return build_gradient_signal_explainability(
            signal=signal,
            saliency=saliency,
            sample_rate_hz=preprocessing_info.get("sample_rate_hz"),
            channels=preprocessing_info.get("channels", []),
            target_label=label,
            method="saliency",
        )
    except Exception as exc:
        logger.exception("EEG explainability failed: %s", exc)
        return {
            "schema_version": 1,
            "method": "unavailable",
            "target_label": label,
            "generated_from_model": False,
            "sample_rate_hz": preprocessing_info.get("sample_rate_hz"),
            "channels": preprocessing_info.get("channels", []),
            "saliency_scores": [],
            "highlight_zones": [],
            "display": {
                "normal_signal_policy": "omitted",
                "max_highlight_zones": 5,
                "context_window_sec": 0.4,
            },
            "warnings": [f"EEG explainability could not be generated: {exc}"],
        }


def preview_eeg(file_path: str) -> dict:
    signal = _preprocess_edf(file_path)
    preprocessing_info = _build_preprocessing_info(file_path, signal)
    warnings = preprocessing_info.get("converter_warnings", [])
    readable = not warnings
    return {
        "status": "success" if readable else "error",
        "readable": readable,
        "model_version": MODEL_VERSION,
        "preprocessing_info": preprocessing_info,
        "converter_warnings": warnings,
        "error": warnings[0] if warnings else None,
    }
