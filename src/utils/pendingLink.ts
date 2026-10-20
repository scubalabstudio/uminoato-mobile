import AsyncStorage from '@react-native-async-storage/async-storage';

// ログインしていないときに開いたリンク（招待・イベント）を覚えておき、ログイン後にその画面を開く。
// 新規登録（メールの確認コード待ち）でアプリを離れても残るよう、端末に保存する
const KEY = 'uminoato_pending_link';
// 何日も前に開いたリンクで、ログインした途端に画面が切り替わらないようにする
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function savePendingLink(href: string): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ href, savedAt: Date.now() })).catch(() => {});
}

// 取り出すと消える（同じ画面を二度開かない）
export async function takePendingLink(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const { href, savedAt } = JSON.parse(raw) as { href?: unknown; savedAt?: unknown };
    if (typeof href !== 'string' || !href.startsWith('/')) return null;
    if (typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) return null;
    return href;
  } catch {
    return null;
  }
}
