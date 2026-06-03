import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { BackButton, Card, Metric, Pill, ScreenTitle } from '../components/ui';
import { MEDICAL_DISCLAIMER, mockResult } from '../data/mockData';
import { colors, spacing } from '../styles/theme';
import { formatDate, getConfidence, getModelVersion, getPrediction, getProbabilities } from '../utils/result';

export function ResultScreen({ route, navigation }) {
  const result = route.params?.result || mockResult;
  const confidence = getConfidence(result);
  const probabilities = getProbabilities(result);

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton onPress={() => navigation.goBack()} />
        <ScreenTitle
          eyebrow="Result"
          title={`${result.analysis_type?.toUpperCase() || 'ECG'} analiz sonucu`}
          subtitle={`Oluşturulma: ${formatDate(result.created_at)}`}
        />

        <Card style={styles.warning}>
          <Text style={styles.warningTitle}>Tanı koymaz</Text>
          <Text style={styles.warningText}>{MEDICAL_DISCLAIMER}</Text>
        </Card>

        <View style={styles.metrics}>
          <Metric label="Prediction" value={getPrediction(result)} />
          <Metric label="Confidence" value={`${Math.round(confidence * 100)}%`} tone="green" />
          <Metric label="Model version" value={getModelVersion(result)} />
          <Metric label="Status" value={result.status || 'completed'} tone="green" />
        </View>

        <Card style={styles.card}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>Probability chart</Text>
            <Pill label="clinical support" />
          </View>
          <View style={styles.bars}>
            {probabilities.map((item) => (
              <View key={item.label} style={styles.barRow}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{item.label}</Text>
                  <Text style={styles.barValue}>{Math.round(item.value * 100)}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(4, Math.round(item.value * 100))}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Risk/severity ön görünümü</Text>
          <Text style={styles.copy}>
            Bu alan kesin risk sınıflandırması yapmaz; model çıktısının klinik ekip tarafından
            incelenmesi gereken öncelik seviyesini görselleştirmek için kullanılır.
          </Text>
          <View style={styles.severityTrack}>
            <View style={[styles.severityFill, { width: `${Math.min(100, Math.round(confidence * 100))}%` }]} />
          </View>
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
    gap: 18,
    padding: spacing.page,
    paddingTop: 34,
  },
  warning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    gap: 8,
  },
  warningTitle: {
    color: '#ffd5c6',
    fontSize: 18,
    fontWeight: '900',
  },
  warningText: {
    color: '#ffd5c6',
    fontSize: 14,
    lineHeight: 20,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    gap: 16,
  },
  sectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '900',
  },
  bars: {
    gap: 14,
  },
  barRow: {
    gap: 8,
  },
  barLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  barLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  barValue: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
  },
  track: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: '100%',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  severityTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 16,
    overflow: 'hidden',
  },
  severityFill: {
    backgroundColor: colors.red,
    borderRadius: 999,
    height: '100%',
  },
});
