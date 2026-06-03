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
        type: ['text/csv', 'text/plain', 'application/octet-stream', 'application/x-edf', 'application/edf'],
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

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground intensity="hero" />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />
        <ScreenTitle
          eyebrow="Analyze"
          title="Sinyal dosyasını yükle"
          subtitle="Multipart/form-data ile /analyze/ecg veya /analyze/eeg endpointine hazır akış."
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

        <Pressable onPress={pickFile}>
          <Card style={styles.dropzone}>
            <Pill label="drag & drop ready" tone="amber" />
            <Text style={styles.dropTitle}>{file ? file.name : 'Dosya seç'}</Text>
            <Text style={styles.dropMeta}>Desteklenen formatlar: .csv, .txt, .dat, .edf</Text>
          </Card>
        </Pressable>

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
    gap: 18,
    padding: spacing.page,
    paddingTop: 34,
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
    minHeight: 88,
    padding: 12,
  },
  segmentActive: {
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(41,245,184,0.1)',
  },
  segmentTitle: {
    color: colors.text,
    fontSize: 21,
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
  dropzone: {
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    gap: 12,
    minHeight: 150,
    justifyContent: 'center',
  },
  dropTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  dropMeta: {
    color: colors.muted,
    fontSize: 14,
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
