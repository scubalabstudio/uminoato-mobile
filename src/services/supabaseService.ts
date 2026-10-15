import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const CACHE_KEY = (id: number) => `creature_v2_${id}`;

export interface CreatureDetail {
  id: number;
  name: string;
  scientific_name: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  habitat: string | null;
  size: string | null;
  depth_range: string | null;
  rarity: string | null;
}

interface CacheEntry {
  data: CreatureDetail | null;
  fetchedAt: number;
}

// セッション中の高速アクセス用メモリキャッシュ
const memoryCache = new Map<number, CreatureDetail | null>();

export async function searchCreatures(
  q: string,
): Promise<{ id: number; name: string; scientific_name: string | null }[]> {
  if (q.length < 2) return [];
  const url = `${SUPABASE_URL}/rest/v1/creatures?name=ilike.*${encodeURIComponent(q)}*&limit=10&select=id,name,scientific_name&order=name.asc`;
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── 機材 ──────────────────────────────────────────────────────────────────

export interface Camera {
  id: number;
  brand: string | null;
  model: string;
  display_name: string | null;
}
export interface Housing { id: number; brand: string | null; model: string; }
export interface Lens    { id: number; brand: string | null; model: string; }

function dedupById<T extends { id: number }>(items: (T | null)[]): T[] {
  const seen = new Set<number>();
  return items.filter((item): item is T => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function searchCameras(q: string): Promise<Camera[]> {
  if (q.length < 1) return [];
  const enc = encodeURIComponent(q);
  const url = `${SUPABASE_URL}/rest/v1/cameras?or=(model.ilike.*${enc}*,brand.ilike.*${enc}*)&limit=10&select=id,model,brand,display_name&order=model.asc`;
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function fetchHousingsForCamera(cameraId: number): Promise<Housing[]> {
  const url = `${SUPABASE_URL}/rest/v1/camera_housing_lenses?camera_id=eq.${cameraId}&housing_id=not.is.null&select=housings!housing_id(id,model,brand)`;
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const rows: { housings: Housing | null }[] = await res.json();
    return dedupById(rows.map(r => r.housings));
  } catch { return []; }
}

export async function fetchLensesForCameraHousing(cameraId: number, housingId: number): Promise<Lens[]> {
  const url = `${SUPABASE_URL}/rest/v1/camera_housing_lenses?camera_id=eq.${cameraId}&housing_id=eq.${housingId}&lens_id=not.is.null&select=lenses!lens_id(id,model,brand)`;
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const rows: { lenses: Lens | null }[] = await res.json();
    return dedupById(rows.map(r => r.lenses));
  } catch { return []; }
}

// ── 生き物 ────────────────────────────────────────────────────────────────

export async function fetchCreatureById(id: number): Promise<CreatureDetail | null> {
  // 1. メモリキャッシュ（最速）
  if (memoryCache.has(id)) return memoryCache.get(id)!;

  // 2. AsyncStorageキャッシュ（TTL内かつ取得成功（非null）のみ返す）
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(id));
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (entry.data !== null && Date.now() - entry.fetchedAt < TTL_MS) {
        memoryCache.set(id, entry.data);
        return entry.data;
      }
    }
  } catch {
    // キャッシュ読み込み失敗は無視してフェッチへ
  }

  // 3. Supabaseからフェッチ（カラム未追加の場合は基本カラムのみにフォールバック）
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const base = `${SUPABASE_URL}/rest/v1/creatures?id=eq.${id}&limit=1`;

  // ネットワーク瞬断（NSURLErrorNetworkConnectionLost）でリトライ
  const fetchOnce = async () => {
    const res = await fetch(
      `${base}&select=id,name,scientific_name,category,subcategory,description,habitat,size,depth_range,rarity`,
      { headers },
    );
    if (res.ok) {
      const data: CreatureDetail[] = await res.json();
      return data[0] ?? null;
    }
    // カラム未追加の場合は基本カラムのみ
    const fallback = await fetch(`${base}&select=id,name,scientific_name,category`, { headers });
    if (!fallback.ok) return null;
    const rows: Pick<CreatureDetail, 'id' | 'name' | 'scientific_name' | 'category'>[] = await fallback.json();
    const row = rows[0];
    return row
      ? { ...row, subcategory: null, description: null, habitat: null, size: null, depth_range: null, rarity: null }
      : null;
  };

  try {
    let result: CreatureDetail | null;
    try {
      result = await fetchOnce();
    } catch {
      // 瞬断リトライ（1回）
      await new Promise<void>((r) => setTimeout(r, 800));
      result = await fetchOnce();
    }

    // 成功時のみキャッシュ（エラー時はキャッシュしない）
    memoryCache.set(id, result);
    AsyncStorage.setItem(CACHE_KEY(id), JSON.stringify({ data: result, fetchedAt: Date.now() })).catch(() => {});

    return result;
  } catch (e) {
    console.error('[Supabase] fetch exception =', e);
    return null;
  }
}
