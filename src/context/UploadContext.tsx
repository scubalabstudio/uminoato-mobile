import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { errorMessage } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

// イベント写真のまとめてアップロード。画面を閉じても・別のタブに移っても続くよう、アプリ全体で持つ

export interface UploadAsset {
  uri: string;
  mimeType: string;
  ext: string;
}

// 選んだ写真すべてに同じものが入る
export interface UploadMeta {
  isDiving: boolean;
  diveSortOrder: number | null;
  jaName: string;
  sciName: string;
  creatureId: number | null;
  cameraMake: string;
  cameraModel: string;
  housingId: number | null;
  lensId: number | null;
}

export interface UploadJob {
  communityId: number;
  eventId: number;
  eventName: string;
  total: number;
  // 送り終えた枚数（失敗も含む）
  done: number;
  failed: number;
  finished: boolean;
}

interface UploadValue {
  job: UploadJob | null;
  // 別のアップロード中なら false を返して何もしない
  startUpload: (target: { communityId: number; eventId: number; eventName: string }, assets: UploadAsset[], meta: UploadMeta) => boolean;
  // 1枚上がるたびに呼ばれる。返り値で登録を外す
  onPhotoUploaded: (listener: (eventId: number) => void) => () => void;
}

const UploadContext = createContext<UploadValue | null>(null);

export function useUpload(): UploadValue {
  const value = useContext(UploadContext);
  if (!value) throw new Error('useUpload must be used within UploadProvider');
  return value;
}

// 完了の表示を残す時間
const FINISHED_VISIBLE_MS = 3000;

export function UploadProvider({ children }: { children: ReactNode }) {
  const { handleApiError } = useSession();
  const [job, setJob] = useState<UploadJob | null>(null);
  const running = useRef(false);
  const listeners = useRef(new Set<(eventId: number) => void>());

  const onPhotoUploaded = useCallback((listener: (eventId: number) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const startUpload = useCallback<UploadValue['startUpload']>(
    (target, assets, meta) => {
      if (running.current || assets.length === 0) return false;
      running.current = true;
      setJob({ ...target, total: assets.length, done: 0, failed: 0, finished: false });

      (async () => {
        let failed = 0;
        let lastError: unknown = null;
        for (let i = 0; i < assets.length; i++) {
          const { uri, mimeType, ext } = assets[i];
          try {
            await api.uploadEventPhoto(
              target.communityId, target.eventId, uri, meta.isDiving,
              meta.diveSortOrder ?? undefined,
              mimeType, ext,
              {
                japanese_name: meta.jaName || undefined,
                scientific_name: meta.sciName || undefined,
                creature_id: meta.creatureId ?? undefined,
                camera_make: meta.cameraMake || undefined,
                camera_model: meta.cameraModel || undefined,
                housing_id: meta.housingId ?? undefined,
                lens_id: meta.lensId ?? undefined,
              },
            );
            listeners.current.forEach((listener) => listener(target.eventId));
          } catch (e) {
            lastError = e;
            // ログイン切れ・回数制限・イベント終了などは、残りを送っても失敗するので止める
            const stop = e instanceof api.UnauthorizedError
              || (e instanceof api.ApiError && (e.status === 403 || e.status === 429));
            if (stop) {
              failed += assets.length - i;
              setJob((j) => (j ? { ...j, done: assets.length, failed } : j));
              break;
            }
            failed += 1;
          }
          setJob((j) => (j ? { ...j, done: i + 1, failed } : j));
        }

        running.current = false;
        setJob((j) => (j ? { ...j, finished: true } : j));
        setTimeout(() => setJob((j) => (j?.finished ? null : j)), FINISHED_VISIBLE_MS);

        if (lastError && !handleApiError(lastError)) {
          const title = assets.length === 1
            ? 'アップロードエラー'
            : `${assets.length}枚中${failed}枚をアップロードできませんでした`;
          Alert.alert(title, `「${target.eventName}」\n${errorMessage(lastError)}`);
        }
      })();
      return true;
    },
    [handleApiError],
  );

  const value = useMemo(() => ({ job, startUpload, onPhotoUploaded }), [job, startUpload, onPhotoUploaded]);
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}
