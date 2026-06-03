import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_TOKEN_KEY = 'drai.authToken';
export const AUTH_USER_KEY = 'drai.authUser';

const defaultBaseURL = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || defaultBaseURL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getApiErrorMessage(error, fallback = 'Bir hata olustu. Lutfen tekrar dene.') {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') {
    if (detail.includes('Invalid ECG file extension')) {
      return 'Gecersiz EKG dosyasi. .dat, .csv veya .txt yuklemelisin.';
    }

    if (detail.includes('Invalid EEG file extension')) {
      return 'Gecersiz EEG dosyasi. .edf yuklemelisin.';
    }

    if (detail.includes('Uploaded file exceeds')) {
      return 'Dosya boyutu izin verilen limiti asiyor.';
    }

    if (detail.includes('Incorrect username or password')) {
      return 'Kullanici adi veya sifre hatali.';
    }

    if (detail.includes('Username already registered')) {
      return 'Bu kullanici adi zaten kayitli.';
    }

    if (detail.includes('Could not validate credentials')) {
      return 'Oturum dogrulanamadi. Lutfen tekrar giris yap.';
    }

    return detail;
  }

  if (Array.isArray(detail) && detail[0]?.msg) {
    return detail[0].msg;
  }

  return fallback;
}
