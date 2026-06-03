import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { Logo } from '../components/Logo';
import { BackButton, Button, Card, ScreenTitle, TextField } from '../components/ui';
import { colors, spacing } from '../styles/theme';
import { useAuth } from '../auth/AuthContext';

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
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
    <AuthShell navigation={navigation} title="Güvenli oturum" subtitle="Demo paneline devam etmek için giriş yap.">
      <TextField label="Kullanıcı adı veya e-posta" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextField label="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Giriş yap" onPress={submit} loading={loading} disabled={!username || !password} />
      <Button title="Yeni hesap oluştur" variant="secondary" onPress={() => navigation.navigate('Register')} />
    </AuthShell>
  );
}

export function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
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
    <AuthShell navigation={navigation} title="drAI hesabı" subtitle="Analiz geçmişi ve sonuç detayları için hesap oluştur.">
      <TextField label="Kullanıcı adı" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextField label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Kayıt ol" onPress={submit} loading={loading} disabled={!username || !email || !password} />
      <Button title="Giriş ekranına dön" variant="secondary" onPress={() => navigation.navigate('Login')} />
    </AuthShell>
  );
}

function AuthShell({ children, navigation, title, subtitle }) {
  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.navigate('Welcome')} />
        <View style={styles.logoRow}>
          <Logo />
        </View>
        <Card style={styles.card}>
          <ScreenTitle eyebrow="JWT auth ready" title={title} subtitle={subtitle} />
          <View style={styles.form}>{children}</View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    gap: 16,
    minHeight: '100%',
    padding: spacing.page,
    paddingTop: 26,
  },
  logoRow: {
    paddingTop: 12,
  },
  card: {
    gap: 16,
  },
  form: {
    gap: 12,
  },
  error: {
    color: colors.red,
    fontSize: 14,
    lineHeight: 20,
  },
});
