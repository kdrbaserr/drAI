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
    explainability: {
      schema_version: 1,
      method: 'saliency',
      target_label: 'Sinus rhythm',
      generated_from_model: true,
      highlight_zones: [
        {
          id: 'zone-1',
          start_time: 0.82,
          end_time: 1.32,
          severity: 'yellow',
          score: 0.58,
          label: 'Reference rhythm segment',
          reason: 'The model moderately used this ECG window as supportive evidence for the predicted rhythm class.',
          channel: 'II',
          preview: [
            { time: 0.82, value: 0.05, channel: 'II' },
            { time: 0.88, value: 0.12, channel: 'II' },
            { time: 0.94, value: 0.48, channel: 'II' },
            { time: 1.0, value: -0.18, channel: 'II' },
            { time: 1.06, value: 0.08, channel: 'II' },
            { time: 1.12, value: 0.1, channel: 'II' },
            { time: 1.18, value: 0.42, channel: 'II' },
            { time: 1.24, value: -0.14, channel: 'II' },
            { time: 1.3, value: 0.04, channel: 'II' },
          ],
        },
        {
          id: 'zone-2',
          start_time: 2.04,
          end_time: 2.54,
          severity: 'red',
          score: 0.86,
          label: 'Irregular rhythm evidence',
          reason: 'The model strongly focused on this ECG window while checking rhythm regularity for the predicted class.',
          channel: 'II',
          preview: [
            { time: 2.04, value: 0.02, channel: 'II' },
            { time: 2.1, value: 0.18, channel: 'II' },
            { time: 2.16, value: 0.63, channel: 'II' },
            { time: 2.22, value: -0.24, channel: 'II' },
            { time: 2.28, value: 0.06, channel: 'II' },
            { time: 2.34, value: 0.51, channel: 'II' },
            { time: 2.4, value: -0.2, channel: 'II' },
            { time: 2.46, value: 0.1, channel: 'II' },
            { time: 2.52, value: 0.04, channel: 'II' },
          ],
        },
      ],
      display: {
        normal_signal_policy: 'omitted',
        max_highlight_zones: 5,
        context_window_sec: 0.4,
      },
      warnings: [],
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
