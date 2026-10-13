import { BACKEND_URL } from '../config/api';
import { getAccessToken } from './authService';
import { Community, CommunityEvent, CommunityEventDetail, PageMeta, User } from '../types';

// ── HTTP ヘルパー ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor() { super(401, 'ログインの有効期限が切れました。再度ログインしてください。'); }
}

// Web版と同じく、検証エラーの最初の1件 → message → 既定文言 の順で表示する
function errorMessage(body: unknown, status: number): string {
  const b = body as { message?: string; errors?: Record<string, string[]> } | null;
  const firstError = b?.errors ? Object.values(b.errors)[0]?.[0] : undefined;
  return firstError ?? b?.message ?? `エラーが発生しました (${status})`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${BACKEND_URL}/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // ログイン自体の失敗は 422 で返るため、401 はトークン切れ・不正のみ
  if (res.status === 401) throw new UnauthorizedError();

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status));

  return body as T;
}

// ── 認証 ──────────────────────────────────────────────────────────────────

// identifier はユーザーIDまたはメールアドレス（@ を含めばメールとして扱われる）
export async function login(
  identifier: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return request('auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

// バックエンドはトークンを失効させないため、端末側の資格情報の削除が本体
export async function logout(): Promise<void> {
  await request('auth/logout', { method: 'POST' });
}

// GET /auth/me は { user } ではなく user をそのまま返す
export async function fetchMe(): Promise<User> {
  return request<User>('auth/me');
}

// ── コミュニティ ───────────────────────────────────────────────────────────

export async function fetchCommunities(): Promise<Community[]> {
  const res = await request<{ communities: Community[] }>('communities');
  return res.communities;
}

// ── イベント ───────────────────────────────────────────────────────────────

export type EventListStatus = 'open' | 'closed' | 'recent' | 'all';

// 1ページ20件
export async function fetchEvents(
  communityId: number,
  status: EventListStatus = 'open',
  page = 1,
): Promise<{ events: CommunityEvent[]; meta: PageMeta }> {
  return request(`communities/${communityId}/events?status=${status}&page=${page}`);
}

export async function fetchEvent(
  communityId: number,
  eventId: number,
): Promise<CommunityEventDetail> {
  const res = await request<{ event: CommunityEventDetail }>(
    `communities/${communityId}/events/${eventId}`,
  );
  return res.event;
}
