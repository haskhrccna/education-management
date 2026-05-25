import { useCallback, useState } from 'react';
import { authApi, AuthUser } from '../api';
import { secureStorage } from '../storage/secureStorage';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { user, token, refreshToken } = await authApi.login(email, password);
      await secureStorage.setItem('auth_token', token);
      if (refreshToken) {
        await secureStorage.setItem('refresh_token', refreshToken);
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
    await secureStorage.deleteItem('auth_token');
    await secureStorage.deleteItem('refresh_token');
  }, []);

  return { login, register, logout, isLoading, error };
}
