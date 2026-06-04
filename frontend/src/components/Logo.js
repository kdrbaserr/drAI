import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../styles/theme';

export function Logo({ compact = false }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, compact && styles.markSmall]}>
        <Svg width={compact ? 28 : 36} height={compact ? 28 : 36} viewBox="0 0 36 36">
          <Circle cx="18" cy="18" r="17" fill="rgba(41,245,184,0.12)" stroke={colors.borderStrong} />
          <Path
            d="M8 19h5l2-5 4 12 3-8h6"
            fill="none"
            stroke={colors.green}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
          <Path
            d="M13 12c2-4 8-4 10 0"
            fill="none"
            stroke={colors.cyan}
            strokeLinecap="round"
            strokeWidth="1.8"
            opacity="0.9"
          />
        </Svg>
      </View>
      <Text style={[styles.text, compact && styles.textSmall]}>
        sign<Text style={styles.ai}>AI</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mark: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  markSmall: {
    height: 32,
    width: 32,
  },
  text: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  textSmall: {
    fontSize: 24,
  },
  ai: {
    color: colors.green,
  },
});
