// ── 認証 ──────────────────────────────────────────────────────────────────

// バックエンドの users モデル（password / remember_token は除外済み）
export interface User {
  id: number;
  user_id: string;
  email: string | null;
  name: string;
  rank: string | null;
  created_at: string;
  updated_at: string;
}

// ── 共通 ──────────────────────────────────────────────────────────────────

export interface PageMeta {
  current_page: number;
  last_page: number;
  total: number;
}

// ── コミュニティ ───────────────────────────────────────────────────────────

export interface Community {
  id: number;
  name: string;
  description: string | null;
  icon_url: string | null;
  role: string;
  member_count: number;
  encyclopedia_public: boolean;
  report_suffix_instagram: string | null;
  report_suffix_facebook: string | null;
  report_suffix_line: string | null;
  report_suffix_x: string | null;
  created_at: string;
}

// メンバー管理の一覧（GET /communities/{id}/members。管理者のみ）
export interface CommunityMember {
  id: number; // community_members.id（ロール変更・除籍で使う）
  user_id: string; // 表示用のユーザーID（users.user_id）
  name: string;
  role: string;
  is_me: boolean;
  joined_at: string;
}

// コミュニティが出している有効な招待（GET /communities/{id}/invitations。管理者のみ）
export interface CommunityInvitation {
  id: number;
  type: 'user' | 'link';
  status: 'pending';
  invited_user_name: string | null; // type=user のときだけ
  invited_user_id: string | null; // 表示用のユーザーID。type=user のときだけ
  token: string | null; // type=link のときだけ
  expires_at: string | null; // type=link のときだけ（発行から7日）
  created_at: string;
}

// 自分宛の保留中のコミュニティ招待（GET /invitations）
export interface MyInvitation {
  id: number;
  community_id: number;
  community_name: string;
  invited_by_name: string | null;
  created_at: string;
}

// ── イベント ───────────────────────────────────────────────────────────────

// 自分が招待されたイベント（GET /my-events）
export interface MyInvitedEvent {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'open' | 'closed';
  community_id: number;
  community_name: string;
  member_status: 'invited' | 'accepted' | 'declined';
  created_at: string;
}

export interface Dive {
  sort_order: number;
  dive_site: string | null;
  point_detail: string | null;
  water_temp: number | null;
  visibility: number | null;
  max_depth: number | null;
  dive_time: number | null;
}

export interface DiveInfo {
  weather: string | null;
  notes: string | null;
  dives: Dive[];
}

export type EventMemberStatus = 'invited' | 'accepted' | 'declined';

// 一覧・作成・更新などで共通の形
export interface CommunityEvent {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'open' | 'closed';
  external_public: boolean;
  members_can_edit: boolean;
  is_organizer: boolean;
  organizer_name: string | null; // 主催者が退会済みなら null
  photo_count: number;
  member_count: number;
  unidentified_count: number;
  dive_info: DiveInfo | null;
  closed_at: string | null;
  reported_at: string | null;
  created_at: string;
}

export interface EventMember {
  id: number;
  user_id: number;
  name: string | null; // 退会済みなら null
  status: EventMemberStatus;
  is_me: boolean;
}

export interface EventPhoto {
  id: number;
  uploader_name: string | null;
  is_mine: boolean;
  is_diving_photo: boolean;
  dive_sort_order: number | null;
  japanese_name: string | null;
  scientific_name: string | null;
  creature_id: number | null;
  is_identified: boolean;
  thumbnail_url: string;
  display_url: string;
  uploaded_at: string;
}

export interface EventUserSearchResult {
  user_id: number;
  display_id: string | null;
  name: string;
}

// 詳細（show）のみの追加項目
export interface CommunityEventDetail extends CommunityEvent {
  member_status: 'organizer' | EventMemberStatus | null;
  members: EventMember[];
  photos: EventPhoto[];
  reports: Record<string, string> | null;
}
