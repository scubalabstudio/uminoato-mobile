import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

const KEY_ACCESS_TOKEN = 'uminoato_access_token';
const KEY_USER         = 'uminoato_user';

// ── ストレージ ──────────────────────────────────────────────────────────────

export async function saveCredentials(token: string, user: User): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, token);
  await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS_TOKEN);
}

export async function getSavedUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(KEY_USER);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEY_USER);
}
