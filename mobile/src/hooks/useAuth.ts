import { useCallback, useState } from 'react';
import { authApi, AuthUser } from '../api';
import * as SecureStore from 'expo-secure-store';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { user, token, refreshToken } = await authApi.login(email, password);
      await SecureStore.setItemAsync('auth_token', token);
      if (refreshToken) {
        await SecureStore.setItemAsync('refresh_token', refreshToken);
      }
      return user;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: Parameters<typeof authApi.register>[0]) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
  }, []);

  return { login, register, logout, isLoading, error };
}
