# drAI — Medical Signal AI Platform

An AI-powered platform that analyzes bioelectrical signals such as EEG, EMG, 
and ECG to provide diagnostic support for physicians.

## Project Status
MVP v2.0 — LoRA/QLoRA Fine-Tuning Phase (Week 1 Complete)

## Technology
- **Base Model:** MOMENT-1-large (341M parameters)
- **Fine-Tuning:** QLoRA (4-bit) + LoRA adapters (r=8, alpha=32)
- **Trainable parameters:** 0.46% (1.57M / 342M)
- **Data:** MIT-BIH Arrhythmia Dataset (2500 records, 5 classes, balanced)

## Week 1 Results
| Metric | Value | Target |
|--------|-------|--------|
| Accuracy | 86% | - |
| F1 Score (macro) | 0.855 | ≥ 0.80 ✅ |
| AUC-ROC | 0.978 | ≥ 0.90 ✅ |

## Classes
| Code | Description |
|------|-------------|
| 0 - Normal | Normal heart rhythm |
| 1 - S | Supraventricular premature beat |
| 2 - V | Ventricular premature beat |
| 3 - F | Fusion beat |
| 4 - Q | Unclassifiable beat |

## Installation
```bash
pip install momentfm peft transformers accelerate bitsandbytes
```

## Usage
1. Open `drAI_gun4_5.ipynb` notebook on Kaggle
2. Add MIT-BIH Arrhythmia dataset
3. Run cells sequentially

## ⚠️ Legal Notice
This system is a decision support tool only. It does not diagnose or recommend 
treatment. It is not a medical device. Physician consultation is required for 
every analysis.

## Roadmap
- [x] Week 1: ECG QLoRA fine-tuning
- [ ] Week 2: EEG model, transfer learning
- [ ] Week 3: FastAPI backend, AWS deployment
- [ ] Week 4: React Native mobile application
