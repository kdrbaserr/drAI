export const MEDICAL_DISCLAIMER =
  'Bu sistem tanı koymaz. Sadece klinik karar destek ve ön analiz amacıyla kullanılır. Nihai değerlendirme sağlık profesyoneli tarafından yapılmalıdır.';

export const mockModelInfo = {
  ecg: {
    name: 'ECG Rhythm Classifier',
    status: 'active',
    version: 'ecg-v1.4.2',
    description: 'EKG sinyal örneklerinden ritim sınıflandırması için demo model.',
  },
  eeg: {
    name: 'EEG Pattern Explorer',
    status: 'experimental',
    version: 'eeg-exp-0.3.1',
    description: 'EEG sinyal pencereleri için deneysel ön analiz akışı.',
  },
};

export const mockResult = {
  id: 'demo-ecg-001',
  analysis_type: 'ecg',
  status: 'completed',
  created_at: new Date().toISOString(),
  data: {
    prediction: 'Sinüs ritmi ile uyumlu ön bulgu',
    confidence: 0.87,
    model_version: 'ecg-v1.4.2',
    probabilities: {
      'Sinüs ritmi': 0.87,
      'Atriyal fibrilasyon şüphesi': 0.08,
      'Diğer ritim paterni': 0.05,
    },
  },
};

export const mockHistory = [
  mockResult,
  {
    id: 'demo-ecg-002',
    analysis_type: 'ecg',
    status: 'completed',
    created_at: '2026-06-02T18:42:00.000Z',
    data: {
      prediction: 'Ritim düzensizliği için klinik inceleme önerilir',
      confidence: 0.74,
      model_version: 'ecg-v1.4.2',
      probabilities: {
        'Klinik inceleme önerilir': 0.74,
        'Sinüs ritmi': 0.18,
        'Belirsiz': 0.08,
      },
    },
  },
  {
    id: 'demo-eeg-001',
    analysis_type: 'eeg',
    status: 'completed',
    created_at: '2026-06-01T10:16:00.000Z',
    data: {
      prediction: 'Deneysel EEG patern eşleşmesi',
      confidence: 0.62,
      model_version: 'eeg-exp-0.3.1',
      probabilities: {
        'Deneysel patern': 0.62,
        'Normal varyasyon': 0.28,
        'Belirsiz': 0.1,
      },
    },
  },
];
