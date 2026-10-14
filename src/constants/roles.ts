// バックエンドが返すコミュニティ内の役割名（Web版と同じく文字列で判定する）。権限の正は仕様書の roles.md
export const ROLE_OWNER = 'コミュニティ管理者';
export const ROLE_EDITOR = '図鑑編集者';
export const ROLE_MEMBER = 'コミュニティメンバー';
// 非メンバーがイベント招待を受諾すると自動で付く。メンバー管理の一覧には出るが、手動では付けられない
export const ROLE_TEMPORARY = 'テンポラリーイベントメンバー';

// メンバー管理で付け替えられるロール（PATCH …/members/{id}/role で指定できるのはこの3つだけ）
export const ASSIGNABLE_ROLES = [ROLE_OWNER, ROLE_EDITOR, ROLE_MEMBER] as const;

// 設定・アイコン変更・メンバー管理・招待・コミュニティ削除は管理者のみ
export function isOwner(role: string | undefined): boolean {
  return role === ROLE_OWNER;
}
