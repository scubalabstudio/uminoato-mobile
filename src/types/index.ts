// ── 認証 ──────────────────────────────────────────────────────────────────

export interface DiverProfile {
  id: number;
  name: string;
  display_id: string | null;
  email: string;
}

// ── コミュニティ ───────────────────────────────────────────────────────────

export interface Community {
  id: number;
  name: string;
  description: string | null;
  icon_url: string | null;
  role: string;
  member_count: number;
  created_at: string;
}

// ── イベント ───────────────────────────────────────────────────────────────

export interface CommunityEvent {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'open' | 'closed';
  is_organizer: boolean;
  member_status: 'organizer' | 'accepted' | 'invited' | 'declined' | null;
  external_public: boolean;
  photo_count: number;
  member_count: number;
  unidentified_count: number;
  reported_at: string | null;
}
