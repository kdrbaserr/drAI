import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../styles/theme';

const PULSES = Array.from({ length: 25 }, (_, index) => {
  const row = Math.floor(index / 5);
  const column = index % 5;
  const top = 5 + row * 18 + ((index * 7) % 9);
  const left = 4 + column * 20 + ((index * 11) % 10);
  const driftDirection = index % 2 === 0 ? 1 : -1;

  return {
    top: `${Math.min(94, top)}%`,
    left: `${Math.min(88, left)}%`,
    width: 96 + ((index * 17) % 90),
    delay: (index * 430) % 3600,
    duration: 2850 + ((index * 310) % 1500),
    drift: driftDirection * (18 + ((index * 13) % 42)),
    scale: 0.42 + ((index * 7) % 30) / 100,
  };
});

export function HeartbeatBackground({ intensity = 'soft' }) {
  const pulseConfigs = intensity === 'hero' ? PULSES : PULSES.slice(0, 18);

  return (
    <View style={styles.root}>
      <View style={styles.base} />
      {pulseConfigs.map((pulse, index) => (
        <FloatingPulse key={`${pulse.top}-${pulse.left}`} index={index} intensity={intensity} pulse={pulse} />
      ))}
    </View>
  );
}

function FloatingPulse({ index, intensity, pulse }) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(pulse.delay),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 1,
          duration: pulse.duration,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, pulse.delay, pulse.duration]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pulse.drift],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, index % 2 === 0 ? -10 : 8, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.14, 0.52, 0.78, 1],
    outputRange: [0, intensity === 'hero' ? 0.42 : 0.26, intensity === 'hero' ? 0.34 : 0.2, 0.1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          left: pulse.left,
          opacity,
          top: pulse.top,
          transform: [{ translateX }, { translateY }, { scale: pulse.scale }],
          width: pulse.width,
        },
      ]}
    >
      <Svg width="100%" height="62" viewBox="0 0 220 62">
        <Defs>
          <LinearGradient id={`pulse-${index}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.cyan} stopOpacity="0" />
            <Stop offset="0.2" stopColor={colors.cyan} stopOpacity="0.68" />
            <Stop offset="0.54" stopColor={colors.green} stopOpacity="1" />
            <Stop offset="0.85" stopColor={colors.cyan} stopOpacity="0.68" />
            <Stop offset="1" stopColor={colors.cyan} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d="M2 32 H42 L52 22 L62 42 L77 8 L93 56 L108 32 H218"
          fill="none"
          stroke={`url(#pulse-${index})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.99,
  },
  pulse: {
    position: 'absolute',
  },
});
