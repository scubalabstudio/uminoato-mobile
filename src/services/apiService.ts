import { BACKEND_URL } from '../config/api';
import { clearCredentials, getAccessToken } from './authService';
import {
  Community,
  CommunityEvent,
  CommunityEventDetail,
  CommunityInvitation,
  CommunityMember,
  Dive,
  DiveInfo,
  EncyclopediaEntry,
  EncyclopediaEntryDetail,
  EncyclopediaSort,
  EventMember,
  EventPhoto,
  EventUserSearchResult,
  MyInvitation,
  MyInvitedEvent,
  PageMeta,
  Tag,
  UnidentifiedPhoto,
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
  // 画像のアップロード（FormData）は、境界文字列付きの Content-Type を fetch に付けさせる
  const isForm = options.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/${path}`, {
      ...options,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
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

// 退会。本人確認にパスワードが要る。他のメンバーがいるコミュニティのオーナーは 422（先にオーナーの移譲が必要）
// 成功するとバックエンドで全端末のトークンが失効するので、この端末の資格情報も消す
export async function deleteAccount(password: string): Promise<void> {
  await request('auth/account', { method: 'DELETE', body: JSON.stringify({ password }) });
  await clearCredentials();
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

export type CommunitySettings = Partial<
  Pick<
    Community,
    | 'encyclopedia_public'
    | 'report_suffix_instagram'
    | 'report_suffix_facebook'
    | 'report_suffix_line'
    | 'report_suffix_x'
  >
>;

// 以下3つはコミュニティ管理者のみ（それ以外は 403）。送った項目だけが更新される
export async function updateCommunitySettings(communityId: number, settings: CommunitySettings): Promise<Community> {
  const res = await request<{ community: Community }>(`communities/${communityId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
  return res.community;
}

// サーバー側で正方形にクロップ・512px に縮小・WebP 化される。送れるのは JPEG/PNG/WebP/HEIC、5MB まで
export async function uploadCommunityIcon(communityId: number, fileUri: string): Promise<Community> {
  const form = new FormData();
  // React Native の FormData はファイルを { uri, name, type } で渡す
  form.append('icon', { uri: fileUri, name: 'icon.jpg', type: 'image/jpeg' } as unknown as Blob);
  const res = await request<{ community: Community }>(`communities/${communityId}/icon`, {
    method: 'POST',
    body: form,
  });
  return res.community;
}

// メンバー・招待・図鑑・イベント・写真もすべて消える（取り消し不可）
export async function deleteCommunity(communityId: number): Promise<void> {
  await request(`communities/${communityId}`, { method: 'DELETE' });
}

// ── メンバー管理（3つともコミュニティ管理者のみ） ─────────────────────────────

export async function fetchMembers(communityId: number): Promise<CommunityMember[]> {
  const res = await request<{ members: CommunityMember[] }>(`communities/${communityId}/members`);
  return res.members;
}

// 自分自身・最後の管理者は変更不可（422）
export async function updateMemberRole(communityId: number, memberId: number, role: string): Promise<CommunityMember> {
  const res = await request<{ member: CommunityMember }>(`communities/${communityId}/members/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return res.member;
}

// 除籍してもイベント参加・写真・図鑑エントリは残る
export async function removeMember(communityId: number, memberId: number): Promise<void> {
  await request(`communities/${communityId}/members/${memberId}`, { method: 'DELETE' });
}

// ── 招待の管理（4つともコミュニティ管理者のみ） ─────────────────────────────

// 有効な招待（個人宛の招待中・期限内の招待リンク）だけが新しい順で返る
export async function fetchCommunityInvitations(communityId: number): Promise<CommunityInvitation[]> {
  const res = await request<{ invitations: CommunityInvitation[] }>(`communities/${communityId}/invitations`);
  return res.invitations;
}

// ユーザーID・ニックネームの部分一致（2文字以上）。自分・メンバー・招待中の人は除かれ、最大8件
export async function searchUsersToInvite(
  communityId: number,
  q: string,
): Promise<{ user_id: string; name: string }[]> {
  const res = await request<{ users: { user_id: string; name: string }[] }>(
    `communities/${communityId}/user-search?q=${encodeURIComponent(q)}`,
  );
  return res.users;
}

// 個人宛は表示用のユーザーIDで指定する。リンクは有効なものがあればそれが返る（1コミュニティ1本・7日間）
export async function createInvitation(
  communityId: number,
  params: { type: 'user'; user_id: string } | { type: 'link' },
): Promise<CommunityInvitation> {
  const res = await request<{ invitation: CommunityInvitation }>(`communities/${communityId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.invitation;
}

// 個人宛の取消・リンクの無効化のどちらもこれ
export async function revokeInvitation(communityId: number, invitationId: number): Promise<void> {
  await request(`communities/${communityId}/invitations/${invitationId}`, { method: 'DELETE' });
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

export async function fetchEventPhoto(
  communityId: number,
  eventId: number,
  photoId: number,
): Promise<EventPhoto> {
  const res = await request<{ photo: EventPhoto }>(
    `communities/${communityId}/events/${eventId}/photos/${photoId}`,
  );
  return res.photo;
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

export async function createEvent(
  communityId: number,
  params: {
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    external_public?: boolean;
    members_can_edit?: boolean;
  },
): Promise<CommunityEvent> {
  const res = await request<{ event: CommunityEvent }>(`communities/${communityId}/events`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.event;
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

export async function updateEvent(
  communityId: number,
  eventId: number,
  params: {
    name?: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    external_public?: boolean;
    members_can_edit?: boolean;
  },
): Promise<CommunityEvent> {
  const res = await request<{ event: CommunityEvent }>(
    `communities/${communityId}/events/${eventId}`,
    { method: 'PATCH', body: JSON.stringify(params) },
  );
  return res.event;
}

export async function updateEventDiveInfo(
  communityId: number,
  eventId: number,
  params: { weather?: string | null; notes?: string | null; dives?: Dive[] },
): Promise<DiveInfo> {
  const res = await request<{ dive_info: DiveInfo }>(
    `communities/${communityId}/events/${eventId}/dive-info`,
    { method: 'PATCH', body: JSON.stringify(params) },
  );
  return res.dive_info;
}

export async function uploadEventPhoto(
  communityId: number,
  eventId: number,
  fileUri: string,
  isDiving: boolean,
  diveSortOrder?: number,
  mimeType = 'image/jpeg',
  ext = 'jpg',
): Promise<EventPhoto> {
  const form = new FormData();
  form.append('image', { uri: fileUri, name: `photo.${ext}`, type: mimeType } as unknown as Blob);
  form.append('is_diving_photo', isDiving ? '1' : '0');
  if (diveSortOrder != null) form.append('dive_sort_order', String(diveSortOrder));
  const res = await request<{ photo: EventPhoto }>(
    `communities/${communityId}/events/${eventId}/photos`,
    { method: 'POST', body: form },
  );
  return res.photo;
}

export async function updateEventPhoto(
  communityId: number,
  eventId: number,
  photoId: number,
  params: {
    japanese_name?: string | null;
    scientific_name?: string | null;
    creature_id?: number | null;
    is_identified?: boolean;
  },
): Promise<EventPhoto> {
  const res = await request<{ photo: EventPhoto }>(
    `communities/${communityId}/events/${eventId}/photos/${photoId}`,
    { method: 'PATCH', body: JSON.stringify(params) },
  );
  return res.photo;
}

export async function deleteEventPhoto(
  communityId: number,
  eventId: number,
  photoId: number,
): Promise<void> {
  await request(
    `communities/${communityId}/events/${eventId}/photos/${photoId}`,
    { method: 'DELETE' },
  );
}

// 主催者のみ・開催中のみ。Web版の「レポートの準備をする」。取り消せず、以後は写真の追加・編集ができなくなる
export async function closeEvent(communityId: number, eventId: number): Promise<CommunityEvent> {
  const res = await request<{ event: CommunityEvent }>(
    `communities/${communityId}/events/${eventId}/close`,
    { method: 'POST' },
  );
  return res.event;
}

// 主催者またはコミュニティ管理者。メンバー・写真・ダイブ情報・レポートもまとめて消える（図鑑・未同定へ送った写真は残る）
export async function deleteEvent(communityId: number, eventId: number): Promise<void> {
  await request(`communities/${communityId}/events/${eventId}`, { method: 'DELETE' });
}

// 主催者のみ・開催中のみ。招待中・参加中のどちらも外せる（主催者自身は外せない）
export async function removeEventMember(communityId: number, eventId: number, memberId: number): Promise<void> {
  await request(`communities/${communityId}/events/${eventId}/members/${memberId}`, { method: 'DELETE' });
}

export async function inviteEventMember(
  communityId: number,
  eventId: number,
  userId: number,
): Promise<EventMember> {
  const res = await request<{ member: EventMember }>(
    `communities/${communityId}/events/${eventId}/members`,
    { method: 'POST', body: JSON.stringify({ user_id: userId }) },
  );
  return res.member;
}

export async function searchEventUsers(
  communityId: number,
  eventId: number,
  q: string,
): Promise<EventUserSearchResult[]> {
  const res = await request<{ users: EventUserSearchResult[] }>(
    `communities/${communityId}/events/${eventId}/user-search?q=${encodeURIComponent(q)}`,
  );
  return res.users;
}

// ── 図鑑 ───────────────────────────────────────────────────────────────────

// 1ページ24件。tags はそのコミュニティのエントリに使われている全タグ（絞り込みに関わらない）
export async function fetchEncyclopedia(
  communityId: number,
  params: { page?: number; q?: string; sort?: EncyclopediaSort; tagIds?: number[] } = {},
): Promise<{ entries: EncyclopediaEntry[]; tags: Tag[]; meta: PageMeta }> {
  const query = [`page=${params.page ?? 1}`, `sort=${params.sort ?? 'name_asc'}`];
  if (params.q) query.push(`q=${encodeURIComponent(params.q)}`);
  params.tagIds?.forEach((id) => query.push(`tag_ids[]=${id}`));
  return request(`communities/${communityId}/encyclopedia?${query.join('&')}`);
}

export async function fetchEncyclopediaEntry(communityId: number, entryId: number): Promise<EncyclopediaEntryDetail> {
  const res = await request<{ entry: EncyclopediaEntryDetail }>(`communities/${communityId}/encyclopedia/${entryId}`);
  return res.entry;
}

// 管理者・図鑑編集者のみ。最後の1枚を消すとエントリごと消える（entry_deleted = true）
export async function deleteEncyclopediaPhoto(
  communityId: number,
  entryId: number,
  photoId: number,
): Promise<{ entry_deleted: boolean }> {
  return request(`communities/${communityId}/encyclopedia/${entryId}/photos/${photoId}`, { method: 'DELETE' });
}

// 管理者・図鑑編集者のみ。指定したタグの集合に置き換える（空配列でタグなし）
export async function updateEncyclopediaTags(
  communityId: number,
  entryId: number,
  tagIds: number[],
): Promise<EncyclopediaEntryDetail> {
  const res = await request<{ entry: EncyclopediaEntryDetail }>(
    `communities/${communityId}/encyclopedia/${entryId}/tags`,
    { method: 'PATCH', body: JSON.stringify({ tag_ids: tagIds }) },
  );
  return res.entry;
}

// 図鑑で使えるタグの全件（コミュニティ共通、名前順）
export async function fetchTags(): Promise<Tag[]> {
  const res = await request<{ tags: Tag[] }>('tags');
  return res.tags;
}

// ── 未同定 ─────────────────────────────────────────────────────────────────

// 1ページ24件、新しい順
export async function fetchUnidentifiedPhotos(
  communityId: number,
  page = 1,
): Promise<{ photos: UnidentifiedPhoto[]; meta: PageMeta }> {
  return request(`communities/${communityId}/unidentified-photos?page=${page}`);
}

// 管理者・図鑑編集者のみ。同定すると未同定一覧から外れる（図鑑には載らない）
export async function identifyPhoto(
  communityId: number,
  photoId: number,
  params: { japanese_name: string; scientific_name: string | null },
): Promise<UnidentifiedPhoto> {
  const res = await request<{ photo: UnidentifiedPhoto }>(
    `communities/${communityId}/unidentified-photos/${photoId}`,
    { method: 'PATCH', body: JSON.stringify(params) },
  );
  return res.photo;
}
