import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { Logo } from '../components/Logo';
import { Button, Card, Metric, Pill, ScreenTitle } from '../components/ui';
import { MEDICAL_DISCLAIMER, mockHistory, mockModelInfo } from '../data/mockData';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';
import { useAuth } from '../auth/AuthContext';
import { formatDate, getConfidence, getModelVersion, getPrediction } from '../utils/result';

export function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [modelInfo, setModelInfo] = React.useState(mockModelInfo);
  const [recent, setRecent] = React.useState(mockHistory);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [modelResponse, historyResponse] = await Promise.all([
          api.get('/model/info'),
          api.get('/history'),
        ]);
        if (!mounted) return;
        setModelInfo(modelResponse.data?.models || mockModelInfo);
        setRecent(Array.isArray(historyResponse.data) && historyResponse.data.length ? historyResponse.data : mockHistory);
      } catch {
        if (mounted) {
          setModelInfo(mockModelInfo);
          setRecent(mockHistory);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground intensity="hero" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}>
          <Logo compact />
          <Button title="Profil" variant="secondary" onPress={() => navigation.navigate('Profile')} />
        </View>

        <ScreenTitle
          eyebrow="Dashboard"
          title={`Hoş geldin${user ? `, ${user}` : ''}`}
          subtitle="EKG öncelikli demo akışını başlat, model durumunu izle ve son analizlere hızlıca dön."
        />

        <View style={styles.cta}>
          <Button title="Yeni analiz başlat" onPress={() => navigation.navigate('Upload')} />
          <Button title="Geçmiş analizler" variant="secondary" onPress={() => navigation.navigate('History')} />
        </View>

        <View style={styles.metrics}>
          <Metric label="ECG model" value={modelInfo.ecg?.status || 'active'} tone="green" />
          <Metric label="EEG model" value={modelInfo.eeg?.status || 'experimental'} />
          <Metric label="Model version" value={modelInfo.ecg?.version || 'ecg-v1.4.2'} />
          <Metric label="Health" value="API ready" tone="green" />
        </View>

        <Card style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>Medikal uyarı</Text>
          <Text style={styles.disclaimerText}>{MEDICAL_DISCLAIMER}</Text>
        </Card>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Son analizler</Text>
          <Pill label="mock + API" tone="amber" />
        </View>

        <View style={styles.list}>
          {recent.slice(0, 3).map((item) => (
            <Card key={item.id} style={styles.analysisCard}>
              <View style={styles.cardTop}>
                <Pill label={item.analysis_type?.toUpperCase() || 'ECG'} tone={item.analysis_type === 'eeg' ? 'amber' : 'green'} />
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={styles.prediction}>{getPrediction(item)}</Text>
              <Text style={styles.meta}>
                Confidence {Math.round(getConfidence(item) * 100)}% · {getModelVersion(item)}
              </Text>
              <Button title="Detayı aç" variant="secondary" onPress={() => navigation.navigate('Result', { result: item })} />
            </Card>
          ))}
        </View>
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
    padding: spacing.page,
    paddingTop: 26,
  },
  nav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cta: {
    gap: 10,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  disclaimer: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    gap: 7,
  },
  disclaimerTitle: {
    color: '#ffd5c6',
    fontSize: 14,
    fontWeight: '900',
  },
  disclaimerText: {
    color: '#ffd5c6',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  list: {
    gap: 12,
  },
  analysisCard: {
    gap: 12,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  date: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  prediction: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
});
