import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeartbeatBackground } from '../components/HeartbeatBackground';
import { Logo } from '../components/Logo';
import { Button, Card, Pill } from '../components/ui';
import { MEDICAL_DISCLAIMER } from '../data/mockData';
import { colors, spacing } from '../styles/theme';
import { useAuth } from '../auth/AuthContext';

export function WelcomeScreen({ navigation }) {
  const { startDemoSession } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <HeartbeatBackground intensity="hero" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Logo />
          <Pill label="Clinical decision support" />
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>AI destekli EKG/EEG sinyal analiz platformu</Text>
          <Text style={styles.copy}>
            drAI, EKG öncelikli demo akışında sinyal dosyasını alır, model sonucunu güven
            skoru ve olasılık dağılımıyla profesyonel bir dashboard üzerinde gösterir.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="Demo panelini aç" onPress={startDemoSession} />
          <Button title="Giriş yap" onPress={() => navigation.navigate('Login')} />
          <Button title="Kayıt ol" variant="secondary" onPress={() => navigation.navigate('Register')} />
        </View>

        <Card style={styles.monitor}>
          <View style={styles.monitorTop}>
            <Text style={styles.monitorLabel}>ECG model</Text>
            <Pill label="active" />
          </View>
          <Text style={styles.monitorValue}>87%</Text>
          <Text style={styles.monitorCopy}>Demo confidence göstergesi - ecg-v1.4.2</Text>
        </Card>

        <Card style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{MEDICAL_DISCLAIMER}</Text>
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
    gap: 22,
    minHeight: '100%',
    padding: spacing.page,
    paddingTop: 46,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: {
    gap: 14,
    paddingTop: 26,
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  copy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  monitor: {
    gap: 10,
  },
  monitorTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monitorLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  monitorValue: {
    color: colors.green,
    fontSize: 54,
    fontWeight: '900',
  },
  monitorCopy: {
    color: colors.muted,
    fontSize: 14,
  },
  disclaimer: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  disclaimerText: {
    color: '#ffd5c6',
    fontSize: 14,
    lineHeight: 20,
  },
});
