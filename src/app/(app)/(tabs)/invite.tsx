import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OwnerOnly } from '@/components/OwnerOnly';
import { Button, FormError, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Community, CommunityInvitation } from '@/types';

// 招待（管理者のみ。タブ自体も管理者にしか出していない）。Web版の招待ページと同じく、ユーザーIDで招待／招待リンク
export default function InviteTab() {
  const { current } = useCommunity();
  return (
    <OwnerOnly community={current ?? undefined} feature="招待の管理">
      {(c) => <InviteScreen key={c.id} community={c} />}
    </OwnerOnly>
  );
}

// Web と同じ URL。アプリが入っていれば将来はアプリで開く（ディープリンク）、無ければ Web で参加できる
function inviteUrl(token: string): string {
  return `${WEB_URL}/umi-no-ato/invite/${token}`;
}

function InviteScreen({ community }: { community: Community }) {
  const { handleApiError } = useSession();
  const { reload } = useCommunity();
  const [invitations, setInvitations] = useState<CommunityInvitation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 他の管理者に降格された等の 403 なら、一覧を取り直してこの画面を「管理者のみ」の案内に切り替える
  const onError = useCallback(
    (e: unknown): string | null => {
      if (handleApiError(e)) return null;
      if (e instanceof api.ApiError && e.status === 403) reload();
      return errorMessage(e);
    },
    [handleApiError, reload],
  );

  const load = useCallback(async () => {
    try {
      setInvitations(await api.fetchCommunityInvitations(community.id));
      setLoadError(null);
    } catch (e) {
      setLoadError(onError(e));
    }
  }, [community.id, onError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const userInvitations = invitations?.filter((i) => i.type === 'user') ?? [];
  const link = invitations?.find((i) => i.type === 'link') ?? null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Button title="再読み込み" variant="secondary" onPress={load} />
          </View>
        ) : null}

        <LinkSection
          community={community}
          link={link}
          loading={invitations === null && !loadError}
          onChanged={load}
          onError={onError}
        />
        <UserSection
          community={community}
          invitations={userInvitations}
          onChanged={load}
          onError={onError}
        />

        <Pressable
          onPress={() => router.push({ pathname: '/[communityId]/members', params: { communityId: String(community.id) } })}
          accessibilityRole="button"
          style={styles.membersLink}
        >
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <Text style={styles.membersLinkText}>参加済みのメンバーを管理する</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── 招待リンク ───────────────────────────────────────────────────────────

function LinkSection({
  community,
  link,
  loading,
  onChanged,
  onError,
}: {
  community: Community;
  link: CommunityInvitation | null;
  loading: boolean;
  onChanged: () => Promise<void>;
  onError: (e: unknown) => string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createInvitation(community.id, { type: 'link' });
      await onChanged();
    } catch (e) {
      setError(onError(e));
    } finally {
      setBusy(false);
    }
  };

  // OS の共有シート（LINE・メッセージ・AirDrop など）で送る
  const share = (token: string) => {
    Share.share({ message: `うみのあとの「${community.name}」に参加しませんか？\n${inviteUrl(token)}` }).catch(() => {});
  };

  const revoke = (invitation: CommunityInvitation) => {
    Alert.alert('招待リンクを無効にしますか？', 'このリンクからは参加できなくなります。新しいリンクはあとから発行できます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '無効にする',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await api.revokeInvitation(community.id, invitation.id);
            await onChanged();
          } catch (e) {
            setError(onError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Section title="招待リンク" icon="link-outline">
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : link?.token ? (
        <>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} selectable numberOfLines={2}>
              {inviteUrl(link.token)}
            </Text>
            {link.expires_at ? <Text style={styles.sub}>{formatExpiry(link.expires_at)}</Text> : null}
          </View>
          <Button title="リンクを送る" onPress={() => share(link.token!)} disabled={busy} />
          <Pressable onPress={() => revoke(link)} disabled={busy} accessibilityRole="button" style={styles.textButton}>
            <Text style={styles.dangerText}>このリンクを無効にする</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.sub}>リンクを送るだけで、受け取った人がコミュニティに参加できます。有効期限は発行から7日間です。</Text>
          <Button title="招待リンクを発行する" onPress={issue} loading={busy} />
        </>
      )}
      <Text style={styles.note}>リンクを知っている人は誰でも参加できます。不要になったら無効にしてください。</Text>
      <FormError message={error} />
    </Section>
  );
}

// 「2026/10/21 まで（あと7日）」
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days > 0 ? `${date} まで（あと${days}日）` : `${date} まで`;
}

