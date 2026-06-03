import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { BackButton, Card, Pill, ScreenTitle } from '../components/ui';
import { mockHistory } from '../data/mockData';
import { api } from '../services/api';
import { colors, spacing } from '../styles/theme';
import { formatDate, getConfidence, getModelVersion, getPrediction } from '../utils/result';

export function HistoryScreen({ navigation }) {
  const [items, setItems] = React.useState(mockHistory);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await api.get('/history');
        if (mounted && Array.isArray(response.data) && response.data.length) setItems(response.data);
      } catch {
        if (mounted) setItems(mockHistory);
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
        <ScreenTitle eyebrow="History" title="Geçmiş analizler" subtitle="Önceki sonuçlar tarih, sinyal türü, confidence ve model versiyonuyla listelenir." />
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable key={item.id} onPress={() => navigation.navigate('Result', { result: item })}>
              <Card style={styles.card}>
                <View style={styles.top}>
                  <Pill label={item.analysis_type?.toUpperCase() || 'ECG'} tone={item.analysis_type === 'eeg' ? 'amber' : 'green'} />
                  <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.prediction}>{getPrediction(item)}</Text>
                <Text style={styles.meta}>
                  Confidence {Math.round(getConfidence(item) * 100)}% · {getModelVersion(item)}
                </Text>
              </Card>
            </Pressable>
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
    gap: 15,
    padding: spacing.page,
    paddingTop: 26,
  },
  list: {
    gap: 10,
  },
  card: {
    gap: 10,
  },
  top: {
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
