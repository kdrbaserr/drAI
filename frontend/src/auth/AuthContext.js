import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, api, getApiErrorMessage } from '../api/client';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = React.useState(null);
  const [user, setUser] = React.useState(null);
  const [restoring, setRestoring] = React.useState(true);

  React.useEffect(() => {
    async function restoreToken() {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
      ]);
      setToken(storedToken);
      setUser(storedToken ? storedUser : null);
      setRestoring(false);
    }

    restoreToken();
  }, []);

  const saveSession = React.useCallback(async (nextToken, username) => {
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, nextToken),
      AsyncStorage.setItem(AUTH_USER_KEY, username),
    ]);
    setToken(nextToken);
    setUser(username);
  }, []);

  const login = React.useCallback(
    async ({ username, password }) => {
      const body = new URLSearchParams();
      body.append('username', username);
      body.append('password', password);

      try {
        const response = await api.post('/auth/login', body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        await saveSession(response.data.access_token, username);
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Giris yapilamadi.'));
      }
    },
    [saveSession]
  );

  const register = React.useCallback(
    async ({ username, email, password }) => {
      try {
        await api.post('/auth/register', { username, email, password });
        await login({ username, password });
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Kayit tamamlanamadi.'));
      }
    },
    [login]
  );

  const logout = React.useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({
      login,
      logout,
      register,
      restoring,
      token,
      user,
    }),
    [login, logout, register, restoring, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
