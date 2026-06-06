from __future__ import annotations

import math
from typing import Sequence

import numpy as np


def build_gradient_signal_explainability(
    *,
    signal: np.ndarray,
    saliency: np.ndarray,
    sample_rate_hz: float | None,
    channels: Sequence[str],
    target_label: str,
    signal_type: str | None = None,
    method: str = "saliency",
    max_zones: int = 5,
) -> dict:
    """Convert model saliency scores into compact red/yellow signal zones."""
    signal_matrix = _as_channel_time_matrix(signal)
    saliency_matrix = _as_channel_time_matrix(saliency)
    if signal_matrix.size == 0 or saliency_matrix.size == 0:
        return _unavailable_payload(target_label, sample_rate_hz, channels, "No saliency matrix was produced.")

    channel_count = min(signal_matrix.shape[0], saliency_matrix.shape[0])
    sample_count = min(signal_matrix.shape[1], saliency_matrix.shape[1])
    signal_matrix = signal_matrix[:channel_count, :sample_count]
    saliency_matrix = saliency_matrix[:channel_count, :sample_count]
    normalized = _normalize_scores(np.nan_to_num(saliency_matrix, nan=0.0, posinf=0.0, neginf=0.0))
    if float(normalized.max(initial=0.0)) <= 0:
        return _unavailable_payload(target_label, sample_rate_hz, channels, "Model saliency scores were all zero.")

    sample_rate = float(sample_rate_hz or 1.0)
    zone_candidates = _find_highlight_zones(
        normalized,
        signal_matrix,
        sample_rate,
        list(channels),
        target_label=target_label,
        signal_type=signal_type,
        max_zones=max_zones,
    )
    saliency_scores = _build_saliency_points(normalized, sample_rate, list(channels))

    return {
        "schema_version": 1,
        "method": method,
        "target_label": target_label,
        "generated_from_model": True,
        "sample_rate_hz": sample_rate_hz,
        "channels": list(channels),
        "saliency_scores": saliency_scores,
        "highlight_zones": zone_candidates,
        "display": {
            "normal_signal_policy": "omitted",
            "max_highlight_zones": max_zones,
            "context_window_sec": 0.4,
        },
        "warnings": [],
    }


def _as_channel_time_matrix(values: np.ndarray) -> np.ndarray:
    matrix = np.asarray(values, dtype=np.float32)
    if matrix.ndim == 3:
        matrix = matrix[0]
    if matrix.ndim == 1:
        matrix = matrix.reshape(1, -1)
    if matrix.ndim != 2:
        return np.zeros((0, 0), dtype=np.float32)
    return matrix


def _normalize_scores(scores: np.ndarray) -> np.ndarray:
    scores = np.abs(scores.astype(np.float32))
    high = float(np.percentile(scores, 99)) if scores.size else 0.0
    if high <= 0:
        high = float(scores.max(initial=0.0))
    if high <= 0:
        return np.zeros_like(scores, dtype=np.float32)
    return np.clip(scores / high, 0.0, 1.0)


