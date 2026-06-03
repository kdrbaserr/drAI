export const colors = {
  bg: '#061018',
  bg2: '#081824',
  panel: 'rgba(10, 25, 37, 0.92)',
  panel2: 'rgba(13, 34, 49, 0.86)',
  border: 'rgba(123, 220, 255, 0.16)',
  borderStrong: 'rgba(41, 245, 184, 0.4)',
  text: '#eef8ff',
  muted: '#8aa4b5',
  faint: '#557080',
  cyan: '#38d7ff',
  green: '#29f5b8',
  red: '#ff4f68',
  amber: '#ffcf6b',
  warningBg: 'rgba(255, 124, 79, 0.13)',
  warningBorder: 'rgba(255, 124, 79, 0.42)',
};

export const spacing = {
  page: 20,
  radius: 8,
};

export const shadow = Platform.select({
  web: {
    boxShadow: '0 14px 30px rgba(0,0,0,0.28)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 10,
  },
});
import { Platform } from 'react-native';
