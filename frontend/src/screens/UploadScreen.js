import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { BackButton, Button, Card, Pill, ScreenTitle } from '../components/ui';
import { mockResult } from '../data/mockData';
import { api, getApiErrorMessage } from '../services/api';
import { colors, spacing } from '../styles/theme';

const signalTypes = [
  { label: 'ECG', value: 'ecg', note: '.csv, .txt, .dat/.hea, .dcm, .xml' },
  { label: 'EEG', value: 'eeg', note: '.edf - experimental' },
];

const allowed = {
  ecg: ['dat', 'hea', 'csv', 'txt', 'dcm', 'xml'],
  eeg: ['edf'],
};

const formatGuide = {
  ecg: {
    supported: '.csv, .txt, .dat + .hea, .dcm, .xml',
    planned: 'DICOM/XML vendor varyasyon testleri',
    note: 'WFDB kayitlari icin .dat ve ayni isimli .hea dosyasini birlikte sec. DICOM waveform .dcm ve aECG .xml tek dosya olarak yuklenebilir.',
  },
  eeg: {
    supported: '.edf',
    planned: '.bdf, .vhdr/.vmrk/.eeg',
    note: 'BrainVision kayitlari uclu dosya grubudur; .vhdr, .vmrk ve .eeg ayni kayit seti olarak tutulmalidir.',
  },
};

const multiFileWarnings = {
  dat: 'WFDB icin ayni kayit adina sahip .dat + .hea dosyalarini birlikte sec.',
  hea: 'WFDB icin ayni kayit adina sahip .dat + .hea dosyalarini birlikte sec.',
  vhdr: 'BrainVision icin .vhdr + .vmrk + .eeg dosyalari birlikte gerekir.',
  vmrk: 'BrainVision icin .vhdr + .vmrk + .eeg dosyalari birlikte gerekir.',
  eeg: 'BrainVision icin .vhdr + .vmrk + .eeg dosyalari birlikte gerekir.',
};

