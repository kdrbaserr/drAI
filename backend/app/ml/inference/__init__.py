"""
Inference Module
"""

from .ecg import predict_ecg
from .eeg import predict_eeg

__all__ = ["predict_ecg", "predict_eeg"]
