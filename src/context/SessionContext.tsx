import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import * as api from '@/services/apiService';
import { clearCredentials, getAccessToken, getSavedUser, saveCredentials } from '@/services/authService';
import { setupPushNotifications, teardownPushNotifications } from '@/services/pushTokenService';
import type { User } from '@/types';

interface SessionValue {
  user: User | null;
  // 起動時、端末に保存したログイン情報を読み込んでいる間は true（スプラッシュを出したままにする）
  isLoading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  completeRegistration: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  // 退会。成功するとログイン画面に戻る。失敗（パスワード違い・オーナーで退会できない等）は ApiError を投げる
  deleteAccount: (password: string) => Promise<void>;
  // 401 なら「ログインの有効期限が切れました」を出してログアウトし、true を返す（Web版の useApiErrorHandler と同じ扱い）
  handleApiError: (e: unknown) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used within SessionProvider');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, saved] = await Promise.all([getAccessToken(), getSavedUser()]);
      if (cancelled) return;
      if (token && saved) setUser(saved);
      setIsLoading(false);

      if (!token) return;
      setupPushNotifications();
      // 保存済みの表示用情報で先に画面を出し、裏で最新のユーザー情報に更新する。
      // 失効・期限切れなら端末の資格情報を消してログイン画面へ戻す（圏外などは保存済みのまま続行）
      try {
        const fresh = await api.fetchMe();
        if (cancelled) return;
        await saveCredentials(token, fresh);
        setUser(fresh);
      } catch (e) {
        if (!cancelled && e instanceof api.UnauthorizedError) {
          await clearCredentials();
          setUser(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { token, user: signedIn } = await api.login(identifier, password);
    await saveCredentials(token, signedIn);
    setUser(signedIn);
    setupPushNotifications();
  }, []);

  const completeRegistration = useCallback(async (email: string, code: string) => {
    const { token, user: registered } = await api.verifyRegisterCode(email, code);
    await saveCredentials(token, registered);
    setUser(registered);
    setupPushNotifications();
  }, []);

  const signOut = useCallback(async () => {
    await teardownPushNotifications();
    await api.logout();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await api.deleteAccount(password);
    setUser(null);
  }, []);

  const handleApiError = useCallback((e: unknown) => {
    if (!(e instanceof api.UnauthorizedError)) return false;
    Alert.alert(e.message);
    clearCredentials().finally(() => setUser(null));
    return true;
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, completeRegistration, signOut, deleteAccount, handleApiError }),
    [user, isLoading, signIn, completeRegistration, signOut, deleteAccount, handleApiError],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
