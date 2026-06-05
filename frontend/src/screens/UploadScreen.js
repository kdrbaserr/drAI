import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { BackButton, Button, Card, Pill, ScreenTitle } from '../components/ui';
import { mockResult } from '../data/mockData';
import { api, getApiErrorMessage } from '../services/api';
import { colors, spacing } from '../styles/theme';

const signalTypes = [
  { label: 'ECG', value: 'ecg', note: '.csv, .txt, .dat' },
  { label: 'EEG', value: 'eeg', note: '.edf · experimental' },
];

const allowed = {
  ecg: ['dat', 'csv', 'txt'],
  eeg: ['edf'],
};

const formatGuide = {
  ecg: {
    supported: '.csv, .txt, .dat',
    planned: '.hea, .dcm, .xml',
    note: 'WFDB kayıtlarında .dat dosyası çoğu zaman aynı isimli .hea başlığıyla gelir; .hea desteği sonraki backend adımında eklenecek.',
  },
  eeg: {
    supported: '.edf',
    planned: '.bdf, .vhdr/.vmrk/.eeg',
    note: 'BrainVision kayıtları üçlü dosya grubudur; .vhdr, .vmrk ve .eeg aynı kayıt seti olarak tutulmalıdır.',
  },
};

const multiFileWarnings = {
  dat: 'WFDB formatı genelde .dat + .hea çifti ister; .hea desteği sonraki backend adımında gelecek.',
  hea: 'WFDB için .dat dosyası da gerekir; şu an backend .hea upload kabul etmiyor.',
  vhdr: 'BrainVision için .vhdr + .vmrk + .eeg dosyaları birlikte gerekir.',
  vmrk: 'BrainVision için .vhdr + .vmrk + .eeg dosyaları birlikte gerekir.',
  eeg: 'BrainVision için .vhdr + .vmrk + .eeg dosyaları birlikte gerekir.',
};

export function UploadScreen({ navigation }) {
  const [signalType, setSignalType] = React.useState('ecg');
  const [file, setFile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const pickFile = async () => {
    setError('');
    try {
      const response = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
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
      const selected = response.assets?.[0];
      if (!selected) {
        setError('Dosya seçilemedi.');
        return;
      }
      setFile(selected);
    } catch {
      setError('Dosya seçme işlemi tamamlanamadı.');
    }
  };

  const analyze = async () => {
    if (!file) {
      setError('Önce bir dosya seç.');
      return;
    }

    const extension = getFileExtension(file.name);
    if (!allowed[signalType].includes(extension)) {
      setError(`${signalType.toUpperCase()} analizi için ${allowed[signalType].map((item) => `.${item}`).join(', ')} dosyası gerekli.`);
      return;
    }

    setError('');
    setLoading(true);
    const formData = new FormData();
    await appendUploadFile(formData, file);

    try {
      const response = await api.post(`/analyze/${signalType}`, formData);
      navigation.navigate('Result', { result: response.data });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Backend yanıt vermedi. Demo sonucunu görüntüleyebilirsin.'));
    } finally {
      setLoading(false);
    }
  };

  const selectedExtension = getFileExtension(file?.name);
  const selectedGuide = formatGuide[signalType];
  const multiFileWarning = multiFileWarnings[selectedExtension];

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground intensity="hero" />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />
        <ScreenTitle
          eyebrow="Analyze"
          title="Sinyal dosyasını yükle"
          subtitle="ECG ve EEG dosyaları backend converter katmanında standart sinyal formatına hazırlanır."
        />

        <Card style={styles.card}>
          <Text style={styles.label}>Sinyal türü</Text>
          <View style={styles.segment}>
            {signalTypes.map((type) => (
              <Pressable
                key={type.value}
                style={[styles.segmentItem, signalType === type.value && styles.segmentActive]}
                onPress={() => setSignalType(type.value)}
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
            <Text style={styles.guideKey}>Şu an</Text>
            <Text style={styles.guideValue}>{selectedGuide.supported}</Text>
          </View>
          <View style={styles.guideRow}>
            <Text style={styles.guideKey}>Sıradaki</Text>
            <Text style={styles.guideValue}>{selectedGuide.planned}</Text>
          </View>
          <Text style={styles.guideNote}>{selectedGuide.note}</Text>
        </Card>

        <Pressable onPress={pickFile}>
          <Card style={styles.dropzone}>
            <Pill label="drag & drop ready" tone="amber" />
            <Text style={styles.dropTitle}>{file ? file.name : 'Dosya seç'}</Text>
            <Text style={styles.dropMeta}>Desteklenen formatlar: {selectedGuide.supported}</Text>
            {file ? <Text style={styles.dropMeta}>Seçilen dosya türü: .{selectedExtension || 'bilinmiyor'}</Text> : null}
          </Card>
        </Pressable>

        {multiFileWarning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{multiFileWarning}</Text>
          </View>
        ) : null}

        {loading ? (
          <Card style={styles.loader}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.loaderText}>Medikal sinyal analiz ediliyor...</Text>
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Analyze" onPress={analyze} loading={loading} disabled={!file} />
        <Button title="Demo sonucunu aç" variant="secondary" onPress={() => navigation.navigate('Result', { result: mockResult })} />
      </ScrollView>
    </SafeAreaView>
  );
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

async function appendUploadFile(formData, selectedFile) {
  if (Platform.OS === 'web') {
    if (selectedFile.file instanceof Blob) {
      formData.append('file', selectedFile.file, selectedFile.name);
      return;
    }

    const response = await fetch(selectedFile.uri);
    const blob = await response.blob();
    formData.append('file', blob, selectedFile.name);
    return;
  }

  formData.append('file', {
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
