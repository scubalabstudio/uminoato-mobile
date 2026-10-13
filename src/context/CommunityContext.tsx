import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import { errorMessage } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Community, MyInvitation, MyInvitedEvent } from '@/types';

// 最後に開いていたコミュニティ。次回起動・ログイン時にそのコミュニティに入った状態で始める
const KEY_CURRENT_COMMUNITY = 'uminoato_current_community_id';

interface CommunityValue {
  communities: Community[];
  invitations: MyInvitation[];
  invitedEvents: MyInvitedEvent[];
  // 選択中のコミュニティ。参加しているコミュニティが無いときだけ null
  current: Community | null;
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  select: (communityId: number) => void;
  // 招待への応答。参加したコミュニティにはそのまま切り替える。失敗時はアラートを出して false を返す
  respondInvitation: (invitation: MyInvitation, accept: boolean) => Promise<boolean>;
  respondEventInvitation: (event: MyInvitedEvent, accept: boolean) => Promise<boolean>;
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
  const [currentId, setCurrentId] = useState<number | null>(null);
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
      if (saved) setCurrentId(Number(saved));
      await reload();
    })();
  }, [reload]);

  const select = useCallback((communityId: number) => {
    setCurrentId(communityId);
    AsyncStorage.setItem(KEY_CURRENT_COMMUNITY, String(communityId)).catch(() => {});
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
    async (event: MyInvitedEvent, accept: boolean) => {
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

  // 保存していたコミュニティから抜けた・別アカウントでログインした場合は先頭のコミュニティにする
  const current = communities.find((c) => c.id === currentId) ?? communities[0] ?? null;

  const value = useMemo(
    () => ({
      communities,
      invitations,
      invitedEvents,
      current,
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
      current,
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
