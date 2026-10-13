import { BACKEND_URL } from '../config/api';
import { clearCredentials, getAccessToken } from './authService';
import {
  Community,
  CommunityEvent,
  CommunityEventDetail,
  MyInvitation,
  MyInvitedEvent,
  PageMeta,
  User,
} from '../types';

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

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // 圏外・サーバー停止など。fetch の英語メッセージをそのまま見せない
    throw new ApiError(0, '通信エラーが発生しました。電波の良い場所で再度お試しください。');
  }

  // ログイン自体の失敗は 422 で返るため、401 はトークン切れ・不正のみ
  if (res.status === 401) throw new UnauthorizedError();

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status));

  return body as T;
}

// ── 認証 ──────────────────────────────────────────────────────────────────

// identifier はユーザーIDまたはメールアドレス（@ を含めばメールとして扱われる）
// client: 'mobile' を送ると、有効期限180日のトークンが発行される
export async function login(
  identifier: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return request('auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, client: 'mobile' }),
  });
}

// バックエンドでこの端末のトークンだけを失効させる。通信に失敗しても端末の資格情報は削除する
export async function logout(): Promise<void> {
  try {
    await request('auth/logout', { method: 'POST' });
  } catch {
    // 失効済み・通信失敗でもログアウトは完了させる
  } finally {
    await clearCredentials();
  }
}

// 新規登録 1/2: 入力内容を検証し、確認コード（6桁・10分有効）をメールで送る。再送も同じ呼び出し
export async function sendRegisterCode(params: {
  user_id: string;
  email: string;
  password: string;
  name: string;
  rank: string | null;
}): Promise<void> {
  await request('auth/register/send-code', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// 新規登録 2/2: 確認コードが正しければユーザーを作成し、ログイン状態にする
export async function verifyRegisterCode(
  email: string,
  code: string,
): Promise<{ token: string; user: User }> {
  return request('auth/register/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code, client: 'mobile' }),
  });
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

// 作成者がコミュニティ管理者になる。レスポンスは簡易形（icon_url などを含まない）
export async function createCommunity(params: {
  name: string;
  description?: string;
}): Promise<Pick<Community, 'id' | 'name' | 'description' | 'role' | 'member_count' | 'created_at'>> {
  const res = await request<{ community: Community }>('communities', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.community;
}

// ── 招待 ───────────────────────────────────────────────────────────────────

export async function fetchMyInvitations(): Promise<MyInvitation[]> {
  const res = await request<{ invitations: MyInvitation[] }>('invitations');
  return res.invitations;
}

export async function acceptInvitation(invitationId: number): Promise<void> {
  await request(`invitations/${invitationId}/accept`, { method: 'POST' });
}

export async function declineInvitation(invitationId: number): Promise<void> {
  await request(`invitations/${invitationId}/decline`, { method: 'POST' });
}

export async function fetchMyInvitedEvents(): Promise<MyInvitedEvent[]> {
  const res = await request<{ events: MyInvitedEvent[] }>('my-events');
  return res.events;
}

export async function respondEventInvitation(
  communityId: number,
  eventId: number,
  status: 'accepted' | 'declined',
): Promise<void> {
  await request(`communities/${communityId}/events/${eventId}/members/me`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
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
