import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../styles/theme';

export function HeartbeatBackground({ intensity = 'soft' }) {
  const translate = React.useRef(new Animated.Value(0)).current;
  const opacity = intensity === 'hero' ? 0.44 : 0.22;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translate, {
        toValue: 1,
        duration: intensity === 'hero' ? 5200 : 7200,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [intensity, translate]);

  const x = translate.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 0],
  });

  return (
    <View style={styles.root}>
      <View style={styles.grid} />
      <Animated.View
        style={[
          styles.wave,
          {
            opacity,
            transform: [{ translateX: x }],
          },
        ]}
      >
        <Svg width="1280" height="220" viewBox="0 0 1280 220">
          <Defs>
            <LinearGradient id="pulse" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.cyan} stopOpacity="0" />
              <Stop offset="0.18" stopColor={colors.cyan} stopOpacity="0.8" />
              <Stop offset="0.5" stopColor={colors.green} stopOpacity="1" />
              <Stop offset="0.82" stopColor={colors.cyan} stopOpacity="0.75" />
              <Stop offset="1" stopColor={colors.cyan} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {[0, 320, 640, 960].map((offset) => (
            <Path
              key={offset}
              d={`M ${offset} 110 L ${offset + 64} 110 L ${offset + 82} 92 L ${offset + 100} 130 L ${offset + 128} 42 L ${offset + 154} 162 L ${offset + 178} 110 L ${offset + 320} 110`}
              fill="none"
              stroke="url(#pulse)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.98,
  },
  wave: {
    left: -30,
    position: 'absolute',
    right: -30,
    top: '20%',
  },
});