// ── ユーザーIDで招待 ──────────────────────────────────────────────────────

function UserSection({
  community,
  invitations,
  onChanged,
  onError,
}: {
  community: Community;
  invitations: CommunityInvitation[];
  onChanged: () => Promise<void>;
  onError: (e: unknown) => string | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ user_id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 入力のたびに検索が走るので、最後に入力した語の結果だけを使う
  const latestQuery = useRef('');

  const onChangeQuery = (text: string) => {
    setQuery(text);
    setError(null);
    latestQuery.current = text.trim();
    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
    } else {
      setSearching(true);
    }
  };

  // 入力が止まってから 300ms 後に検索する（Web版と同じ）
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const users = await api.searchUsersToInvite(community.id, q);
        if (latestQuery.current === q) setResults(users);
      } catch (e) {
        if (latestQuery.current === q) setError(onError(e));
      } finally {
        if (latestQuery.current === q) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, community.id, onError]);

  const invite = async (userId: string, name: string) => {
    setBusyKey(`u${userId}`);
    setError(null);
    try {
      await api.createInvitation(community.id, { type: 'user', user_id: userId });
      onChangeQuery('');
      await onChanged();
      Alert.alert('招待しました', `${name} さんのアプリに招待が届きます。`);
    } catch (e) {
      setError(onError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const cancel = (invitation: CommunityInvitation) => {
    Alert.alert(`${invitation.invited_user_name ?? 'このユーザー'} さんへの招待を取り消しますか？`, undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '取り消す',
        style: 'destructive',
        onPress: async () => {
          setBusyKey(`i${invitation.id}`);
          try {
            await api.revokeInvitation(community.id, invitation.id);
            await onChanged();
          } catch (e) {
            setError(onError(e));
          } finally {
            setBusyKey(null);
          }
        },
      },
    ]);
  };

  return (
    <Section title="ユーザーIDで招待" icon="person-add-outline">
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="ユーザーIDまたはニックネーム"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={50}
          returnKeyType="search"
          style={styles.searchInput}
          accessibilityLabel="招待するユーザーを検索"
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {query.trim().length >= 2 && !searching && results.length === 0 && !error ? (
        <Text style={styles.sub}>
          見つかりませんでした。すでにメンバーの人・招待中の人は表示されません
        </Text>
      ) : null}

      {results.map((u) => (
        <View key={u.user_id} style={styles.personRow}>
          <View style={styles.flex}>
            <Text style={styles.personName} numberOfLines={1}>
              {u.name}
            </Text>
            <Text style={styles.sub}>@{u.user_id}</Text>
          </View>
          <Pressable
            onPress={() => invite(u.user_id, u.name)}
            disabled={busyKey !== null}
            accessibilityRole="button"
            accessibilityLabel={`${u.name} さんを招待する`}
            style={({ pressed }) => [styles.inviteButton, (pressed || busyKey !== null) && { opacity: 0.6 }]}
          >
            {busyKey === `u${u.user_id}` ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.inviteButtonText}>招待する</Text>
            )}
          </Pressable>
        </View>
      ))}

      <FormError message={error} />

      {invitations.length > 0 ? (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>招待中（{invitations.length}人）</Text>
          {invitations.map((i) => (
            <View key={i.id} style={styles.personRow}>
              <View style={styles.flex}>
                <Text style={styles.personName} numberOfLines={1}>
                  {i.invited_user_name ?? '退会したユーザー'}
                </Text>
                {i.invited_user_id ? <Text style={styles.sub}>@{i.invited_user_id}</Text> : null}
              </View>
              {busyKey === `i${i.id}` ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Pressable onPress={() => cancel(i)} disabled={busyKey !== null} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.cancelText}>取り消す</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={colors.textSub} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 48, gap: 24 },
  errorBox: { gap: 8 },
  errorText: { color: colors.danger, fontSize: 14 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sub: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
  note: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  linkBox: { backgroundColor: colors.bg, borderRadius: 8, padding: 12, gap: 4 },
  linkText: { fontSize: 13, color: colors.primary },
  textButton: { alignItems: 'center', paddingVertical: 4 },
  dangerText: { fontSize: 14, color: colors.danger, fontWeight: '500' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  personName: { fontSize: 15, fontWeight: '600', color: colors.text },
  inviteButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 34,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  pending: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  pendingTitle: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  cancelText: { fontSize: 13, color: colors.textSub },
  membersLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  membersLinkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
