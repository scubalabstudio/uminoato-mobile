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
  organizer_name: string;
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
  name: string;
  status: EventMemberStatus;
  is_me: boolean;
}

// 詳細（show）のみの追加項目。photos は写真画面の実装時に型を足す
export interface CommunityEventDetail extends CommunityEvent {
  member_status: 'organizer' | EventMemberStatus | null;
  members: EventMember[];
  reports: Record<string, string> | null;
}