def _find_highlight_zones(
    normalized: np.ndarray,
    signal: np.ndarray,
    sample_rate: float,
    channels: list[str],
    *,
    target_label: str,
    signal_type: str | None,
    max_zones: int,
) -> list[dict]:
    sample_count = normalized.shape[1]
    window_size = _window_size(sample_count, sample_rate)
    stride = max(1, window_size // 2)
    candidates = []

    for channel_index in range(normalized.shape[0]):
        channel_name = _channel_name(channels, channel_index)
        for start in range(0, max(1, sample_count - window_size + 1), stride):
            end = min(sample_count, start + window_size)
            score = float(np.mean(normalized[channel_index, start:end]))
            if score < 0.45:
                continue
            candidates.append(
                {
                    "start": start,
                    "end": end,
                    "score": score,
                    "channel_index": channel_index,
                    "channel": channel_name,
                }
            )

    candidates.sort(key=lambda item: item["score"], reverse=True)
    selected = []
    occupied: dict[int, list[tuple[int, int]]] = {}
    for candidate in candidates:
        channel_index = candidate["channel_index"]
        ranges = occupied.setdefault(channel_index, [])
        if any(_overlap_ratio(candidate["start"], candidate["end"], start, end) > 0.4 for start, end in ranges):
            continue
        ranges.append((candidate["start"], candidate["end"]))
        selected.append(candidate)
        if len(selected) >= max_zones:
            break

    zones = []
    for index, candidate in enumerate(sorted(selected, key=lambda item: item["start"]), start=1):
        severity = "red" if candidate["score"] >= 0.7 else "yellow"
        label, reason = _clinical_zone_text(
            signal_type=signal_type,
            target_label=target_label,
            severity=severity,
            channel=candidate["channel"],
        )
        zones.append(
            {
                "id": f"zone-{index}",
                "start_time": round(candidate["start"] / sample_rate, 4),
                "end_time": round(candidate["end"] / sample_rate, 4),
                "severity": severity,
                "score": round(candidate["score"], 4),
                "label": label,
                "reason": reason,
                "channel": candidate["channel"],
                "preview": _build_zone_preview(
                    signal[candidate["channel_index"], candidate["start"] : candidate["end"]],
                    sample_rate,
                    candidate["start"],
                    candidate["channel"],
                ),
            }
        )
    return zones


def _clinical_zone_text(
    *,
    signal_type: str | None,
    target_label: str,
    severity: str,
    channel: str,
) -> tuple[str, str]:
    normalized_label = target_label.lower()
    intensity = "strongly" if severity == "red" else "moderately"

    if signal_type == "ecg":
        if "atrial fibrillation" in normalized_label or "fibrillation" in normalized_label:
            return (
                "Irregular rhythm evidence",
                f"The model {intensity} focused on this ECG window while supporting an irregular rhythm prediction.",
            )
        if "tachycardia" in normalized_label:
            return (
                "Fast rhythm evidence",
                f"The model {intensity} focused on this ECG window while supporting a tachycardia prediction.",
            )
        if "bradycardia" in normalized_label:
            return (
                "Slow rhythm evidence",
                f"The model {intensity} focused on this ECG window while supporting a bradycardia prediction.",
            )
        if "normal" in normalized_label:
            return (
                "Reference rhythm segment",
                f"The model {intensity} used this ECG window as supportive evidence for the predicted rhythm class.",
            )
        return (
            "ECG decision-support segment",
            f"The model {intensity} focused on this ECG window for the predicted class.",
        )

    if signal_type == "eeg":
        movement_label = target_label.replace("_", " ")
        return (
            f"EEG attention segment on {channel}",
            f"The model {intensity} focused on channel {channel} in this time window while supporting the '{movement_label}' prediction.",
        )

    return (
        "Model-attention signal segment",
        f"The model gradient was {intensity} concentrated in this time window for the predicted class.",
    )


def _build_saliency_points(normalized: np.ndarray, sample_rate: float, channels: list[str]) -> list[dict]:
    points = []
    sample_count = normalized.shape[1]
    step = max(1, math.ceil(sample_count / 120))
    for channel_index in range(normalized.shape[0]):
        channel_name = _channel_name(channels, channel_index)
        for sample_index in range(0, sample_count, step):
            score = float(normalized[channel_index, sample_index])
            if score < 0.25:
                continue
            points.append(
                {
                    "time": round(sample_index / sample_rate, 4),
                    "score": round(score, 4),
                    "channel": channel_name,
                }
            )
    points.sort(key=lambda item: item["score"], reverse=True)
    return points[:240]


def _build_zone_preview(values: np.ndarray, sample_rate: float, start_sample: int, channel: str) -> list[dict]:
    preview = []
    if values.size == 0:
        return preview
    step = max(1, math.ceil(values.size / 80))
    for offset in range(0, values.size, step):
        preview.append(
            {
                "time": round((start_sample + offset) / sample_rate, 4),
                "value": round(float(values[offset]), 6),
                "channel": channel,
            }
        )
    return preview


def _window_size(sample_count: int, sample_rate: float) -> int:
    if sample_rate <= 1:
        return max(8, min(sample_count, sample_count // 6 or sample_count))
    return max(8, min(sample_count, int(sample_rate * 0.5)))


def _overlap_ratio(start_a: int, end_a: int, start_b: int, end_b: int) -> float:
    overlap = max(0, min(end_a, end_b) - max(start_a, start_b))
    smaller = max(1, min(end_a - start_a, end_b - start_b))
    return overlap / smaller


def _channel_name(channels: list[str], index: int) -> str:
    return channels[index] if index < len(channels) else f"CH{index + 1:03d}"


def _unavailable_payload(
    target_label: str,
    sample_rate_hz: float | None,
    channels: Sequence[str],
    warning: str,
) -> dict:
    return {
        "schema_version": 1,
        "method": "unavailable",
        "target_label": target_label,
        "generated_from_model": False,
        "sample_rate_hz": sample_rate_hz,
        "channels": list(channels),
        "saliency_scores": [],
        "highlight_zones": [],
        "display": {
            "normal_signal_policy": "omitted",
            "max_highlight_zones": 5,
            "context_window_sec": 0.4,
        },
        "warnings": [warning],
    }
