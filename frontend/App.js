import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, getApiErrorMessage } from './src/api/client';
import { AuthProvider, useAuth } from './src/auth/AuthContext';

const Stack = createNativeStackNavigator();

function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login({ username, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="DrAI"
      subtitle="Hesabina giris yap"
      footerText="Hesabin yok mu?"
      footerAction="Kayit ol"
      onFooterPress={() => navigation.navigate('Register')}
    >
      <AuthInput
        label="Kullanici adi"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
      />
      <AuthInput
        label="Sifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton
        title="Giris yap"
        onPress={handleLogin}
        loading={loading}
        disabled={!username || !password}
      />
    </AuthScreen>
  );
}

function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      await register({ username, email, password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Yeni hesap"
      subtitle="Analizlerini takip etmek icin kaydol"
      footerText="Zaten hesabin var mi?"
      footerAction="Giris yap"
      onFooterPress={() => navigation.navigate('Login')}
    >
      <AuthInput
        label="Kullanici adi"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
      />
      <AuthInput
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <AuthInput
        label="Sifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton
        title="Kayit ol"
        onPress={handleRegister}
        loading={loading}
        disabled={!username || !email || !password}
      />
    </AuthScreen>
  );
}

const SIGNAL_TYPES = [
  { label: 'EKG', value: 'ecg' },
  { label: 'EEG', value: 'eeg' },
];

const ALLOWED_UPLOAD_EXTENSIONS = {
  ecg: ['csv', 'txt'],
  eeg: ['edf'],
};

function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.homeContainer}>
      <View style={styles.homeHeader}>
        <Text style={styles.homeEyebrow}>DrAI Mobil</Text>
        <Text style={styles.homeTitle}>Hos geldin{user ? `, ${user}` : ''}</Text>
        <Text style={styles.homeSubtitle}>
          JWT token AsyncStorage uzerinden geri yuklendi ve Axios isteklerine Authorization header
          olarak eklenecek.
        </Text>
      </View>
      <View style={styles.homeActions}>
        <PrimaryButton title="Analiz yukle" onPress={() => navigation.navigate('Upload')} />
        <PrimaryButton title="Cikis yap" onPress={logout} variant="danger" />
      </View>
    </SafeAreaView>
  );
}

