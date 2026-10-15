// 図鑑の詳細でタグの変更・写真の削除をしたら、一覧に戻ったときに読み直すための目印
let stale = false;

export function markEncyclopediaStale(): void {
  stale = true;
}

// 目印が立っていれば true を返して下ろす
export function consumeEncyclopediaStale(): boolean {
  const was = stale;
  stale = false;
  return was;
}
