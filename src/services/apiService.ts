import { BACKEND_URL } from '../config/api';
import { getAccessToken } from './authService';
import { Community, CommunityEvent, DiverProfile } from '../types';

// ── HTTP ヘルパー ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor() { super(401, 'ログインの有効期限が切れました'); }
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

  if (res.status === 401) throw new UnauthorizedError();

  const body = res.status === 204 ? null : await res.json();

  if (!res.ok) {
    const msg = body?.message ?? `エラーが発生しました (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return body as T;
}

// ── 認証 ──────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: DiverProfile }> {
  return request('auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await request('auth/logout', { method: 'POST' });
}

export async function fetchMe(): Promise<DiverProfile> {
  const res = await request<{ user: DiverProfile }>('auth/me');
  return res.user;
}

// ── コミュニティ ───────────────────────────────────────────────────────────

export async function fetchCommunities(): Promise<Community[]> {
  const res = await request<{ communities: Community[] }>('communities');
  return res.communities;
}

// ── イベント ───────────────────────────────────────────────────────────────

export async function fetchEvents(communityId: number): Promise<CommunityEvent[]> {
  const res = await request<{ events: CommunityEvent[] }>(
    `communities/${communityId}/events`,
  );
  return res.events;
}

export async function fetchEvent(
  communityId: number,
  eventId: number,
): Promise<CommunityEvent> {
  const res = await request<{ event: CommunityEvent }>(
    `communities/${communityId}/events/${eventId}`,
  );
  return res.event;
}