export function UploadScreen({ navigation }) {
  const [signalType, setSignalType] = React.useState('ecg');
  const [files, setFiles] = React.useState([]);
  const [preview, setPreview] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const pickFile = async () => {
    setError('');
    try {
      const response = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: signalType === 'ecg',
        type: [
          'text/csv',
          'text/plain',
          'application/octet-stream',
          'application/x-edf',
          'application/edf',
          'application/xml',
          'text/xml',
        ],
      });
      if (response.canceled) return;
      const selected = response.assets || [];
      if (!selected.length) {
        setError('Dosya secilemedi.');
        return;
      }
      setFiles(selected);
      setPreview(null);
    } catch {
      setError('Dosya secme islemi tamamlanamadi.');
    }
  };

  const previewConversion = async () => {
    if (!files.length) {
      setError('Once bir dosya sec.');
      return;
    }

    const validationError = validateSelection(files, signalType);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setPreview(null);
    setPreviewLoading(true);
    const formData = new FormData();
    await appendUploadFiles(formData, files, signalType);

    try {
      const response = await api.post(`/convert/preview/${signalType}`, formData);
      setPreview(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Converter preview alinamadi.'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const analyze = async () => {
    if (!files.length) {
      setError('Once bir dosya sec.');
      return;
    }

    const validationError = validateSelection(files, signalType);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    const formData = new FormData();
    await appendUploadFiles(formData, files, signalType);

    try {
      const response = await api.post(`/analyze/${signalType}`, formData);
      navigation.navigate('Result', { result: response.data });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Backend yanit vermedi. Demo sonucunu goruntuleyebilirsin.'));
    } finally {
      setLoading(false);
    }
  };

  const selectedGuide = formatGuide[signalType];
  const selectedExtensions = files.map((item) => getFileExtension(item.name)).filter(Boolean);
  const primaryExtension = selectedExtensions[0];
  const multiFileWarning = multiFileWarnings[primaryExtension];
  const selectedNames = files.map((item) => item.name).join(', ');

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground intensity="hero" />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />
        <ScreenTitle
          eyebrow="Analyze"
          title="Sinyal dosyasini yukle"
          subtitle="ECG ve EEG dosyalari backend converter katmaninda standart sinyal formatina hazirlanir."
        />

        <Card style={styles.card}>
          <Text style={styles.label}>Sinyal turu</Text>
          <View style={styles.segment}>
            {signalTypes.map((type) => (
              <Pressable
                key={type.value}
                style={[styles.segmentItem, signalType === type.value && styles.segmentActive]}
                onPress={() => {
          setSignalType(type.value);
          setFiles([]);
          setPreview(null);
          setError('');
        }}
              >
                <Text style={[styles.segmentTitle, signalType === type.value && styles.segmentTitleActive]}>{type.label}</Text>
                <Text style={styles.segmentNote}>{type.note}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.label}>Format rehberi</Text>
          <View style={styles.guideRow}>
            <Text style={styles.guideKey}>Su an</Text>
            <Text style={styles.guideValue}>{selectedGuide.supported}</Text>
          </View>
          <View style={styles.guideRow}>
            <Text style={styles.guideKey}>Siradaki</Text>
            <Text style={styles.guideValue}>{selectedGuide.planned}</Text>
          </View>
          <Text style={styles.guideNote}>{selectedGuide.note}</Text>
        </Card>

        <Pressable onPress={pickFile}>
          <Card style={styles.dropzone}>
            <Pill label="drag & drop ready" tone="amber" />
            <Text style={styles.dropTitle}>{files.length ? selectedNames : 'Dosya sec'}</Text>
            <Text style={styles.dropMeta}>Desteklenen formatlar: {selectedGuide.supported}</Text>
            {files.length ? <Text style={styles.dropMeta}>Secilen dosya turleri: {selectedExtensions.map((item) => `.${item}`).join(', ')}</Text> : null}
          </Card>
        </Pressable>

        {multiFileWarning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{multiFileWarning}</Text>
          </View>
        ) : null}

        {previewLoading ? (
          <Card style={styles.loader}>
            <ActivityIndicator color={colors.cyan} />
            <Text style={styles.loaderText}>Converter preview hazirlaniyor...</Text>
          </Card>
        ) : null}

        {preview ? <PreviewPanel preview={preview} /> : null}

        {loading ? (
          <Card style={styles.loader}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.loaderText}>Medikal sinyal analiz ediliyor...</Text>
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Preview converter" variant="secondary" onPress={previewConversion} loading={previewLoading} disabled={!files.length} />
        <Button title="Analyze" onPress={analyze} loading={loading} disabled={!files.length} />
        <Button title="Demo sonucunu ac" variant="secondary" onPress={() => navigation.navigate('Result', { result: mockResult })} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PreviewPanel({ preview }) {
  const signal = preview.standard_signal || {};
  const statusLabel = preview.readable ? 'Okunabilir' : 'Okunamadi';
  const statusStyle = preview.readable ? styles.previewStatusOk : styles.previewStatusError;
  return (
    <Card style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <Text style={styles.label}>Converter preview</Text>
        <Text style={[styles.previewStatus, statusStyle]}>{statusLabel}</Text>
      </View>
      <View style={styles.previewGrid}>
        <PreviewItem label="Format" value={signal.source_format || '-'} />
        <PreviewItem label="Sample rate" value={signal.sample_rate_hz ? `${signal.sample_rate_hz} Hz` : '-'} />
        <PreviewItem label="Kanal" value={signal.channels?.length ? String(signal.channels.length) : '-'} />
        <PreviewItem label="Sure" value={signal.duration_sec ? `${signal.duration_sec} sn` : '-'} />
        <PreviewItem label="Shape" value={signal.matrix_shape?.join(' x ') || '-'} />
        <PreviewItem label="Dosya" value={preview.filenames?.join(', ') || '-'} />
      </View>
      {preview.error ? <Text style={styles.previewError}>{preview.error}</Text> : null}
      {preview.converter_warnings?.length ? (
        <Text style={styles.previewWarning}>{preview.converter_warnings.join(' | ')}</Text>
      ) : null}
    </Card>
  );
}

function PreviewItem({ label, value }) {
  return (
    <View style={styles.previewItem}>
      <Text style={styles.previewItemLabel}>{label}</Text>
      <Text style={styles.previewItemValue}>{value}</Text>
    </View>
  );
}

function validateSelection(selectedFiles, signalType) {
  const extensions = selectedFiles.map((item) => getFileExtension(item.name));
  const invalid = extensions.find((extension) => !allowed[signalType].includes(extension));
  if (invalid) {
    return `${signalType.toUpperCase()} analizi icin ${allowed[signalType].map((item) => `.${item}`).join(', ')} dosyasi gerekli.`;
  }

  if (signalType === 'ecg') {
    const hasDat = extensions.includes('dat');
    const hasHea = extensions.includes('hea');
    if (hasDat !== hasHea) {
      return 'WFDB kaydi icin .dat ve ayni isimli .hea dosyasini birlikte sec.';
    }
    if (hasDat && !wfdbStemsMatch(selectedFiles)) {
      return 'WFDB .dat ve .hea dosyalari ayni kayit adina sahip olmali.';
    }
  }

  return '';
}

function wfdbStemsMatch(selectedFiles) {
  const wfdbFiles = selectedFiles.filter((item) => ['dat', 'hea'].includes(getFileExtension(item.name)));
  const stems = new Set(wfdbFiles.map((item) => item.name.replace(/\.[^.]+$/, '')));
  return stems.size <= 1;
}

function getFileExtension(filename = '') {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getMimeType(filename) {
  const extension = getFileExtension(filename);
  if (extension === 'csv') return 'text/csv';
  if (extension === 'txt') return 'text/plain';
  if (extension === 'xml') return 'application/xml';
  return 'application/octet-stream';
}

async function appendUploadFiles(formData, selectedFiles, signalType) {
  const fieldName = signalType === 'ecg' && selectedFiles.length > 1 ? 'files' : 'file';
  for (const selectedFile of selectedFiles) {
    await appendUploadFile(formData, selectedFile, fieldName);
  }
}

async function appendUploadFile(formData, selectedFile, fieldName) {
  if (Platform.OS === 'web') {
    if (selectedFile.file instanceof Blob) {
      formData.append(fieldName, selectedFile.file, selectedFile.name);
      return;
    }

    const response = await fetch(selectedFile.uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, selectedFile.name);
    return;
  }

  formData.append(fieldName, {
    uri: selectedFile.uri,
    name: selectedFile.name,
    type: selectedFile.mimeType || getMimeType(selectedFile.name),
  });
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    gap: 15,
    padding: spacing.page,
    paddingTop: 26,
  },
  card: {
    gap: 12,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  segment: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 72,
    padding: 10,
  },
  segmentActive: {
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(41,245,184,0.1)',
  },
  segmentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  segmentTitleActive: {
    color: colors.green,
  },
  segmentNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  guideRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  guideKey: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 72,
    textTransform: 'uppercase',
  },
  guideValue: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  guideNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  dropzone: {
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    gap: 12,
    minHeight: 116,
    justifyContent: 'center',
  },
  dropTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  dropMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  warningText: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  previewCard: {
    gap: 12,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewStatus: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewStatusOk: {
    backgroundColor: 'rgba(41,245,184,0.12)',
    color: colors.green,
  },
  previewStatusError: {
    backgroundColor: 'rgba(255,79,104,0.14)',
    color: colors.red,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewItem: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 130,
    padding: 10,
  },
  previewItemLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewItemValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
  },
  previewError: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 19,
  },
  previewWarning: {
    color: colors.amber,
    fontSize: 13,
    lineHeight: 19,
  },
  loader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  loaderText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '800',
  },
  error: {
    color: colors.red,
    fontSize: 14,
    lineHeight: 20,
  },
});
