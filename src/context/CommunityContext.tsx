import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import { errorMessage } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Community, MyInvitation, MyInvitedEvent } from '@/types';

// 最後に開いていたコミュニティ。次回起動・ログイン時にそのコミュニティに入った状態で始める
const KEY_CURRENT_COMMUNITY = 'uminoato_current_community_id';

// 切り替え先としての「ゲスト」（所属していないコミュニティのイベントをまとめて見る）
export const GUEST = 'guest';
type Selection = number | typeof GUEST;

interface CommunityValue {
  communities: Community[];
  invitations: MyInvitation[];
  invitedEvents: MyInvitedEvent[];
  // 所属していないコミュニティのイベント（テンポラリーメンバーとしてのゲスト参加。招待中・参加中）
  guestEvents: MyInvitedEvent[];
  // 選択中のコミュニティ。ゲストを選んでいるとき・所属コミュニティが無いときは null
  current: Community | null;
  // ゲストを選んでいる（ゲスト参加のイベントがあるときだけ true になりうる）
  isGuestSelected: boolean;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  select: (target: Selection) => void;
  // 招待への応答。参加したコミュニティにはそのまま切り替える。失敗時はアラートを出して false を返す
  respondInvitation: (invitation: MyInvitation, accept: boolean) => Promise<boolean>;
  respondEventInvitation: (
    event: Pick<MyInvitedEvent, 'id' | 'name' | 'community_id'>,
    accept: boolean,
  ) => Promise<boolean>;
}

const CommunityContext = createContext<CommunityValue | null>(null);

export function useCommunity(): CommunityValue {
  const value = use(CommunityContext);
  if (!value) throw new Error('useCommunity must be used within CommunityProvider');
  return value;
}

export function CommunityProvider({ children }: PropsWithChildren) {
  const { handleApiError } = useSession();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<MyInvitedEvent[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, i, e] = await Promise.all([
        api.fetchCommunities(),
        api.fetchMyInvitations(),
        api.fetchMyInvitedEvents(),
      ]);
      setCommunities(c);
      setInvitations(i);
      setInvitedEvents(e);
      setLoadError(null);
    } catch (err) {
      if (!handleApiError(err)) setLoadError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(KEY_CURRENT_COMMUNITY).catch(() => null);
      if (saved) setSelection(saved === GUEST ? GUEST : Number(saved));
      await reload();
    })();
  }, [reload]);

  const select = useCallback((target: Selection) => {
    setSelection(target);
    AsyncStorage.setItem(KEY_CURRENT_COMMUNITY, String(target)).catch(() => {});
  }, []);

  const respondInvitation = useCallback(
    async (invitation: MyInvitation, accept: boolean) => {
      try {
        if (accept) {
          await api.acceptInvitation(invitation.id);
          select(invitation.community_id);
        } else {
          await api.declineInvitation(invitation.id);
        }
        await reload();
        return true;
      } catch (err) {
        if (!handleApiError(err)) Alert.alert(errorMessage(err));
        return false;
      }
    },
    [handleApiError, reload, select],
  );

  const respondEventInvitation = useCallback(
    async (event: Pick<MyInvitedEvent, 'id' | 'name' | 'community_id'>, accept: boolean) => {
      try {
        await api.respondEventInvitation(event.community_id, event.id, accept ? 'accepted' : 'declined');
        await reload();
        if (accept) Alert.alert('参加しました', `「${event.name}」に参加しました。`);
        return true;
      } catch (err) {
        if (!handleApiError(err)) Alert.alert(errorMessage(err));
        return false;
      }
    },
    [handleApiError, reload],
  );

  const guestEvents = useMemo(() => {
    const mine = new Set(communities.map((c) => c.id));
    return invitedEvents.filter((ev) => !mine.has(ev.community_id));
  }, [communities, invitedEvents]);

  // ゲストを選んでいてもゲスト参加のイベントが無くなっていれば、コミュニティ側に戻す
  const isGuestSelected = selection === GUEST && guestEvents.length > 0;
  // 保存していたコミュニティから抜けた・別アカウントでログインした場合は先頭のコミュニティにする
  const current = isGuestSelected
    ? null
    : (communities.find((c) => c.id === selection) ?? communities[0] ?? null);

  const value = useMemo(
    () => ({
      communities,
      invitations,
      invitedEvents,
      guestEvents,
      current,
      isGuestSelected,
      isLoading,
      loadError,
      reload,
      select,
      respondInvitation,
      respondEventInvitation,
    }),
    [
      communities,
      invitations,
      invitedEvents,
      guestEvents,
      current,
      isGuestSelected,
      isLoading,
      loadError,
      reload,
      select,
      respondInvitation,
      respondEventInvitation,
    ],
  );

  return <CommunityContext value={value}>{children}</CommunityContext>;
}
