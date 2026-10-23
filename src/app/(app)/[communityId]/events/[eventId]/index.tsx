import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { NetworkErrorView } from '@/components/NetworkErrorView';
import { Button, errorMessage } from '@/components/ui';
import { isOwner } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import { useModeration } from '@/hooks/useModeration';
import * as api from '@/services/apiService';
import {
  type Camera, type Housing, type Lens,
  fetchHousingsForCamera, fetchLensesForCameraHousing,
  matchCameraByExif, searchCameras, searchCreatures,
} from '@/services/supabaseService';
import { addToHistory } from '@/services/browsingHistoryService';
import { useUpload, type UploadAsset, type UploadMeta } from '@/context/UploadContext';
import {
  equipmentSetLabel,
  loadMyEquipment,
  type MyEquipmentSet,
} from '@/services/myEquipmentService';
import { ReportTab } from './_components/ReportTab';
import type { CommunityEventDetail, Dive, EventMember, EventPhoto } from '@/types';
import { formatDateRange } from '@/utils/date';
import { parseExifCamera } from '@/utils/exif';

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ communityId: string; eventId: string; name?: string }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();
  const { communities, invitedEvents, respondEventInvitation, reload } = useCommunity();
  const [event, setEvent] = useState<CommunityEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState(false);
  // まとめてアップロードはアプリ全体で持つ（画面を閉じても続く）。このイベントのものなら写真タブに進み具合を出す
  const { job: uploadJob, startUpload, onPhotoUploaded } = useUpload();
  const uploadProgress = uploadJob && uploadJob.eventId === eventId && !uploadJob.finished ? uploadJob : null;
  const uploading = uploadJob !== null && !uploadJob.finished;
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [managing, setManaging] = useState<'close' | 'delete' | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'photos' | 'dive' | 'members' | 'report'>('photos');
  const [photoSortByDive, setPhotoSortByDive] = useState(false);
  const moderation = useModeration();
  const { width: screenWidth } = useWindowDimensions();

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    try {
      setEvent(await api.fetchEvent(communityId, eventId));
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 404) {
        setNotFound(true);
        setError(null);
      } else if (!handleApiError(e)) {
        setError(errorMessage(e));
      }
    }
  }, [communityId, eventId, handleApiError]);

  // このイベントに写真が1枚上がるたびに読み直し、すぐ並べる
  useEffect(
    () => onPhotoUploaded((id) => {
      if (id === eventId) load();
    }),
    [onPhotoUploaded, eventId, load],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 外部公開イベントで非メンバーのとき閲覧履歴に保存
  useEffect(() => {
    if (!event?.external_public) return;
    if (event.member_status !== null) return;
    addToHistory({
      communityId,
      eventId,
      name: event.name,
      communityName: communityName ?? null,
      startDate: event.start_date,
    });
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Web版と同じく、複数枚を選んで情報を一度だけ入力し、1枚ずつ順に送る
  const pickAndUpload = async () => {
    if (uploading) {
      Alert.alert('ほかの写真をアップロード中です', '終わってから、もう一度お試しください。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.85,
      exif: true,
      allowsMultipleSelection: true,
      selectionLimit: MAX_UPLOAD_PHOTOS,
      orderedSelection: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const assets = result.assets.map((asset) => {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      return { uri: asset.uri, mimeType, ext };
    });
    // カメラの自動入力は1枚目の EXIF から
    const { make: exifMake, model: exifModel } = parseExifCamera(result.assets[0].exif);
    setPendingUpload({ assets, exifMake, exifModel });
  };

  const doUpload = (params: UploadSubmitParams) => {
    if (!pendingUpload || !event) return;
    const started = startUpload({ communityId, eventId, eventName: event.name }, pendingUpload.assets, params);
    setPendingUpload(null);
    if (!started) Alert.alert('ほかの写真をアップロード中です', '終わってから、もう一度お試しください。');
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

  const pushPhoto = async (photoId: number, body?: Parameters<typeof api.pushEventPhoto>[3]) => {
    if (!event) return;
    setPushingId(photoId);
    try {
      const result = await api.pushEventPhoto(communityId, eventId, photoId, body);
      if ('conflict' in result) {
        const { entry_id, japanese_name, photo_count } = result.conflict;
        setPushingId(null);
        Alert.alert(
          `「${japanese_name}」が図鑑に登録されています`,
          `同じ名前の図鑑エントリ（写真${photo_count}枚）が既にあります。そちらに追加しますか？`,
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '新規登録', onPress: () => pushPhoto(photoId, { force_new: true }) },
            { text: '追加する', style: 'default', onPress: () => pushPhoto(photoId, { target_entry_id: entry_id }) },
          ],
        );
        return;
      }
      const updated = result.photo;
      setEvent(prev => prev ? {
        ...prev,
        photos: prev.photos.map(p => p.id === photoId ? updated : p),
        unidentified_count: updated.pushed_to_community && !updated.is_identified
          ? Math.max(0, (prev.unidentified_count ?? 0) - 1)
          : (prev.unidentified_count ?? 0),
      } : prev);
    } catch (e) {
      if (!handleApiError(e)) Alert.alert('Pushに失敗しました', errorMessage(e));
    } finally {
      setPushingId(null);
    }
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
        {notFound ? (
          <View style={styles.notFound}>
            <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
            <View style={styles.notFoundTexts}>
              <Text style={styles.errorTitle}>イベントが見つかりません</Text>
              <Text style={styles.notFoundSub}>このイベントは削除されたか、アクセスできません。</Text>
            </View>
            <Button title="戻る" variant="secondary" onPress={() => router.canGoBack() ? router.back() : router.replace('/' as never)} />
          </View>
        ) : error ? (
          <NetworkErrorView message={error} onRetry={load} />
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
  // ダイブが登録されていて、写真があるときだけ並び順を切り替えられる
  const showPhotoSort = dives.length > 0 && (event.photos ?? []).length > 0;
  const tileSize = (screenWidth - 16 * 2 - 8) / 2;
  const isOpen = event.status === 'open';
  const isOrganizer = event.is_organizer;
  const canEdit = event.member_status === 'organizer' || (event.member_status === 'accepted' && event.members_can_edit);
  // 削除は主催者かコミュニティ管理者（終了後もできる）
  const canDelete = isOrganizer || isOwner(communities.find((c) => c.id === communityId)?.role);
  // 主催者の行（名前の表示は organizer_name、通報・ブロックの対象はこの行の user_id）
  const organizerMember = event.members.find((m) => m.status === 'organizer') ?? null;

  // メンバーをタップしたときのメニュー。主催者は開催中ならイベントから外せる。誰でも通報・ブロックできる
  const openMember = (m: EventMember) => {
    const name = m.name ?? '退会したユーザー';
    const canRemove = isOrganizer && isOpen && m.status !== 'organizer';
    moderation.openMenu({
      title: name,
      report: { type: 'user', id: m.user_id, communityId, label: `${name}さん` },
      user: m.name ? { id: m.user_id, name: m.name } : null,
      extraOptions: canRemove
        ? [{ label: 'イベントから外す', icon: 'person-remove-outline', destructive: true, onPress: () => removeMember(m) }]
        : [],
      // ブロックした人の写真を一覧から消すため読み直す
      onBlocked: () => load(),
    });
  };

  const headerRight = isOrganizer ? () => (
    <Pressable
      hitSlop={12}
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
      <Ionicons name="create-outline" size={20} color={colors.primary} />
    </Pressable>
  ) : undefined;

  return (
    <>
    {moderation.element}
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

      {/* ── タブバー ── */}
      <View style={styles.tabBar}>
        <Pressable style={[styles.tab, activeTab === 'photos' && styles.tabActive]} onPress={() => setActiveTab('photos')}>
          <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>写真</Text>
          {event.photo_count > 0 ? <Text style={[styles.tabCount, activeTab === 'photos' && styles.tabCountActive]}>{event.photo_count}</Text> : null}
          {event.unidentified_count > 0 ? <View style={styles.tabDot} /> : null}
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'dive' && styles.tabActive]} onPress={() => setActiveTab('dive')}>
          <Text style={[styles.tabText, activeTab === 'dive' && styles.tabTextActive]}>ダイブ</Text>
          {dives.length > 0 ? <Text style={[styles.tabCount, activeTab === 'dive' && styles.tabCountActive]}>{dives.length}</Text> : null}
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'members' && styles.tabActive]} onPress={() => setActiveTab('members')}>
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>メンバー</Text>
          <Text style={[styles.tabCount, activeTab === 'members' && styles.tabCountActive]}>{accepted.length + 1}</Text>
        </Pressable>
        {!isOpen && isOrganizer ? (
          <Pressable style={[styles.tab, activeTab === 'report' && styles.tabActive]} onPress={() => setActiveTab('report')}>
            <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>レポート</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── タブコンテンツ ── */}
      {activeTab === 'photos' ? (
        <View style={styles.tabContent}>
          {canEdit || event.unidentified_count > 0 || showPhotoSort ? (
            <View style={styles.tabActionRow}>
              {showPhotoSort ? (
                <PhotoSortToggle sortByDive={photoSortByDive} onChange={setPhotoSortByDive} />
              ) : null}
              {event.unidentified_count > 0 ? (
                <Text style={styles.sectionBadge}>未同定 {event.unidentified_count}枚</Text>
              ) : null}
              {canEdit ? (
                <Pressable
                  onPress={pickAndUpload}
                  disabled={uploadProgress !== null}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={uploadProgress ? `アップロード中 ${uploadProgress.done}/${uploadProgress.total}枚` : '写真を追加'}
                  style={styles.uploadBtn}
                >
                  {uploadProgress ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      {uploadProgress.total > 1 ? (
                        <Text style={styles.uploadProgress}>{uploadProgress.done}/{uploadProgress.total}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <PhotoGrid
            photos={event.photos ?? []}
            tileSize={tileSize}
            communityId={communityId}
            eventId={eventId}
            eventName={event.name}
            canEdit={canEdit}
            dives={dives}
            sortByDive={photoSortByDive}
            isOpen={isOpen}
            isOrganizer={isOrganizer}
            canDownload={event.member_status === 'organizer' || event.member_status === 'accepted'}
            pushingId={pushingId}
            onPush={pushPhoto}
          />
        </View>
      ) : activeTab === 'dive' ? (
        <View style={styles.tabContent}>
          {canEdit ? (
            <View style={styles.tabActionRow}>
              <Pressable
                hitSlop={12}
                onPress={() => {
                  const qs = [
                    `weather=${encodeURIComponent(event.dive_info?.weather ?? '')}`,
                    `notes=${encodeURIComponent(event.dive_info?.notes ?? '')}`,
                    `dives=${encodeURIComponent(JSON.stringify(dives))}`,
                  ].join('&');
                  router.push(`/${communityId}/events/${eventId}/dive?${qs}`);
                }}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
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
        </View>
      ) : activeTab === 'members' ? (
        <View style={styles.tabContent}>
          {isOrganizer ? (
            <View style={styles.tabActionRow}>
              <Pressable hitSlop={12} onPress={() => router.push(`/${communityId}/events/${eventId}/invite?pub=${event.external_public ? 1 : 0}&organizer=${isOrganizer ? 1 : 0}`)}>
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          <MemberChips
            organizer={event.organizer_name}
            organizerMember={organizerMember}
            accepted={accepted}
            invited={invitedMembers}
            onOpen={openMember}
            removingId={removingId}
          />
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
        </View>
      ) : activeTab === 'report' ? (
        <ReportTab
          event={event}
          communityId={communityId}
          onEventUpdated={setEvent}
        />
      ) : null}
    </ScrollView>

    {pendingUpload ? (
      <UploadModal
        uris={pendingUpload.assets.map((a) => a.uri)}
        exifMake={pendingUpload.exifMake}
        exifModel={pendingUpload.exifModel}
        dives={dives}
        onSubmit={doUpload}
        onCancel={() => setPendingUpload(null)}
      />
    ) : null}
    </>
  );
}

// ── 型 ─────────────────────────────────────────────────────────────────────

// 一度に選べる枚数。サーバーのアップロード上限（1分に60枚）に収まるようにする
const MAX_UPLOAD_PHOTOS = 15;

interface PendingUpload {
  assets: UploadAsset[];
  exifMake: string | null;
  exifModel: string | null;
}

type UploadSubmitParams = UploadMeta;

// ── UploadModal ────────────────────────────────────────────────────────────

function UploadModal({
  uris, exifMake, exifModel, dives, onSubmit, onCancel,
}: {
  uris: string[];
  exifMake: string | null;
  exifModel: string | null;
  dives: Dive[];
  onSubmit: (p: UploadSubmitParams) => void;
  onCancel: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const previewH = Math.round(screenWidth * 0.45);
  // 複数枚のときは生き物名を入れない（写真ごとに違うため。Web版と同じ）
  const isSingle = uris.length === 1;

  const [isDiving, setIsDiving] = useState(true);
  const [diveSortOrder, setDiveSortOrder] = useState<number | null>(null);

  const [jaName, setJaName] = useState('');
  const [sciName, setSciName] = useState('');
  const [creatureId, setCreatureId] = useState<number | null>(null);
  const [creatureSuggestions, setCreatureSuggestions] = useState<{ id: number; name: string; scientific_name: string | null }[]>([]);

  const [cameraQuery, setCameraQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [cameraSuggestions, setCameraSuggestions] = useState<Camera[]>([]);
  const [activeSearch, setActiveSearch] = useState<'creature' | 'camera' | null>(null);

  const [housings, setHousings] = useState<Housing[]>([]);
  const [selectedHousing, setSelectedHousing] = useState<Housing | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);

  const creatureDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [myEquipment, setMyEquipment] = useState<MyEquipmentSet[]>([]);

  useEffect(() => {
    loadMyEquipment().then(setMyEquipment);
  }, []);

  const applyMyEquipment = (set: MyEquipmentSet) => {
    setSelectedCamera(set.camera);
    setCameraQuery(set.camera.display_name ?? `${set.camera.brand ?? ''} ${set.camera.model}`.trim());
    setCameraSuggestions([]); setActiveSearch(null);
    setSelectedHousing(set.housing);
    setSelectedLens(set.lens);
  };

  // EXIFが渡された場合、モデル名でファジーマッチして自動選択する
  useEffect(() => {
    if (!exifMake && !exifModel) return;
    matchCameraByExif(exifMake ?? null, exifModel ?? null).then((cam) => {
      if (cam) {
        setSelectedCamera(cam);
        setCameraQuery(cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim());
      } else {
        setCameraQuery([exifMake, exifModel].filter(Boolean).join(' '));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHousings([]); setSelectedHousing(null); setLenses([]); setSelectedLens(null);
    if (!selectedCamera) return;
    fetchHousingsForCamera(selectedCamera.id).then(setHousings);
  }, [selectedCamera]);

  useEffect(() => {
    setLenses([]); setSelectedLens(null);
    if (!selectedCamera || !selectedHousing) return;
    fetchLensesForCameraHousing(selectedCamera.id, selectedHousing.id).then(setLenses);
  }, [selectedCamera, selectedHousing]);

  const onJaChange = (text: string) => {
    setJaName(text); setCreatureId(null); setActiveSearch('creature');
    if (creatureDebounce.current) clearTimeout(creatureDebounce.current);
    creatureDebounce.current = setTimeout(async () => {
      setCreatureSuggestions(await searchCreatures(text));
    }, 400);
  };

  const selectCreature = (item: { id: number; name: string; scientific_name: string | null }) => {
    setJaName(item.name); setSciName(item.scientific_name ?? '');
    setCreatureId(item.id); setCreatureSuggestions([]); setActiveSearch(null);
  };

  const onCameraChange = (text: string) => {
    setCameraQuery(text); setSelectedCamera(null); setActiveSearch('camera');
    if (cameraDebounce.current) clearTimeout(cameraDebounce.current);
    cameraDebounce.current = setTimeout(async () => {
      setCameraSuggestions(await searchCameras(text));
    }, 300);
  };

  const selectCamera = (cam: Camera) => {
    setSelectedCamera(cam);
    setCameraQuery(cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim());
    setCameraSuggestions([]); setActiveSearch(null);
  };

  const clearCamera = () => {
    setSelectedCamera(null); setCameraQuery(''); setCameraSuggestions([]);
  };

  const submit = (skipMeta: boolean) => {
    onSubmit({
      isDiving,
      diveSortOrder: isDiving ? diveSortOrder : null,
      jaName:       isDiving && isSingle && !skipMeta ? jaName.trim() : '',
      sciName:      isDiving && isSingle && !skipMeta ? sciName.trim() : '',
      creatureId:   isDiving && isSingle && !skipMeta ? creatureId : null,
      cameraMake:   !skipMeta ? (selectedCamera?.brand ?? '') : '',
      cameraModel:  !skipMeta ? (selectedCamera ? (selectedCamera.display_name ?? selectedCamera.model) : '') : '',
      housingId:    !skipMeta ? (selectedHousing?.id ?? null) : null,
      lensId:       !skipMeta ? (selectedLens?.id ?? null) : null,
    });
  };

  const cameraLabel = (cam: Camera) =>
    cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim();
  const housingLabel = (h: Housing) =>
    h.brand ? `${h.brand} ${h.model}` : h.model;
  const lensLabel = (l: Lens) =>
    l.brand ? `${l.brand} ${l.model}` : l.model;

  return (
    <View style={ulStyles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={ulStyles.sheet}
      >
        <View style={ulStyles.toolbar}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={ulStyles.cancel}>キャンセル</Text>
          </Pressable>
          <Text style={ulStyles.title}>{isSingle ? '写真の情報を入力' : `${uris.length}枚の写真`}</Text>
          <Pressable onPress={() => submit(false)} hitSlop={12}>
            <Text style={ulStyles.done}>{isSingle ? '登録する' : 'まとめて登録'}</Text>
          </Pressable>
        </View>



        <ScrollView contentContainerStyle={ulStyles.body} keyboardShouldPersistTaps="handled">
          {isSingle ? (
            <Image source={{ uri: uris[0] }} style={[ulStyles.preview, { height: previewH }]} resizeMode="cover" />
          ) : (
            <View style={ulStyles.field}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ulStyles.thumbRow}>
                {uris.map((u) => (
                  <Image key={u} source={{ uri: u }} style={ulStyles.thumb} resizeMode="cover" />
                ))}
              </ScrollView>
              <Text style={ulStyles.note}>
                種別・ダイブ・機材は{uris.length}枚すべてに同じものが入ります。生き物の名前は、登録したあと写真ごとに入れてください。
              </Text>
            </View>
          )}

          {/* 写真の種別 */}
          <View style={ulStyles.field}>
            <Text style={ulStyles.label}>写真の種別</Text>
            <View style={ulStyles.typeRow}>
              {[{ key: true, text: 'ダイビング' }, { key: false, text: 'その他' }].map(({ key, text }) => (
                <Pressable
                  key={String(key)}
                  style={[ulStyles.typeBtn, isDiving === key && ulStyles.typeBtnOn]}
                  onPress={() => setIsDiving(key)}
                >
                  <Text style={[ulStyles.typeTxt, isDiving === key && ulStyles.typeTxtOn]}>{text}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ダイブ選択 */}
          {isDiving && dives.length > 0 ? (
            <View style={ulStyles.field}>
              <Text style={ulStyles.label}>ダイブ（任意）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ulStyles.chipsRow}>
                {dives.map(d => (
                  <Pressable
                    key={d.sort_order}
                    style={[ulStyles.chip, diveSortOrder === d.sort_order && ulStyles.chipOn]}
                    onPress={() => setDiveSortOrder(diveSortOrder === d.sort_order ? null : d.sort_order)}
                  >
                    <Text style={[ulStyles.chipTxt, diveSortOrder === d.sort_order && ulStyles.chipTxtOn]}>
                      {d.sort_order}本目{d.dive_site ? ` · ${d.dive_site}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 生き物名（ダイビング写真・1枚のときのみ） */}
          {isDiving && isSingle ? (
            <>
              <View style={ulStyles.field}>
                <Text style={ulStyles.label}>和名（任意）</Text>
                <TextInput
                  style={ulStyles.input}
                  value={jaName}
                  onChangeText={onJaChange}
                  onBlur={() => setTimeout(() => setActiveSearch(prev => prev === 'creature' ? null : prev), 200)}
                  placeholder="例: アカククリ"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                />
                {activeSearch === 'creature' && creatureSuggestions.length > 0 ? (
                  <View style={[ulStyles.inlineSugg, { marginTop: 6 }]}>
                    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                      {creatureSuggestions.map(item => (
                        <Pressable key={String(item.id)} style={ulStyles.suggRow} onPress={() => selectCreature(item)}>
                          <Text style={ulStyles.suggName}>{item.name}</Text>
                          {item.scientific_name ? <Text style={ulStyles.suggSci}>{item.scientific_name}</Text> : null}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
              <View style={ulStyles.field}>
                <Text style={ulStyles.label}>学名（任意）</Text>
                <TextInput
                  style={ulStyles.input}
                  value={sciName}
                  onChangeText={v => { setSciName(v); setCreatureId(null); }}
                  placeholder="例: Platax pinnatus"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </>
          ) : null}

          {/* 機材 */}
          <View style={ulStyles.divider} />
          <View style={ulStyles.field}>
            <Text style={ulStyles.label}>カメラ（任意）</Text>
            {selectedCamera ? (
              <View style={ulStyles.selectedRow}>
                <Text style={ulStyles.selectedTxt} numberOfLines={1}>{cameraLabel(selectedCamera)}</Text>
                <Pressable onPress={clearCamera} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  style={ulStyles.input}
                  value={cameraQuery}
                  onChangeText={onCameraChange}
                  onBlur={() => setTimeout(() => setActiveSearch(prev => prev === 'camera' ? null : prev), 200)}
                  placeholder="例: TG-6, OM-5"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                />
                {activeSearch === 'camera' && cameraSuggestions.length > 0 ? (
                  <View style={[ulStyles.inlineSugg, { marginTop: 6 }]}>
                    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                      {cameraSuggestions.map(cam => (
                        <Pressable key={String(cam.id)} style={ulStyles.suggRow} onPress={() => selectCamera(cam)}>
                          <Text style={ulStyles.suggName}>{cameraLabel(cam)}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* マイ機材クイック選択（カメラ確定後、一致するセットのみ） */}
          {(() => {
            if (!selectedCamera) return null;
            const matched = myEquipment.filter((s) => s.camera.id === selectedCamera.id);
            if (matched.length === 0) return null;
            return (
              <View style={ulStyles.field}>
                <Text style={ulStyles.myEquipLabel}>マイ機材から選ぶ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ulStyles.myEquipChips}>
                  {matched.map((set) => {
                    const active = selectedHousing?.id === set.housing?.id && selectedLens?.id === set.lens?.id;
                    return (
                      <Pressable
                        key={set.id}
                        style={[ulStyles.myEquipChip, active && ulStyles.myEquipChipOn]}
                        onPress={() => applyMyEquipment(set)}
                      >
                        <Text style={[ulStyles.myEquipChipText, active && ulStyles.myEquipChipTextOn]} numberOfLines={1}>
                          {equipmentSetLabel(set)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })()}

          {selectedCamera && housings.length > 0 ? (
            <View style={ulStyles.field}>
              <Text style={ulStyles.label}>ハウジング（任意）</Text>
              {selectedHousing ? (
                <View style={ulStyles.selectedRow}>
                  <Text style={ulStyles.selectedTxt} numberOfLines={1}>{housingLabel(selectedHousing)}</Text>
                  <Pressable onPress={() => setSelectedHousing(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={ulStyles.inlineSugg}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled>
                    {housings.map(h => (
                      <Pressable key={h.id} style={ulStyles.suggRow} onPress={() => setSelectedHousing(h)}>
                        <Text style={ulStyles.suggName}>{housingLabel(h)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : null}

          {selectedCamera && selectedHousing && lenses.length > 0 ? (
            <View style={ulStyles.field}>
              <Text style={ulStyles.label}>レンズ（任意）</Text>
              {selectedLens ? (
                <View style={ulStyles.selectedRow}>
                  <Text style={ulStyles.selectedTxt} numberOfLines={1}>{lensLabel(selectedLens)}</Text>
                  <Pressable onPress={() => setSelectedLens(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={ulStyles.inlineSugg}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled>
                    {lenses.map(l => (
                      <Pressable key={l.id} style={ulStyles.suggRow} onPress={() => setSelectedLens(l)}>
                        <Text style={ulStyles.suggName}>{lensLabel(l)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : null}

          <Pressable style={ulStyles.skipBtn} onPress={() => submit(true)}>
            <Text style={ulStyles.skipTxt}>{isSingle ? '情報なしで登録' : '情報なしでまとめて登録'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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


function MemberChips({
  organizer,
  organizerMember,
  accepted,
  invited,
  onOpen,
  removingId,
}: {
  organizer: string | null;
  organizerMember: EventMember | null;
  accepted: EventMember[];
  invited: EventMember[];
  // 自分以外のメンバーをタップしたとき（外す・通報・ブロックのメニュー）
  onOpen: (member: EventMember) => void;
  removingId?: number | null;
}) {
  const open = (m: EventMember | null) => (m && !m.is_me ? () => onOpen(m) : undefined);
  return (
    <View style={styles.chipsWrap}>
      <Chip
        name={organizer ?? '退会したユーザー'}
        role="主催"
        isMe={organizerMember?.is_me ?? false}
        onPress={open(organizerMember)}
      />
      {accepted.map((m) => (
        <Chip key={m.id} name={m.name ?? '退会したユーザー'} isMe={m.is_me} onPress={open(m)} removing={removingId === m.id} />
      ))}
      {invited.map((m) => (
        <Chip key={m.id} name={m.name ?? '退会したユーザー'} isMe={m.is_me} pending onPress={open(m)} removing={removingId === m.id} />
      ))}
    </View>
  );
}

function Chip({
  name, role, isMe, pending, onPress, removing,
}: {
  name: string;
  role?: string;
  isMe: boolean;
  pending?: boolean;
  onPress?: () => void;
  removing?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || removing}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'メニューを開く' : undefined}
      style={[styles.chip, pending && styles.chipPending, onPress && styles.chipRemovable]}
    >
      <Text style={[styles.chipText, pending && styles.chipTextPending]} numberOfLines={1}>
        {isMe ? `${name}（あなた）` : name}
        {role ? `　${role}` : ''}
      </Text>
      {removing ? (
        <ActivityIndicator size="small" color={colors.textSub} />
      ) : onPress ? (
        <Ionicons name="ellipsis-horizontal" size={14} color={colors.textSub} />
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

// 写真の並び順の切り替え（アップロード順・ダイブ順）。写真タブの上の行に置く
function PhotoSortToggle({ sortByDive, onChange }: { sortByDive: boolean; onChange: (byDive: boolean) => void }) {
  const options = [
    { byDive: false, label: 'アップロード順' },
    { byDive: true, label: 'ダイブ順' },
  ];
  return (
    <View style={styles.sortToggle}>
      {options.map(({ byDive, label }) => {
        const selected = sortByDive === byDive;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(byDive)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={6}
            style={[styles.sortChip, selected ? styles.sortChipOn : styles.sortChipOff]}
          >
            <Text style={selected ? styles.sortChipTextOn : styles.sortChipTextOff}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PhotoGrid({
  photos, tileSize, communityId, eventId, eventName, canEdit, dives, sortByDive, isOpen, isOrganizer, canDownload, pushingId, onPush,
}: {
  photos: EventPhoto[];
  tileSize: number;
  communityId: number;
  eventId: number;
  eventName: string;
  canEdit: boolean;
  dives: Dive[];
  sortByDive: boolean;
  isOpen: boolean;
  isOrganizer: boolean;
  canDownload: boolean;
  pushingId: number | null;
  onPush: (photoId: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <View style={styles.photoEmpty}>
        <Ionicons name="camera-outline" size={28} color={styles.photoEmptyText.color as string} />
        <Text style={styles.photoEmptyText}>まだ写真がありません</Text>
      </View>
    );
  }

  const renderPhotoTile = (photo: EventPhoto) => {
    const isPushing = pushingId === photo.id;
    const showStrip = isOrganizer && !isOpen && photo.is_diving_photo;
    let stripLabel = '';
    let stripDone = false;
    if (photo.pushed_to_encyclopedia) { stripLabel = '図鑑Push済み'; stripDone = true; }
    else if (photo.pushed_to_community) { stripLabel = '未同定Push済み'; stripDone = true; }
    else if (photo.is_identified) { stripLabel = '図鑑へPush'; }
    else { stripLabel = '未同定へPush'; }

    return (
      <View key={photo.id} style={{ width: tileSize }}>
        <Pressable
          onPress={() => {
            const diveOpts = dives.map(d => ({ o: d.sort_order, s: d.dive_site ?? null }));
            const canpush = (!isOpen && isOrganizer) ? 1 : 0;
            const qs = [
              `url=${encodeURIComponent(photo.display_url)}`,
              `name=${encodeURIComponent(photo.japanese_name ?? '')}`,
              `sci=${encodeURIComponent(photo.scientific_name ?? '')}`,
              `uploader=${encodeURIComponent(photo.uploader_name ?? '')}`,
              `cid=${photo.creature_id ?? ''}`,
              `dive=${photo.is_diving_photo ? 1 : 0}`,
              `edit=${canEdit ? 1 : 0}`,
              `mine=${photo.is_mine ? 1 : 0}`,
              `dso=${photo.dive_sort_order ?? ''}`,
              `dives=${encodeURIComponent(JSON.stringify(diveOpts))}`,
              `ename=${encodeURIComponent(eventName)}`,
              `canpush=${canpush}`,
              `dl=${canDownload ? 1 : 0}`,
              `uid=${photo.uploader_id ?? ''}`,
              `pushed_enc=${photo.pushed_to_encyclopedia ? 1 : 0}`,
              `pushed_com=${photo.pushed_to_community ? 1 : 0}`,
              `species_enc=${photo.species_in_encyclopedia ? 1 : 0}`,
              `cam_make=${encodeURIComponent(photo.camera_make ?? '')}`,
              `cam_model=${encodeURIComponent(photo.camera_model ?? '')}`,
              `housing_id=${photo.housing_id ?? ''}`,
              `lens_id=${photo.lens_id ?? ''}`,
            ].join('&');
            router.push(`/${communityId}/events/${eventId}/photos/${photo.id}?${qs}`);
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Image
            source={{ uri: photo.thumbnail_url }}
            style={{ width: tileSize, height: tileSize, borderRadius: 8 }}
            resizeMode="cover"
          />
        </Pressable>

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

        {showStrip ? (
          <Pressable
            onPress={() => !stripDone && !isPushing && onPush(photo.id)}
            disabled={stripDone || isPushing}
            style={[styles.pushStrip, stripDone && styles.pushStripDone]}
          >
            {isPushing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={stripDone ? 'checkmark-circle' : 'arrow-up-circle-outline'}
                size={11}
                color={stripDone ? colors.textMuted : colors.primary}
              />
            )}
            <Text style={[styles.pushStripText, stripDone && styles.pushStripTextDone]} numberOfLines={1}>
              {isPushing ? 'Push中...' : stripLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  // ダイブ順: ダイブごとにグループ化して表示
  if (sortByDive && dives.length > 0) {
    const grouped = new Map<number | null, EventPhoto[]>();
    grouped.set(null, []);
    for (const d of dives) grouped.set(d.sort_order, []);
    for (const p of photos) {
      const key = p.dive_sort_order ?? null;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    }

    return (
      <View>
        {dives.map(d => {
          const group = grouped.get(d.sort_order) ?? [];
          if (group.length === 0) return null;
          const label = d.dive_site ? `${d.sort_order}本目 · ${d.dive_site}` : `${d.sort_order}本目`;
          return (
            <View key={d.sort_order}>
              <Text style={styles.diveSectionHead}>{label}</Text>
              <View style={styles.photoGrid}>{group.map(renderPhotoTile)}</View>
            </View>
          );
        })}

        {(grouped.get(null) ?? []).length > 0 ? (
          <View>
            <Text style={styles.diveSectionHead}>ダイブ未登録</Text>
            <View style={styles.photoGrid}>{(grouped.get(null) ?? []).map(renderPhotoTile)}</View>
          </View>
        ) : null}
      </View>
    );
  }

  // アップロード順（デフォルト）
  return (
    <View>
      <View style={styles.photoGrid}>
        {photos.map(renderPhotoTile)}
      </View>
    </View>
  );
}

// ── スタイル ───────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { paddingBottom: 48, gap: 0 },
  notFound: { alignItems: 'center', gap: 20 },
  notFoundTexts: { alignItems: 'center', gap: 6 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  notFoundSub: { fontSize: 13, color: colors.textSub, textAlign: 'center', lineHeight: 19 },

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
  pushStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: colors.primaryBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pushStripDone: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
  },
  pushStripText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  pushStripTextDone: { color: colors.textMuted, fontWeight: '400' },
  // タブ
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  tabTextActive: { color: colors.primary },
  tabCount: { fontSize: 12, color: colors.textMuted },
  tabCountActive: { color: colors.primary },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  tabContent: { padding: 16, paddingBottom: 32 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  uploadProgress: { fontSize: 13, fontWeight: '600', color: colors.primary, fontVariant: ['tabular-nums'] },
  tabActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  manage: { marginTop: 24, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 16 },
  manageItem: { gap: 6 },
  manageHint: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  deleteText: { fontSize: 14, color: colors.danger, fontWeight: '500' },
  // 左寄せにして、未同定ラベル・カメラボタンを右に押し出す
  sortToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 'auto' },
  sortChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  sortChipOn: { backgroundColor: colors.primary },
  sortChipOff: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sortChipTextOn: { fontSize: 12, color: colors.white, fontWeight: '600' },
  sortChipTextOff: { fontSize: 12, color: colors.textSub },
  diveSectionHead: { fontSize: 13, fontWeight: '700', color: colors.primary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
});

// ── UploadModal スタイル ────────────────────────────────────────────────────

const ulStyles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  suggestions: {
    maxHeight: 200,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2,
  },
  suggName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggSci:  { fontSize: 12, color: colors.textSub, fontStyle: 'italic' },
  inlineSugg: {
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, overflow: 'hidden',
  },

  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title:  { fontSize: 15, fontWeight: '600', color: colors.text },
  cancel: { fontSize: 15, color: colors.textSub },
  done:   { fontSize: 15, fontWeight: '600', color: colors.primary },

  body: { padding: 16, paddingBottom: 40, gap: 14 },
  preview: { width: '100%', borderRadius: 12 },
  thumbRow: { gap: 6 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.border },
  note: { fontSize: 12, color: colors.textSub, lineHeight: 18 },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: colors.text, backgroundColor: colors.bg,
  },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center',
  },
  typeBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeTxt:   { fontSize: 13, fontWeight: '600', color: colors.textSub },
  typeTxtOn: { color: '#fff' },

  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  chipOn:    { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipTxt:   { fontSize: 13, color: colors.textSub },
  chipTxtOn: { color: colors.primary, fontWeight: '600' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  selectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.primaryLight,
  },
  selectedTxt: { fontSize: 15, color: colors.primary, fontWeight: '500', flex: 1 },

  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipTxt: { fontSize: 14, color: colors.textMuted },

  myEquipLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  myEquipChips: { flexDirection: 'row', gap: 8 },
  myEquipChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, maxWidth: 220,
  },
  myEquipChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  myEquipChipText: { fontSize: 13, color: colors.textSub },
  myEquipChipTextOn: { color: colors.primary, fontWeight: '600' },
});
