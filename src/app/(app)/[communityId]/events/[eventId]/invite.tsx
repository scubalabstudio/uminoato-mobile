import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { EventUserSearchResult } from '@/types';

export default function InviteScreen() {
  const params = useLocalSearchParams<{ communityId: string; eventId: string }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState<Set<number>>(new Set());
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await api.searchEventUsers(communityId, eventId, query);
        setResults(users);
      } catch (e) {
        if (!handleApiError(e)) setError(errorMessage(e));
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query, communityId, eventId, handleApiError]);

  const invite = async (user: EventUserSearchResult) => {
    setInviting(user.user_id);
    setError(null);
    try {
      await api.inviteEventMember(communityId, eventId, user.user_id);
      setInvited(prev => new Set(prev).add(user.user_id));
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setInviting(null);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'メンバーを招待' }} />

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="ユーザー名・IDで検索（2文字以上）"
          placeholderTextColor={colors.textMuted}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searching ? <ActivityIndicator color={colors.primary} style={styles.searchSpinner} /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {query.length > 0 && query.length < 2 ? (
        <Text style={styles.hint}>2文字以上入力してください</Text>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={u => String(u.user_id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const done = invited.has(item.user_id);
          const loading = inviting === item.user_id;
          return (
            <View style={styles.row}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                {item.display_id ? <Text style={styles.userId}>@{item.display_id}</Text> : null}
              </View>
              <Pressable
                style={[styles.inviteBtn, (done || loading) && styles.inviteBtnDone]}
                onPress={() => invite(item)}
                disabled={done || loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.inviteBtnText}>{done ? '招待済み' : '招待'}</Text>
                }
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          !searching && query.length >= 2 ? (
            <Text style={styles.empty}>該当するユーザーが見つかりませんでした</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.text,
  },
  searchSpinner: { marginLeft: 8 },

  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
  },

  list: { paddingHorizontal: 16, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text },
  userId: { fontSize: 12, color: colors.textSub },

  inviteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    minWidth: 72,
    alignItems: 'center',
  },
  inviteBtnDone: { backgroundColor: colors.textMuted },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  empty: { fontSize: 14, color: colors.textSub, textAlign: 'center', marginTop: 32 },
});
