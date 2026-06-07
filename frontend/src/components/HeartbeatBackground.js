import React from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../styles/theme';

const PULSES = Array.from({ length: 25 }, (_, index) => {
  const row = Math.floor(index / 5);
  const column = index % 5;
  const top = 5 + row * 18 + ((index * 7) % 9);
  const left = 4 + column * 20 + ((index * 11) % 10);

  return {
    top: `${Math.min(94, top)}%`,
    left: `${Math.min(88, left)}%`,
    width: 118 + ((index * 17) % 108),
    delay: (index * 430) % 3600,
    duration: 2450 + ((index * 310) % 1250),
    scale: 0.42 + ((index * 7) % 30) / 100,
  };
});

const SIGNAL_STEP = 220;
const SIGNAL_PATH = Array.from({ length: 4 }, (_, index) => {
  const offset = index * SIGNAL_STEP;
  return [
    `M${offset + 2} 32`,
    `H${offset + 40}`,
    `L${offset + 50} 28`,
    `L${offset + 58} 37`,
    `L${offset + 68} 16`,
    `L${offset + 82} 52`,
    `L${offset + 96} 31`,
    `H${offset + 124}`,
    `L${offset + 135} 27`,
    `L${offset + 145} 36`,
    `L${offset + 154} 31`,
    `H${offset + 218}`,
  ].join(' ');
}).join(' ');

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
    outputRange: [0, -SIGNAL_STEP],
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
          transform: [{ scale: pulse.scale }],
          width: pulse.width,
        },
      ]}
    >
      <WaveformTrack index={index} pulse={pulse} translateX={translateX} />
    </Animated.View>
  );
}

function WaveformTrack({ index, pulse, translateX }) {
  const content = (
    <Svg width={SIGNAL_STEP * 4} height="62" viewBox={`0 0 ${SIGNAL_STEP * 4} 62`}>
      <Defs>
        <LinearGradient id={`pulse-${index}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.cyan} stopOpacity="0" />
          <Stop offset="0.22" stopColor={colors.cyan} stopOpacity="0.68" />
          <Stop offset="0.5" stopColor={colors.green} stopOpacity="1" />
          <Stop offset="0.78" stopColor={colors.cyan} stopOpacity="0.68" />
          <Stop offset="1" stopColor={colors.cyan} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path
        d={SIGNAL_PATH}
        fill="none"
        stroke={`url(#pulse-${index})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </Svg>
  );

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.waveformTrack,
          styles.waveformTrackWeb,
          {
            animationDelay: `${pulse.delay}ms`,
            animationDuration: `${pulse.duration}ms`,
          },
        ]}
      >
        {content}
      </View>
    );
  }

  return <Animated.View style={[styles.waveformTrack, { transform: [{ translateX }] }]}>{content}</Animated.View>;
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
    height: 62,
    overflow: 'hidden',
  },
  waveformTrack: {
    width: SIGNAL_STEP * 4,
  },
  waveformTrackWeb: {
    animationKeyframes: [
      {
        '0%': { transform: 'translateX(0px)' },
        '100%': { transform: `translateX(-${SIGNAL_STEP}px)` },
      },
    ],
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
});
