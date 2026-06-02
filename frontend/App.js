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
  const [result, setResult] = React.useState(null);
  const [signalMenuOpen, setSignalMenuOpen] = React.useState(false);

  const pickFile = async () => {
    setError('');
    setResult(null);

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
    setResult(null);
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
      setResult(response.data);
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

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Analiz tamamlandi</Text>
            <Text style={styles.resultText}>Durum: {result.status}</Text>
            <Text style={styles.resultText}>Tip: {result.analysis_type?.toUpperCase()}</Text>
            {result.diagnosis ? (
              <>
                <Text style={styles.resultText}>Sonuc: {result.diagnosis.result}</Text>
                <Text style={styles.resultText}>
                  Guven: {Math.round(result.diagnosis.confidence)}%
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

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
});
