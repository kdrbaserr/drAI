import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { BackButton, Card, Metric, Pill, ScreenTitle } from '../components/ui';
import { MEDICAL_DISCLAIMER, mockResult } from '../data/mockData';
import { colors, spacing } from '../styles/theme';
import {
  formatDate,
  getConfidence,
  getExplainabilityMethod,
  getExplainabilityWarnings,
  getHighlightZones,
  getModelVersion,
  getPrediction,
  getProbabilities,
} from '../utils/result';

const WAVEFORM_HEIGHT = 92;
const MOBILE_WAVEFORM_WIDTH = 320;
const DESKTOP_WAVEFORM_WIDTH = 520;

export function ResultScreen({ route, navigation }) {
  const { width } = useWindowDimensions();
  const result = route.params?.result || mockResult;
  const confidence = getConfidence(result);
  const probabilities = getProbabilities(result);
  const highlightZones = getHighlightZones(result);
  const explainabilityMethod = getExplainabilityMethod(result);
  const explainabilityWarnings = getExplainabilityWarnings(result);
  const isWide = width >= 760;

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground />
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
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

        <SignalExplanationCard
          isWide={isWide}
          method={explainabilityMethod}
          warnings={explainabilityWarnings}
          zones={highlightZones}
        />

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

function SignalExplanationCard({ isWide, method, warnings, zones }) {
  const methodLabel = method === 'heuristic' ? 'signal scan' : method;
  const waveformWidth = isWide ? DESKTOP_WAVEFORM_WIDTH : MOBILE_WAVEFORM_WIDTH;

  return (
    <Card style={styles.card}>
      <View style={styles.sectionTop}>
        <Text style={styles.sectionTitle}>Problemli sinyal bölgeleri</Text>
        <Pill label={zones.length ? `${zones.length} segment` : methodLabel} tone={zones.length ? 'amber' : 'green'} />
      </View>

      {zones.length ? (
        <View style={[styles.zoneList, isWide && styles.zoneListWide]}>
          {zones.map((zone) => (
            <SignalZoneCard
              isWide={isWide}
              key={zone.id || `${zone.start_time}-${zone.end_time}-${zone.channel}`}
              waveformWidth={waveformWidth}
              zone={zone}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.copy}>
          {warnings[0] || 'Bu analiz için red/yellow sinyal segmenti henüz üretilmedi.'}
        </Text>
      )}
    </Card>
  );
}

function SignalZoneCard({ isWide, waveformWidth, zone }) {
  const isRed = zone.severity === 'red';
  const tone = isRed ? 'red' : 'amber';
  const stroke = isRed ? colors.red : colors.amber;
  const range = formatTimeRange(zone.start_time, zone.end_time);

  return (
    <View style={[styles.zoneCard, isWide && styles.zoneCardWide, isRed ? styles.zoneRed : styles.zoneYellow]}>
      <View style={styles.zoneHeader}>
        <View style={styles.zoneTitleBlock}>
          <Text style={styles.zoneTitle}>{zone.label || 'Model-attention segment'}</Text>
          <Text style={styles.zoneMeta}>{[range, zone.channel].filter(Boolean).join('  |  ')}</Text>
        </View>
        <Pill label={zone.severity || 'zone'} tone={tone} />
      </View>

      <WaveformPreview points={zone.preview} stroke={stroke} width={waveformWidth} />

      <Text style={styles.zoneReason}>{zone.reason}</Text>
    </View>
  );
}

function WaveformPreview({ points, stroke, width }) {
  const path = buildWaveformPath(points, width, WAVEFORM_HEIGHT);

  return (
    <View style={styles.waveformFrame}>
      <Svg width="100%" height={WAVEFORM_HEIGHT} viewBox={`0 0 ${width} ${WAVEFORM_HEIGHT}`}>
        <Rect x="0" y="0" width={width} height={WAVEFORM_HEIGHT} rx="8" fill="rgba(255,255,255,0.035)" />
        <Line x1="0" y1={WAVEFORM_HEIGHT / 2} x2={width} y2={WAVEFORM_HEIGHT / 2} stroke="rgba(255,255,255,0.13)" strokeWidth="1" />
        <Path d={path} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function buildWaveformPath(points = [], width, height) {
  if (!points.length) return '';
  const values = points.map((point) => Number(point.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.000001, max - min);
  const xStep = points.length > 1 ? width / (points.length - 1) : width;
  const verticalPadding = 12;
  const usableHeight = height - verticalPadding * 2;

  return values
    .map((value, index) => {
      const x = Math.round(index * xStep * 100) / 100;
      const y = Math.round((verticalPadding + (1 - (value - min) / span) * usableHeight) * 100) / 100;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function formatTimeRange(start, end) {
  const startNum = Number(start);
  const endNum = Number(end);
  if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) return '';
  return `${startNum.toFixed(2)}s-${endNum.toFixed(2)}s`;
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
  contentWide: {
    alignSelf: 'center',
    maxWidth: 1120,
    width: '100%',
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
    fontSize: 13,
    lineHeight: 19,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    gap: 13,
  },
  sectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  bars: {
    gap: 12,
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
    fontSize: 13,
    fontWeight: '800',
  },
  barValue: {
    color: colors.green,
    fontSize: 13,
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
    fontSize: 13,
    lineHeight: 19,
  },
  zoneList: {
    gap: 12,
  },
  zoneListWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  zoneCard: {
    borderRadius: spacing.radius,
    borderWidth: 1,
    flexGrow: 1,
    gap: 10,
    minWidth: 0,
    padding: 11,
  },
  zoneCardWide: {
    flexBasis: '48%',
    minWidth: 330,
  },
  zoneRed: {
    backgroundColor: 'rgba(255,79,104,0.08)',
    borderColor: 'rgba(255,79,104,0.32)',
  },
  zoneYellow: {
    backgroundColor: 'rgba(255,207,107,0.08)',
    borderColor: 'rgba(255,207,107,0.32)',
  },
  zoneHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  zoneTitleBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  zoneTitle: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  zoneMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  waveformFrame: {
    borderRadius: spacing.radius,
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
  },
  zoneReason: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
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
