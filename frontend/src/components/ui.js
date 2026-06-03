import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shadow, spacing } from '../styles/theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = 'green' }) {
  return <Text style={[styles.pill, tone === 'red' && styles.pillRed, tone === 'amber' && styles.pillAmber]}>{label}</Text>;
}

export function Button({ title, onPress, loading, disabled, variant = 'primary' }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.faint} {...props} />
    </View>
  );
}

export function ScreenTitle({ eyebrow, title, subtitle }) {
  return (
    <View style={styles.titleBlock}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function BackButton({ onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.back}>
      <Text style={styles.backText}>‹ Geri</Text>
    </Pressable>
  );
}

export function Metric({ label, value, tone }) {
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === 'green' && styles.greenText, tone === 'red' && styles.redText]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    padding: 14,
    ...shadow,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(41,245,184,0.12)',
    borderColor: 'rgba(41,245,184,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  pillRed: {
    backgroundColor: 'rgba(255,79,104,0.12)',
    borderColor: 'rgba(255,79,104,0.35)',
    color: colors.red,
  },
  pillAmber: {
    backgroundColor: 'rgba(255,207,107,0.13)',
    borderColor: 'rgba(255,207,107,0.38)',
    color: colors.amber,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: spacing.radius,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(56,215,255,0.13)',
    borderColor: 'rgba(56,215,255,0.36)',
    borderWidth: 1,
  },
  buttonDanger: {
    backgroundColor: colors.red,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '900',
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  titleBlock: {
    gap: 7,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 30,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
  },
  backText: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
  metric: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: 8,
    minHeight: 76,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  greenText: {
    color: colors.green,
  },
  redText: {
    color: colors.red,
  },
});
