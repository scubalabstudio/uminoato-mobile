import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, errorMessage } from '@/components/ui';
import { isOwner } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { CommunityEventDetail, Dive, EventMember, EventPhoto } from '@/types';
import { formatDateRange } from '@/utils/date';

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ communityId: string; eventId: string; name?: string }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();
  const { communities, invitedEvents, respondEventInvitation, reload } = useCommunity();
  const [event, setEvent] = useState<CommunityEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [managing, setManaging] = useState<'close' | 'delete' | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const { width: screenWidth } = useWindowDimensions();

  const load = useCallback(async () => {
    try {
      setEvent(await api.fetchEvent(communityId, eventId));
      setError(null);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    }
  }, [communityId, eventId, handleApiError]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const respond = async (accept: boolean) => {
    if (!event) return;
    setResponding(true);
    const ok = await respondEventInvitation(
      { id: event.id, name: event.name, community_id: communityId } as any,
      accept,
    );
    if (ok) await load();
    setResponding(false);
  };

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    Alert.alert('写真の種類', 'この写真はダイビング中に撮影しましたか？', [
      {
        text: 'ダイビング写真',
        onPress: async () => {
          setUploading(true);
          try {
            await api.uploadEventPhoto(communityId, eventId, uri, true, undefined, mimeType, ext);
            await load();
          } catch (e) {
            if (!handleApiError(e)) Alert.alert('エラー', '写真のアップロードに失敗しました');
          } finally {
            setUploading(false);
          }
        },
      },
      {
        text: 'その他の写真',
        onPress: async () => {
          setUploading(true);
          try {
            await api.uploadEventPhoto(communityId, eventId, uri, false, undefined, mimeType, ext);
            await load();
          } catch (e) {
            if (!handleApiError(e)) Alert.alert('エラー', '写真のアップロードに失敗しました');
          } finally {
            setUploading(false);
          }
        },
      },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const isGuest = !communities.some((c) => c.id === communityId);

  // 主催者でなくなった・終了済みになった等で拒否されたときは、エラーを出して最新の状態を読み直す
  const onManageError = (e: unknown) => {
    if (handleApiError(e)) return;
    Alert.alert(errorMessage(e));
    load();
  };

  // Web版の「レポートの準備をする」と同じ。終了すると写真の追加・編集ができなくなる（取り消せない）
  const closeEvent = () => {
    if (!event) return;
    const unidentified = event.unidentified_count > 0
      ? `\n\n未同定の写真が${event.unidentified_count}件あります。終了後も未同定一覧へ送ることはできます。`
      : '';
    Alert.alert(
      'イベントを終了しますか？',
      `レポートの準備に進みます。メンバーは写真の追加・編集ができなくなり、元には戻せません。${unidentified}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了する',
          style: 'destructive',
          onPress: async () => {
            setManaging('close');
            try {
              await api.closeEvent(communityId, eventId);
              await load();
              reload();
            } catch (e) {
              onManageError(e);
            } finally {
              setManaging(null);
            }
          },
        },
      ],
    );
  };

  const deleteEvent = () => {
    if (!event) return;
    Alert.alert(
      `「${event.name}」を削除しますか？`,
      'メンバー・写真・ダイブ情報・レポートもすべて削除され、元には戻せません。図鑑・未同定へ送った写真は残ります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setManaging('delete');
            try {
              await api.deleteEvent(communityId, eventId);
              reload();
              router.back();
            } catch (e) {
              onManageError(e);
              setManaging(null);
            }
          },
        },
      ],
    );
  };

  const removeMember = (member: EventMember) => {
    const name = member.name ?? '退会したユーザー';
    Alert.alert(
      `${name}さんをイベントから外しますか？`,
      member.status === 'invited' ? '招待を取り消します。' : 'このイベントの参加メンバーから外れます。アップロードした写真は残ります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '外す',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(member.id);
            try {
              await api.removeEventMember(communityId, eventId, member.id);
              await load();
            } catch (e) {
              onManageError(e);
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
    );
  };
  const communityName =
    communities.find((c) => c.id === communityId)?.name ??
    invitedEvents.find((ev) => ev.community_id === communityId)?.community_name;

  const title = event?.name ?? params.name ?? '';

  if (!event) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="再読み込み" variant="secondary" onPress={load} />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const date = formatDateRange(event.start_date, event.end_date);
  const accepted = event.members.filter((m) => m.status === 'accepted');
  const invitedMembers = event.members.filter((m) => m.status === 'invited');
  const dives = event.dive_info?.dives ?? [];
  const tileSize = (screenWidth - 16 * 2 - 8) / 2;
  const isOpen = event.status === 'open';
  const isOrganizer = event.is_organizer;
  const canEdit = event.member_status === 'organizer' || (event.member_status === 'accepted' && event.members_can_edit);
  // 削除は主催者かコミュニティ管理者（終了後もできる）
  const canDelete = isOrganizer || isOwner(communities.find((c) => c.id === communityId)?.role);

  const headerRight = isOrganizer ? () => (
    <Pressable
      hitSlop={12}
      style={{ marginRight: 8 }}
      onPress={() => {
        const qs = [
          `name=${encodeURIComponent(event.name)}`,
          `desc=${encodeURIComponent(event.description ?? '')}`,
          `start=${encodeURIComponent(event.start_date ?? '')}`,
          `end=${encodeURIComponent(event.end_date ?? '')}`,
          `pub=${event.external_public ? 1 : 0}`,
          `mce=${event.members_can_edit ? 1 : 0}`,
        ].join('&');
        router.push(`/${communityId}/events/${eventId}/edit?${qs}`);
      }}
    >
      <Ionicons name="settings-outline" size={20} color={colors.primary} />
    </Pressable>
  ) : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Stack.Screen options={{ title, headerRight }} />

      {/* ── ヘッダー ── */}
      <View style={styles.head}>
        {communityName ? <Text style={styles.communityLabel}>{communityName}</Text> : null}
        <Text style={styles.eventName}>{event.name}</Text>

        {/* サマリーバー */}
        <View style={styles.summaryBar}>
          {date ? (
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSub} />
              <Text style={styles.summaryText}>{date}</Text>
            </View>
          ) : null}
          <View style={styles.summaryItem}>
            <Ionicons name="people-outline" size={13} color={colors.textSub} />
            <Text style={styles.summaryText}>{accepted.length + 1}人</Text>
          </View>
          {event.photo_count > 0 ? (
            <View style={styles.summaryItem}>
              <Ionicons name="camera-outline" size={13} color={colors.textSub} />
              <Text style={styles.summaryText}>{event.photo_count}枚</Text>
            </View>
          ) : null}
          <View style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}>
            <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
              {isOpen ? '開催中' : '終了'}
            </Text>
          </View>
        </View>

        <Text style={styles.organizer}>主催：{event.organizer_name ?? '退会したユーザー'}</Text>
      </View>

      {/* ── ステータスバナー ── */}
      {isGuest ? (
        <Banner icon="person-outline" text="ゲストとして参加しているイベントです" />
      ) : !isGuest && (event.member_status === null || event.member_status === 'declined') ? (
        <Banner icon="eye-outline" text="閲覧のみ（このイベントのメンバーではありません）" />
      ) : null}

      {event.member_status === 'invited' ? (
        <View style={styles.inviteBanner}>
          <Text style={styles.inviteTitle}>このイベントに招待されています</Text>
          <View style={styles.inviteActions}>
            <View style={styles.flex}>
              <Button title="参加する" onPress={() => respond(true)} loading={responding} />
            </View>
            <View style={styles.flex}>
              <Button title="辞退" variant="secondary" onPress={() => respond(false)} disabled={responding} />
            </View>
          </View>
        </View>
      ) : null}

      {event.description ? (
        <Text style={styles.description}>{event.description}</Text>
      ) : null}

      {/* ── 写真 ── */}
      <SectionBlock
        icon="camera-outline"
        title="写真"
        badge={event.unidentified_count > 0 ? `未同定 ${event.unidentified_count}枚` : undefined}
        onAction={canEdit ? pickAndUpload : undefined}
        actionIcon={uploading ? undefined : 'camera-outline'}
        actionLoading={uploading}
      >
        <PhotoGrid
          photos={event.photos ?? []}
          tileSize={tileSize}
          communityId={communityId}
          eventId={eventId}
          canEdit={canEdit}
        />
      </SectionBlock>

      {/* ── ダイブ情報 ── */}
      {(event.dive_info && (dives.length > 0 || event.dive_info.weather || event.dive_info.notes)) || canEdit ? (
        <SectionBlock
          icon="water-outline"
          title="ダイブ情報"
          onAction={canEdit ? () => {
            const qs = [
              `weather=${encodeURIComponent(event.dive_info?.weather ?? '')}`,
              `notes=${encodeURIComponent(event.dive_info?.notes ?? '')}`,
              `dives=${encodeURIComponent(JSON.stringify(dives))}`,
            ].join('&');
            router.push(`/${communityId}/events/${eventId}/dive?${qs}`);
          } : undefined}
          actionIcon="create-outline"
        >
          {event.dive_info && (dives.length > 0 || event.dive_info.weather || event.dive_info.notes) ? (
            <>
              {event.dive_info.weather ? (
                <View style={styles.weatherRow}>
                  <Ionicons name="partly-sunny-outline" size={14} color={colors.textSub} />
                  <Text style={styles.weatherText}>{event.dive_info.weather}</Text>
                </View>
              ) : null}
              {dives.map((d) => <DiveRow key={d.sort_order} dive={d} />)}
              {event.dive_info.notes ? (
                <Text style={styles.diveNotes}>{event.dive_info.notes}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.diveEmpty}>ダイブ情報がまだ入力されていません</Text>
          )}
        </SectionBlock>
      ) : null}

      {/* ── 参加メンバー ── */}
      <SectionBlock
        icon="people-outline"
        title={`参加メンバー（${accepted.length + 1}人）`}
        onAction={isOrganizer ? () => router.push(`/${communityId}/events/${eventId}/invite`) : undefined}
        actionIcon="person-add-outline"
      >
        <MemberChips
          organizer={event.organizer_name}
          accepted={accepted}
          invited={invitedMembers}
          // メンバーを外せるのは主催者だけ、開催中だけ
          onRemove={isOrganizer && isOpen ? removeMember : undefined}
          removingId={removingId}
        />
      </SectionBlock>

      {/* ── イベントの管理（主催者・コミュニティ管理者） ── */}
      {(isOrganizer && isOpen) || canDelete ? (
        <View style={styles.manage}>
          {isOrganizer && isOpen ? (
            <View style={styles.manageItem}>
              <Button title="イベントを終了する" variant="secondary" onPress={closeEvent} loading={managing === 'close'} disabled={managing !== null} />
              <Text style={styles.manageHint}>レポートの準備に進みます。写真の追加・編集は締め切られます。</Text>
            </View>
          ) : null}
          {canDelete ? (
            <Pressable
              onPress={deleteEvent}
              disabled={managing !== null}
              accessibilityRole="button"
              style={styles.deleteButton}
            >
              {managing === 'delete' ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.deleteText}>イベントを削除</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ── サブコンポーネント ──────────────────────────────────────

function Banner({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.banner}>
      <Ionicons name={icon as any} size={15} color={colors.textSub} />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function SectionBlock({
  icon, title, badge, onAction, actionIcon, actionLoading, children,
}: {
  icon: string;
  title: string;
  badge?: string;
  onAction?: () => void;
  actionIcon?: string;
  actionLoading?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={15} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge ? <Text style={styles.sectionBadge}>{badge}</Text> : null}
        {onAction ? (
          <Pressable onPress={onAction} hitSlop={12} disabled={actionLoading} style={styles.sectionAction}>
            {actionLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name={(actionIcon ?? 'add-outline') as any} size={19} color={colors.primary} />
            }
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function MemberChips({
  organizer,
  accepted,
  invited,
  onRemove,
  removingId,
}: {
  organizer: string | null;
  accepted: EventMember[];
  invited: EventMember[];
  onRemove?: (member: EventMember) => void;
  removingId?: number | null;
}) {
  // 自分（主催者）以外を外せる。外せるチップには × を付ける
  const remove = (m: EventMember) => (onRemove && !m.is_me ? () => onRemove(m) : undefined);
  return (
    <View style={styles.chipsWrap}>
      <Chip name={organizer ?? '退会したユーザー'} role="主催" isMe={false} />
      {accepted.map((m) => (
        <Chip key={m.id} name={m.name ?? '退会したユーザー'} isMe={m.is_me} onRemove={remove(m)} removing={removingId === m.id} />
      ))}
      {invited.map((m) => (
        <Chip key={m.id} name={m.name ?? '退会したユーザー'} isMe={m.is_me} pending onRemove={remove(m)} removing={removingId === m.id} />
      ))}
    </View>
  );
}

function Chip({
  name, role, isMe, pending, onRemove, removing,
}: {
  name: string;
  role?: string;
  isMe: boolean;
  pending?: boolean;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <Pressable
      onPress={onRemove}
      disabled={!onRemove || removing}
      accessibilityRole={onRemove ? 'button' : undefined}
      accessibilityHint={onRemove ? 'イベントから外す' : undefined}
      style={[styles.chip, pending && styles.chipPending, onRemove && styles.chipRemovable]}
    >
      <Text style={[styles.chipText, pending && styles.chipTextPending]} numberOfLines={1}>
        {isMe ? `${name}（あなた）` : name}
        {role ? `　${role}` : ''}
      </Text>
      {removing ? (
        <ActivityIndicator size="small" color={colors.textSub} />
      ) : onRemove ? (
        <Ionicons name="close" size={14} color={colors.textSub} />
      ) : null}
    </Pressable>
  );
}

function DiveRow({ dive }: { dive: Dive }) {
  const place = [dive.dive_site, dive.point_detail].filter(Boolean).join(' ');
  const stats = [
    { label: '水深', value: dive.max_depth != null ? `${dive.max_depth}m` : null },
    { label: '水温', value: dive.water_temp != null ? `${dive.water_temp}℃` : null },
    { label: '透明度', value: dive.visibility != null ? `${dive.visibility}m` : null },
    { label: '時間', value: dive.dive_time != null ? `${dive.dive_time}分` : null },
  ].filter((s) => s.value !== null) as { label: string; value: string }[];

  return (
    <View style={styles.diveRow}>
      <View style={styles.diveHeader}>
        <Text style={styles.diveNo}>{dive.sort_order}本目</Text>
        <Text style={styles.divePlace}>{place || 'ポイント未入力'}</Text>
      </View>
      {stats.length > 0 ? (
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCell}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PhotoGrid({
  photos, tileSize, communityId, eventId, canEdit,
}: {
  photos: EventPhoto[];
  tileSize: number;
  communityId: number;
  eventId: number;
  canEdit: boolean;
}) {
  if (photos.length === 0) {
    return (
      <View style={styles.photoEmpty}>
        <Ionicons name="camera-outline" size={28} color={styles.photoEmptyText.color as string} />
        <Text style={styles.photoEmptyText}>まだ写真がありません</Text>
      </View>
    );
  }
  return (
    <View style={styles.photoGrid}>
      {photos.map((photo) => (
        <Pressable
          key={photo.id}
          onPress={() => {
            const qs = [
              `url=${encodeURIComponent(photo.display_url)}`,
              `name=${encodeURIComponent(photo.japanese_name ?? '')}`,
              `sci=${encodeURIComponent(photo.scientific_name ?? '')}`,
              `uploader=${encodeURIComponent(photo.uploader_name ?? '')}`,
              `cid=${photo.creature_id ?? ''}`,
              `dive=${photo.is_diving_photo ? 1 : 0}`,
              `edit=${canEdit ? 1 : 0}`,
              `mine=${photo.is_mine ? 1 : 0}`,
            ].join('&');
            router.push(`/${communityId}/events/${eventId}/photos/${photo.id}?${qs}`);
          }}
          style={({ pressed }) => [{ width: tileSize, opacity: pressed ? 0.8 : 1 }]}
        >
          <Image
            source={{ uri: photo.thumbnail_url }}
            style={{ width: tileSize, height: tileSize, borderRadius: 8 }}
            resizeMode="cover"
          />
          {photo.is_diving_photo ? (
            <View style={styles.photoLabel}>
              <Text style={styles.photoName} numberOfLines={1}>
                {photo.japanese_name ?? <Text style={styles.photoNameMissing}>和名未入力</Text>}
              </Text>
              {photo.scientific_name ? (
                <Text style={styles.photoSci} numberOfLines={1}>{photo.scientific_name}</Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

// ── スタイル ───────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { paddingBottom: 48, gap: 0 },
  errorBox: { gap: 12, alignSelf: 'stretch' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },

  // ヘッダー
  head: {
    padding: 16,
    paddingBottom: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  communityLabel: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  eventName: { fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 28 },
  summaryBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryText: { fontSize: 13, color: colors.textSub },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusOpen: { backgroundColor: colors.primaryLight },
  statusClosed: { backgroundColor: colors.border },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextOpen: { color: colors.primary },
  statusTextClosed: { color: colors.textSub },
  organizer: { fontSize: 12, color: colors.textMuted },

  // バナー
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  bannerText: { fontSize: 13, color: colors.textSub, flex: 1 },

  // 招待バナー
  inviteBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    gap: 10,
  },
  inviteTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  inviteActions: { flexDirection: 'row', gap: 8 },

  description: {
    marginHorizontal: 16,
    marginTop: 14,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },

  // セクション共通
  sectionBlock: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  sectionBadge: {
    fontSize: 11,
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionAction: { marginLeft: 'auto' },
  sectionBody: { gap: 0 },

  // メンバーチップ
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipPending: { borderStyle: 'dashed', borderColor: colors.textMuted },
  chipRemovable: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontSize: 13, color: colors.text },
  chipTextPending: { color: colors.textSub },

  // ダイブ
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  weatherText: { fontSize: 14, color: colors.textSub },
  diveRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  diveHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  diveNo: { fontSize: 12, fontWeight: '700', color: colors.primary, minWidth: 36 },
  divePlace: { fontSize: 14, color: colors.text, flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { minWidth: 72, gap: 1 },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  diveNotes: { fontSize: 13, color: colors.textSub, lineHeight: 20, marginTop: 8 },
  diveEmpty: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },

  // 写真
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  photoEmptyText: { fontSize: 13, color: colors.textMuted },
  photoLabel: { paddingTop: 4, paddingBottom: 2 },
  photoName: { fontSize: 12, fontWeight: '600', color: colors.text },
  photoNameMissing: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  photoSci: { fontSize: 11, color: colors.textSub, fontStyle: 'italic' },
  manage: { marginTop: 8, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 16 },
  manageItem: { gap: 6 },
  manageHint: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  deleteText: { fontSize: 14, color: colors.danger, fontWeight: '500' },
});
