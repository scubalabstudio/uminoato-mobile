import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { EventMember, EventUserSearchResult } from '@/types';

const STATUS_ORDER: Record<string, number> = {
  organizer: 0,
  accepted: 1,
  invited: 2,
  declined: 3,
};

const STATUS_LABEL: Record<string, string> = {
  organizer: '主催者',
  accepted: '参加済み',
  invited: '招待中',
  declined: '辞退',
};

const STATUS_COLOR: Record<string, string> = {
  organizer: colors.primary,
  accepted: '#22c55e',
  invited: colors.textSub,
  declined: colors.danger,
};

export default function InviteScreen() {
  const params = useLocalSearchParams<{
    communityId: string; eventId: string;
    pub?: string; organizer?: string;
  }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();

  const [isPublic, setIsPublic] = useState(params.pub === '1');
  const isOrganizer = params.organizer === '1';
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const [members, setMembers] = useState<EventMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const publicUrl = `${WEB_URL}/umi-no-ato/${communityId}/events/${eventId}`;

  const loadMembers = useCallback(async (silent = false) => {
    if (!silent) setLoadingMembers(true);
    try {
      const ev = await api.fetchEvent(communityId, eventId);
      const sorted = [...ev.members].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
      );
      setMembers(sorted);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setLoadingMembers(false);
      setRefreshing(false);
    }
  }, [communityId, eventId, handleApiError]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    searchAbort.current?.abort();
    if (query.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await api.searchEventUsers(communityId, eventId, query, ctrl.signal);
        setResults(users);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        if (!handleApiError(e)) setError(errorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 400);
  }, [query, communityId, eventId, handleApiError]);

  const toggleVisibility = async (value: boolean) => {
    setToggling(true);
    try {
      await api.updateEventVisibility(communityId, eventId, value);
      setIsPublic(value);
    } catch (e) {
      if (!handleApiError(e)) Alert.alert('エラー', errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const copyUrl = async () => {
    await Clipboard.setStringAsync(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = async () => {
    try { await Share.share({ message: publicUrl }); } catch { /* キャンセルは無視 */ }
  };

  const removeMember = (member: EventMember) => {
    Alert.alert(
      'メンバーを削除',
      `${member.name ?? 'このユーザー'} をイベントから削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除', style: 'destructive',
          onPress: async () => {
            setRemoving(member.id);
            try {
              await api.removeEventMember(communityId, eventId, member.id);
              setMembers(prev => prev.filter(m => m.id !== member.id));
            } catch (e) {
              if (!handleApiError(e)) Alert.alert('エラー', errorMessage(e));
            } finally {
              setRemoving(null);
            }
          },
        },
      ],
    );
  };

  const invite = async (user: EventUserSearchResult) => {
    setInviting(user.user_id);
    setError(null);
    try {
      const newMember = await api.inviteEventMember(communityId, eventId, user.user_id);
      setMembers(prev => {
        const next = prev.filter(m => m.user_id !== newMember.user_id);
        next.push(newMember);
        return next.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
      });
      setQuery('');
      setResults([]);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setInviting(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadMembers(true); }}
          tintColor={colors.primary}
        />
      }
    >
      {/* 公開設定セクション */}
      {isOrganizer ? (
        <View style={styles.section}>
          <View style={styles.publicHeader}>
            <View style={styles.labelRow}>
              <Ionicons
                name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                size={16}
                color={isPublic ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.publicLabel, isPublic && styles.publicLabelOn]}>
                {isPublic ? '外部公開中' : '非公開'}
              </Text>
            </View>
            {toggling
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Switch
                  value={isPublic}
                  onValueChange={toggleVisibility}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={isPublic ? colors.primary : colors.textMuted}
                />
            }
          </View>

          {isPublic ? (
            <>
              <Text style={styles.desc}>メンバー以外でもURLからイベントの写真を閲覧できます。</Text>
              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={1} selectable>{publicUrl}</Text>
              </View>
              <View style={styles.urlActions}>
                <Pressable style={[styles.urlBtn, copied && styles.urlBtnDone]} onPress={copyUrl}>
                  <Ionicons name={copied ? 'checkmark-outline' : 'copy-outline'} size={15} color={copied ? colors.primary : colors.text} />
                  <Text style={[styles.urlBtnText, copied && styles.urlBtnTextDone]}>{copied ? 'コピーしました' : 'URLをコピー'}</Text>
                </Pressable>
                <Pressable style={styles.urlBtn} onPress={shareUrl}>
                  <Ionicons name="share-outline" size={15} color={colors.text} />
                  <Text style={styles.urlBtnText}>シェア</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.desc}>公開にするとURLで誰でも写真を閲覧できます。</Text>
          )}
        </View>
      ) : isPublic ? (
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Ionicons name="globe-outline" size={16} color={colors.primary} />
            <Text style={[styles.publicLabel, styles.publicLabelOn]}>外部公開中</Text>
          </View>
          <View style={[styles.urlBox, { marginTop: 4 }]}>
            <Text style={styles.urlText} numberOfLines={1} selectable>{publicUrl}</Text>
          </View>
          <View style={styles.urlActions}>
            <Pressable style={[styles.urlBtn, copied && styles.urlBtnDone]} onPress={copyUrl}>
              <Ionicons name={copied ? 'checkmark-outline' : 'copy-outline'} size={15} color={copied ? colors.primary : colors.text} />
              <Text style={[styles.urlBtnText, copied && styles.urlBtnTextDone]}>{copied ? 'コピーしました' : 'URLをコピー'}</Text>
            </Pressable>
            <Pressable style={styles.urlBtn} onPress={shareUrl}>
              <Ionicons name="share-outline" size={15} color={colors.text} />
              <Text style={styles.urlBtnText}>シェア</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* メンバー一覧 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>メンバー</Text>

        {loadingMembers ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : members.length === 0 ? (
          <Text style={styles.empty}>メンバーがいません</Text>
        ) : (
          members.map(member => {
            const canRemove = isOrganizer && member.status !== 'organizer' && !member.is_me;
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name ?? '退会済みユーザー'}</Text>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[member.status] + '22' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[member.status] }]}>
                      {STATUS_LABEL[member.status] ?? member.status}
                    </Text>
                  </View>
                </View>
                {canRemove ? (
                  removing === member.id
                    ? <ActivityIndicator size="small" color={colors.danger} />
                    : (
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => removeMember(member)}
                        hitSlop={8}
                      >
                        <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                      </Pressable>
                    )
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* メンバー招待検索（主催者のみ） */}
      {isOrganizer ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メンバーを招待</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="ユーザー名・IDで検索（2文字以上）"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searching ? <ActivityIndicator color={colors.primary} style={styles.searchSpinner} /> : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {query.length > 0 && query.length < 2 ? (
            <Text style={styles.hint}>2文字以上入力してください</Text>
          ) : null}

          {results.length > 0 ? (
            <View style={styles.resultList}>
              {results.map(item => {
                const alreadyMember = members.some(m => m.user_id === item.user_id);
                const loading = inviting === item.user_id;
                return (
                  <View key={item.user_id} style={styles.resultRow}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                      {item.display_id ? <Text style={styles.userId}>@{item.display_id}</Text> : null}
                    </View>
                    <Pressable
                      style={[styles.inviteBtn, (alreadyMember || loading) && styles.inviteBtnDone]}
                      onPress={() => invite(item)}
                      disabled={alreadyMember || loading}
                    >
                      {loading
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <Text style={styles.inviteBtnText}>{alreadyMember ? '招待済み' : '招待'}</Text>
                      }
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : !searching && query.length >= 2 ? (
            <Text style={styles.empty}>該当するユーザーが見つかりませんでした</Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginBottom: 2 },

  // 公開設定
  publicHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  publicLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  publicLabelOn: { color: colors.primary },
  desc: { fontSize: 13, color: colors.textSub, lineHeight: 18 },
  urlBox: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  urlText: { fontSize: 13, color: colors.text, fontFamily: 'monospace' },
  urlActions: { flexDirection: 'row', gap: 8 },
  urlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  urlBtnDone: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  urlBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  urlBtnTextDone: { color: colors.primary },

  // メンバー一覧
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontSize: 15, fontWeight: '500', color: colors.text },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  removeBtn: { padding: 4 },

  // 招待検索
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: colors.text },
  searchSpinner: { marginLeft: 8 },

  resultList: { gap: 0 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 12,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text },
  userId: { fontSize: 12, color: colors.textSub },
  inviteBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.primary, minWidth: 72, alignItems: 'center',
  },
  inviteBtnDone: { backgroundColor: colors.textMuted },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  errorText: {
    fontSize: 13, color: colors.danger,
    backgroundColor: '#fef2f2', borderRadius: 8, padding: 10,
  },
  empty: { fontSize: 14, color: colors.textSub, textAlign: 'center', marginVertical: 8 },
});
