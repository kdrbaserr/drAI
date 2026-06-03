import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { BackButton, Button, Card, Pill, ScreenTitle } from '../components/ui';
import { MEDICAL_DISCLAIMER, mockModelInfo } from '../data/mockData';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';
import { useAuth } from '../auth/AuthContext';

export function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [modelInfo, setModelInfo] = React.useState(mockModelInfo);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await api.get('/model/info');
        if (mounted) setModelInfo(response.data?.models || mockModelInfo);
      } catch {
        if (mounted) setModelInfo(mockModelInfo);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />
        <ScreenTitle eyebrow="Settings" title="Profil ve model bilgisi" subtitle="Oturum, model info, KVKK ve medikal kullanım uyarıları." />

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Kullanıcı</Text>
          <Info label="Kullanıcı" value={user || 'Demo kullanıcı'} />
          <Info label="Oturum" value="Aktif" />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Model info</Text>
          {Object.entries(modelInfo).map(([key, model]) => (
            <View key={key} style={styles.modelBlock}>
              <View style={styles.modelTop}>
                <Text style={styles.modelName}>{model.name || key.toUpperCase()}</Text>
                <Pill label={model.status || 'unknown'} tone={model.status === 'experimental' ? 'amber' : 'green'} />
              </View>
              <Info label="Sinyal" value={key.toUpperCase()} />
              <Info label="Versiyon" value={model.version || 'unknown'} />
              <Text style={styles.copy}>{model.description}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.warning}>
          <Text style={styles.warningTitle}>KVKK / privacy / medical disclaimer</Text>
          <Text style={styles.warningText}>
            Kişisel ve sağlık verileri hassas veri niteliğindedir. Demo akışı klinik karar
            destek amacıyla tasarlanmıştır. {MEDICAL_DISCLAIMER}
          </Text>
        </Card>

        <Button title="Logout" variant="danger" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
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
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  info: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  modelBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 14,
  },
  modelTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modelName: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  warning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    gap: 8,
  },
  warningTitle: {
    color: '#ffd5c6',
    fontSize: 16,
    fontWeight: '900',
  },
  warningText: {
    color: '#ffd5c6',
    fontSize: 14,
    lineHeight: 21,
  },
});
