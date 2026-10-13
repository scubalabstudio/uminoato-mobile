// 終了日が開始日と同じ・未設定なら開始日のみ（Web版のイベント一覧と同じ表示）
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = (d: string) => d.replaceAll('-', '/');
  return end && end !== start ? `${fmt(start)}〜${fmt(end)}` : fmt(start);
}
