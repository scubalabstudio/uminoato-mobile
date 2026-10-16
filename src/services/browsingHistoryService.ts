import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'browsing_history_v1';
const MAX = 30;

export interface HistoryEntry {
  communityId: number;
  eventId: number;
  name: string;
  communityName: string | null;
  startDate: string | null;
  viewedAt: string;
}

export async function addToHistory(entry: Omit<HistoryEntry, 'viewedAt'>): Promise<void> {
  try {
    const history = await getHistory();
    const filtered = history.filter((h) => h.eventId !== entry.eventId);
    const updated = [{ ...entry, viewedAt: new Date().toISOString() }, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
}

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export async function removeFromHistory(eventId: number): Promise<void> {
  try {
    const history = await getHistory();
    await AsyncStorage.setItem(KEY, JSON.stringify(history.filter((h) => h.eventId !== eventId)));
  } catch {}
}
