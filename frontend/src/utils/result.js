export function normalizeConfidence(value) {
  const numeric = Number(value) || 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

export function getPrediction(result = {}) {
  return result.diagnosis?.result || result.data?.prediction || 'Ön analiz sonucu yok';
}

export function getConfidence(result = {}) {
  return normalizeConfidence(result.diagnosis?.confidence ?? result.data?.confidence ?? 0);
}

export function getModelVersion(result = {}) {
  return result.data?.model_version || parseModelVersion(result.diagnosis?.details) || 'unknown';
}

export function getProbabilities(result = {}) {
  const prediction = getPrediction(result);
  const confidence = getConfidence(result);
  const raw = result.data?.probabilities || result.data?.all_probabilities || {};
  const entries = Object.entries(raw);

  if (!entries.length) {
    return [{ label: prediction, value: confidence }];
  }

  return entries
    .map(([label, value]) => ({ label, value: normalizeConfidence(value) }))
    .sort((a, b) => b.value - a.value);
}

export function formatDate(value) {
  if (!value) return 'Bilinmiyor';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR');
}

export function parseModelVersion(details = '') {
  const marker = 'Model Version: ';
  return details.includes(marker) ? details.split(marker).pop() : '';
}
