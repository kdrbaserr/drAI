from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SignalType(str, Enum):
    ECG = "ecg"
    EEG = "eeg"


class SourceFormat(str, Enum):
    UNKNOWN = "unknown"
    CSV = "csv"
    TXT = "txt"
    EDF = "edf"
    BDF = "bdf"
    BRAINVISION = "brainvision"
    WFDB = "wfdb"
    DICOM = "dicom"
    AECG_XML = "aecg_xml"


class SignalPreviewPoint(BaseModel):
    time: float
    value: float
    channel: str | None = None

    model_config = ConfigDict(extra="forbid")


class StandardSignalMetadata(BaseModel):
    signal_type: SignalType
    source_format: SourceFormat = SourceFormat.UNKNOWN
    sample_rate_hz: float | None = Field(default=None, gt=0)
    channels: list[str] = Field(default_factory=list)
    duration_sec: float | None = Field(default=None, ge=0)
    matrix_shape: list[int] | None = None
    normalized_path: str | None = None
    txt_export_path: str | None = None
    signal_preview: list[SignalPreviewPoint] = Field(default_factory=list)
    converter_warnings: list[str] = Field(default_factory=list)
    original_filename: str | None = None
    content_type: str | None = None

    model_config = ConfigDict(extra="forbid", use_enum_values=True)


class ConvertPreviewResponse(BaseModel):
    signal_type: SignalType
    readable: bool
    filenames: list[str]
    standard_signal: StandardSignalMetadata
    preprocessing: dict[str, Any] = Field(default_factory=dict)
    converter_warnings: list[str] = Field(default_factory=list)
    error: str | None = None

    model_config = ConfigDict(use_enum_values=True)


_EXTENSION_FORMATS = {
    ".csv": SourceFormat.CSV,
    ".txt": SourceFormat.TXT,
    ".edf": SourceFormat.EDF,
    ".bdf": SourceFormat.BDF,
    ".vhdr": SourceFormat.BRAINVISION,
    ".vmrk": SourceFormat.BRAINVISION,
    ".eeg": SourceFormat.BRAINVISION,
    ".dat": SourceFormat.WFDB,
    ".hea": SourceFormat.WFDB,
    ".dcm": SourceFormat.DICOM,
    ".xml": SourceFormat.AECG_XML,
}


def infer_source_format(filename: str | None) -> SourceFormat:
    extension = Path(filename or "").suffix.lower()
    return _EXTENSION_FORMATS.get(extension, SourceFormat.UNKNOWN)


def build_standard_signal_metadata(
    *,
    signal_type: str,
    filename: str | None,
    content_type: str | None,
    preprocessing_info: dict[str, Any] | None = None,
    converter_warnings: list[str] | None = None,
) -> StandardSignalMetadata:
    preprocessing_info = preprocessing_info or {}
    channel_count = preprocessing_info.get("n_channels")
    seq_len = preprocessing_info.get("seq_len")
    channels = preprocessing_info.get("channels")

    if not isinstance(channels, list):
        channels = []
        if isinstance(channel_count, int) and channel_count > 0:
            channels = [f"CH{index + 1:03d}" for index in range(channel_count)]

    matrix_shape = preprocessing_info.get("matrix_shape")
    if matrix_shape is None and isinstance(channel_count, int) and isinstance(seq_len, int):
        matrix_shape = [channel_count, seq_len]

    return StandardSignalMetadata(
        signal_type=SignalType(signal_type),
        source_format=infer_source_format(filename),
        sample_rate_hz=preprocessing_info.get("sample_rate_hz"),
        channels=channels,
        duration_sec=preprocessing_info.get("duration_sec"),
        matrix_shape=matrix_shape,
        normalized_path=preprocessing_info.get("normalized_path"),
        txt_export_path=preprocessing_info.get("txt_export_path"),
        signal_preview=preprocessing_info.get("signal_preview", []),
        converter_warnings=converter_warnings or preprocessing_info.get("converter_warnings", []),
        original_filename=filename,
        content_type=content_type,
    )
