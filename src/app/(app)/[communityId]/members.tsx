import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OwnerOnly } from '@/components/OwnerOnly';
import { RoleBadge } from '@/components/RoleBadge';
import { Button, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { ASSIGNABLE_ROLES, ROLE_EDITOR, ROLE_MEMBER, ROLE_OWNER, ROLE_TEMPORARY } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Community, CommunityMember } from '@/types';

// ロールの説明（ロールごとにできること）
const ROLE_HINT: Record<string, string> = {
  [ROLE_OWNER]: '設定・メンバー管理・招待・コミュニティの削除ができます',
  [ROLE_EDITOR]: '図鑑への登録・編集と、未同定写真の同定ができます',
  [ROLE_MEMBER]: '図鑑・イベントの閲覧と、イベントの作成ができます',
};

// メンバー管理（管理者のみ）。ロールの付け替えと除籍
export default function MembersScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { communities } = useCommunity();
  const community = communities.find((c) => c.id === Number(communityId));

  return (
    <OwnerOnly community={community} feature="メンバー管理">
      {(c) => <MemberList key={c.id} community={c} />}
    </OwnerOnly>
  );
}

function MemberList({ community }: { community: Community }) {
  const { handleApiError } = useSession();
  const { reload } = useCommunity();
  const [members, setMembers] = useState<CommunityMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const onError = useCallback(
    (e: unknown) => {
      if (handleApiError(e)) return;
      // 他の管理者に降格された等。一覧を取り直すと、この画面は「管理者のみ」の案内に切り替わる
      if (e instanceof api.ApiError && e.status === 403) reload();
      Alert.alert(errorMessage(e));
    },
    [handleApiError, reload],
  );

  const load = useCallback(async () => {
    try {
      setMembers(await api.fetchMembers(community.id));
      setError(null);
    } catch (e) {
      if (handleApiError(e)) return;
      if (e instanceof api.ApiError && e.status === 403) reload();
      setError(errorMessage(e));
    }
  }, [community.id, handleApiError, reload]);

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

  const changeRole = (member: CommunityMember, role: string) => {
    if (role === member.role) return;
    Alert.alert(`${member.name} さんを「${role}」にしますか？`, ROLE_HINT[role], [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '変更する',
        onPress: async () => {
          setBusyId(member.id);
          try {
            const updated = await api.updateMemberRole(community.id, member.id, role);
            setMembers((list) => list?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
            setExpandedId(null);
          } catch (e) {
            onError(e);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const remove = (member: CommunityMember) => {
    Alert.alert(
      `${member.name} さんを除籍しますか？`,
      'コミュニティから外れます。これまでのイベント参加・写真・図鑑の記録は残ります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '除籍する',
          style: 'destructive',
          onPress: async () => {
            setBusyId(member.id);
            try {
              await api.removeMember(community.id, member.id);
              setMembers((list) => list?.filter((m) => m.id !== member.id) ?? null);
              setExpandedId(null);
              // メンバー数の表示を更新する
              reload();
            } catch (e) {
              onError(e);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (!members) {
    return (
      <View style={styles.center}>
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

  // イベント招待で一時的に入っている人（ゲスト）は、メンバーと分けて下に並べる
  const sections = [
    { title: `メンバー（${members.filter((m) => m.role !== ROLE_TEMPORARY).length}人）`, data: members.filter((m) => m.role !== ROLE_TEMPORARY) },
    { title: 'ゲスト（イベントだけに参加している人）', data: members.filter((m) => m.role === ROLE_TEMPORARY) },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(m) => String(m.id)}
      renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
      renderItem={({ item }) => (
        <MemberRow
          member={item}
          expanded={expandedId === item.id}
          busy={busyId === item.id}
          onToggle={() => setExpandedId((id) => (id === item.id ? null : item.id))}
          onChangeRole={(role) => changeRole(item, role)}
          onRemove={() => remove(item)}
        />
      )}
      ListFooterComponent={
        <Pressable
          onPress={() => Linking.openURL(`${WEB_URL}/umi-no-ato/roles`)}
          accessibilityRole="link"
          style={styles.rolesLink}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.rolesLinkText}>ロールごとにできること</Text>
        </Pressable>
      }
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    />
  );
}

function MemberRow({
  member,
  expanded,
  busy,
  onToggle,
  onChangeRole,
  onRemove,
}: {
  member: CommunityMember;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onChangeRole: (role: string) => void;
  onRemove: () => void;
}) {
  // 自分自身のロール変更・除籍はサーバーが拒否する（422）ので、操作を出さない
  const editable = !member.is_me;

  return (
    <View style={[styles.row, expanded && styles.rowExpanded]}>
      <Pressable
        onPress={editable ? onToggle : undefined}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: !editable }}
        accessibilityHint={editable ? 'ロールの変更・除籍' : undefined}
        style={styles.rowMain}
      >
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {member.name}
            {member.is_me ? <Text style={styles.me}>（あなた）</Text> : null}
          </Text>
          <Text style={styles.userId}>@{member.user_id}</Text>
        </View>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <RoleBadge role={member.role} />}
        {editable ? (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.actions}>
          <Text style={styles.actionsLabel}>ロールを変更</Text>
          <View style={styles.roleChoices}>
            {ASSIGNABLE_ROLES.map((role) => {
              const selected = role === member.role;
              return (
                <Pressable
                  key={role}
                  onPress={() => onChangeRole(role)}
                  disabled={busy || selected}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.roleChoice, selected && styles.roleChoiceSelected]}
                >
                  <Text style={[styles.roleChoiceText, selected && styles.roleChoiceTextSelected]}>{role}</Text>
                </Pressable>
              );
            })}
          </View>
          {member.role === ROLE_TEMPORARY ? (
            <Text style={styles.hint}>ロールを付けると、イベント以外も使えるコミュニティのメンバーになります</Text>
          ) : null}
          <Pressable onPress={onRemove} disabled={busy} accessibilityRole="button" style={styles.removeButton}>
            <Ionicons name="person-remove-outline" size={16} color={colors.danger} />
            <Text style={styles.removeText}>コミュニティから除籍する</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBox: { gap: 12, alignSelf: 'stretch' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 48, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub, marginTop: 8, marginBottom: 4 },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rowExpanded: { borderColor: colors.primary },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  me: { fontSize: 12, fontWeight: '400', color: colors.textSub },
  userId: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: 14,
    gap: 10,
    backgroundColor: colors.bg,
  },
  actionsLabel: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChoice: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleChoiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChoiceText: { fontSize: 13, color: colors.text },
  roleChoiceTextSelected: { color: colors.white, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textSub },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  removeText: { fontSize: 14, color: colors.danger, fontWeight: '500' },
  rolesLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 20 },
  rolesLinkText: { fontSize: 13, color: colors.primary },
});