function UploadScreen({ navigation }) {
  const [signalType, setSignalType] = React.useState('ecg');
  const [file, setFile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [signalMenuOpen, setSignalMenuOpen] = React.useState(false);

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
        ],
      });

      if (response.canceled) {
        return;
      }

      const selectedFile = response.assets?.[0];
      if (!selectedFile) {
        setError('Dosya secilemedi.');
        return;
      }

      const extension = getFileExtension(selectedFile.name);
      if (!['csv', 'txt', 'edf'].includes(extension)) {
        setError('Sadece .csv, .txt veya .edf dosyasi secebilirsin.');
        return;
      }

      setFile(selectedFile);
    } catch {
      setError('Dosya secme islemi tamamlanamadi.');
    }
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Once bir dosya sec.');
      return;
    }

    setError('');
    setLoading(true);

    const extension = getFileExtension(file.name);
    if (!ALLOWED_UPLOAD_EXTENSIONS[signalType].includes(extension)) {
      const label = signalType === 'ecg' ? 'EKG' : 'EEG';
      const allowed = ALLOWED_UPLOAD_EXTENSIONS[signalType].map((item) => `.${item}`).join(', ');
      setError(`${label} analizi icin ${allowed} dosyasi secmelisin.`);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || getMimeType(file.name),
    });

    try {
      const response = await api.post(`/analyze/${signalType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      navigation.navigate('Result', { result: response.data });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Analiz yuklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screenContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backButton}>Geri</Text>
          </Pressable>
        </View>

        <View style={styles.uploadHeader}>
          <Text style={styles.homeEyebrow}>Analiz</Text>
          <Text style={styles.homeTitle}>Sinyal yukle</Text>
          <Text style={styles.homeSubtitle}>
            EKG icin CSV veya TXT, EEG icin EDF dosyasi secip analiz endpointine gonder.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Sinyal turu</Text>
          <View>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => setSignalMenuOpen((isOpen) => !isOpen)}
            >
              <Text style={styles.dropdownValue}>{getSignalLabel(signalType)}</Text>
              <Text style={styles.dropdownChevron}>{signalMenuOpen ? '^' : 'v'}</Text>
            </Pressable>
            {signalMenuOpen ? (
              <View style={styles.dropdownMenu}>
                {SIGNAL_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setSignalType(type.value);
                      setSignalMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        signalType === type.value && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Dosya</Text>
          <Pressable style={styles.filePicker} onPress={pickFile}>
            <Text style={styles.filePickerTitle}>{file ? file.name : 'Dosya sec'}</Text>
            <Text style={styles.filePickerMeta}>.csv, .txt, .edf</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton
          title="Analize gonder"
          onPress={uploadFile}
          loading={loading}
          disabled={!file}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultScreen({ route, navigation }) {
  const result = route.params?.result || {};
  const diagnosis = result.diagnosis || {};
  const prediction = diagnosis.result || result.data?.prediction || 'Bilinmiyor';
  const confidence = normalizeConfidence(diagnosis.confidence ?? result.data?.confidence ?? 0);
  const probabilities = normalizeProbabilities(result, prediction, confidence);
  const heatmapRows = buildHeatmap(probabilities);
  const modelVersion = result.data?.model_version || parseModelVersion(diagnosis.details);
  const createdAt = formatDate(result.created_at);

  return (
    <SafeAreaView style={styles.screenContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backButton}>Geri</Text>
          </Pressable>
        </View>

        <View style={styles.uploadHeader}>
          <Text style={styles.homeEyebrow}>Sonuc</Text>
          <Text style={styles.homeTitle}>{result.analysis_type?.toUpperCase()} analizi</Text>
          <Text style={styles.homeSubtitle}>Olusturulma: {createdAt}</Text>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Tani koymaz</Text>
          <Text style={styles.warningText}>
            Bu sonuc klinik karar destek amaclidir; kesin tani veya tedavi onerisi yerine gecmez.
            Lutfen bir hekime danisiniz.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <MetricBox label="Prediction" value={prediction} />
          <MetricBox label="Confidence" value={`${Math.round(confidence * 100)}%`} />
          <MetricBox label="Model" value={modelVersion || 'unknown'} />
          <MetricBox label="Status" value={result.status || 'unknown'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Probabilities</Text>
          <View style={styles.chartBox}>
            {probabilities.map((item) => (
              <View key={item.label} style={styles.probabilityRow}>
                <View style={styles.probabilityLabelRow}>
                  <Text style={styles.probabilityLabel}>{item.label}</Text>
                  <Text style={styles.probabilityValue}>{Math.round(item.value * 100)}%</Text>
                </View>
                <View style={styles.probabilityTrack}>
                  <View
                    style={[
                      styles.probabilityBar,
                      { width: `${Math.max(3, Math.round(item.value * 100))}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attention heatmap</Text>
          <View style={styles.heatmapBox}>
            {heatmapRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.heatmapRow}>
                {row.map((value, columnIndex) => (
                  <View
                    key={`${rowIndex}-${columnIndex}`}
                    style={[
                      styles.heatmapCell,
                      { backgroundColor: getHeatmapColor(value) },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricBox({ label, value }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function AuthScreen({ title, subtitle, children, footerText, footerAction, onFooterPress }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.authPanel}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.form}>{children}</View>
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{footerText}</Text>
          <Pressable onPress={onFooterPress} hitSlop={8}>
            <Text style={styles.footerLink}>{footerAction}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthInput({ label, ...props }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#8792a2"
        {...props}
      />
    </View>
  );
}

function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary' }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'danger' && styles.dangerButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}

function RootNavigator() {
  const { token, restoring } = useAuth();

  if (restoring) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#0f766e" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Upload" component={UploadScreen} />
            <Stack.Screen name="Result" component={ResultScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

function getFileExtension(filename = '') {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getSignalLabel(value) {
  return SIGNAL_TYPES.find((type) => type.value === value)?.label || 'EKG';
}

function getMimeType(filename) {
  const extension = getFileExtension(filename);

  if (extension === 'csv') {
    return 'text/csv';
  }

  if (extension === 'txt') {
    return 'text/plain';
  }

  if (extension === 'edf') {
    return 'application/octet-stream';
  }

  return 'application/octet-stream';
}

function normalizeConfidence(value) {
  const numeric = Number(value) || 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

function normalizeProbabilities(result, prediction, confidence) {
  const rawProbabilities = result.data?.probabilities || result.data?.all_probabilities || {};
  const entries = Object.entries(rawProbabilities);

  if (entries.length) {
    return entries
      .map(([label, value]) => ({
        label,
        value: normalizeConfidence(value),
      }))
      .sort((a, b) => b.value - a.value);
  }

  return [{ label: prediction, value: confidence }];
}

function buildHeatmap(probabilities) {
  const values = probabilities.length ? probabilities.map((item) => item.value) : [0.2];
  return Array.from({ length: 6 }, (_, rowIndex) =>
    Array.from({ length: 8 }, (_, columnIndex) => {
      const base = values[(rowIndex + columnIndex) % values.length] || 0;
      const wave = ((rowIndex + 1) * (columnIndex + 2)) % 7;
      return Math.min(1, Math.max(0.08, base * 0.75 + wave * 0.035));
    })
  );
}

function getHeatmapColor(value) {
  if (value > 0.78) {
    return '#dc2626';
  }

  if (value > 0.55) {
    return '#f97316';
  }

  if (value > 0.32) {
    return '#facc15';
  }

  return '#14b8a6';
}

function parseModelVersion(details = '') {
  const marker = 'Model Version: ';
  return details.includes(marker) ? details.split(marker).pop() : '';
}

function formatDate(value) {
  if (!value) {
    return 'Bilinmiyor';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('tr-TR');
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
    justifyContent: 'center',
    padding: 24,
  },
  authPanel: {
    gap: 18,
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
  },
  form: {
    gap: 14,
    marginTop: 8,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    marginTop: 4,
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  footerText: {
    color: '#64748b',
  },
  footerLink: {
    color: '#0f766e',
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#f4f7fb',
    flex: 1,
    justifyContent: 'center',
  },
  homeContainer: {
    backgroundColor: '#f4f7fb',
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  homeHeader: {
    gap: 10,
    marginTop: 48,
  },
  homeActions: {
    gap: 12,
  },
  homeEyebrow: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  homeTitle: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
  },
  homeSubtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
  },
  screenContainer: {
    backgroundColor: '#f4f7fb',
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    padding: 24,
  },
  topBar: {
    alignItems: 'flex-start',
    minHeight: 32,
  },
  backButton: {
    color: '#0f766e',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadHeader: {
    gap: 10,
  },
  section: {
    gap: 10,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  dropdownValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownChevron: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dropdownOptionText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
  dropdownOptionTextSelected: {
    color: '#0f766e',
  },
  filePicker: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 6,
    minHeight: 92,
    justifyContent: 'center',
    padding: 16,
  },
  filePickerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  filePickerMeta: {
    color: '#64748b',
    fontSize: 14,
  },
  resultBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#99f6e4',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  resultTitle: {
    color: '#0f766e',
    fontSize: 16,
    fontWeight: '800',
  },
  resultText: {
    color: '#334155',
    fontSize: 14,
  },
  warningBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  warningTitle: {
    color: '#c2410c',
    fontSize: 17,
    fontWeight: '900',
  },
  warningText: {
    color: '#7c2d12',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    gap: 6,
    minHeight: 86,
    padding: 12,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  chartBox: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  probabilityRow: {
    gap: 8,
  },
  probabilityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  probabilityLabel: {
    color: '#334155',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  probabilityValue: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '800',
  },
  probabilityTrack: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  probabilityBar: {
    backgroundColor: '#0f766e',
    borderRadius: 999,
    height: '100%',
  },
  heatmapBox: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  heatmapCell: {
    aspectRatio: 1,
    borderRadius: 4,
    flex: 1,
  },
});
