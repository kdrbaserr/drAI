import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

function HomeScreen() {
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
      <PrimaryButton title="Cikis yap" onPress={logout} variant="danger" />
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
          <Stack.Screen name="Home" component={HomeScreen} />
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
});
