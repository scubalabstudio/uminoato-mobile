import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { NetworkErrorView } from '@/components/NetworkErrorView';
import { colors } from '@/constants/theme';
import * as api from '@/services/apiService';
import { fetchCreatureById, fetchHousingById, fetchLensById, type CreatureDetail, type Housing, type Lens } from '@/services/supabaseService';
import type { EncyclopediaEntryDetail, EncyclopediaPhoto } from '@/types';

export default function PublicEncyclopediaEntryScreen() {
  const { communityId, entryId, name } = useLocalSearchParams<{
    communityId: string; entryId: string; name?: string;
  }>();
  const cid = Number(communityId);
  const eid = Number(entryId);

  const [entry, setEntry] = useState<EncyclopediaEntryDetail | null>(null);
  const [creature, setCreature] = useState<CreatureDetail | null>(null);
  const [photoHousing, setPhotoHousing] = useState<Housing | null>(null);
  const [photoLens, setPhotoLens] = useState<Lens | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    try {
      const e = await api.fetchPublicEncyclopediaEntry(cid, eid);
      setEntry(e);
      if (e.creature_id) fetchCreatureById(e.creature_id).then(setCreature).catch(() => {});
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 404) {
        setNotFound(true);
      } else {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
      }
    }
  }, [cid, eid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPhotoHousing(null);
    setPhotoLens(null);
    if (!entry) return;
    const p = entry.photos[index];
    if (!p) return;
    if (p.housing_id) fetchHousingById(p.housing_id).then(setPhotoHousing);
    if (p.lens_id) fetchLensById(p.lens_id).then(setPhotoLens);
  }, [index, entry]);

  const title = entry?.japanese_name ?? name ?? '';

  if (!entry) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        {notFound ? (
          <View style={styles.notFound}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.notFoundTitle}>図鑑エントリが見つかりません</Text>
            <Text style={styles.notFoundSub}>このエントリは削除されたか、アクセスできません。</Text>
            <Pressable
              onPress={() => router.canGoBack() ? router.back() : router.replace('/' as never)}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>一覧に戻る</Text>
            </Pressable>
          </View>
        ) : error ? (
          <NetworkErrorView message={error} onRetry={load} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const photo = entry.photos[index] ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title }} />

      <PhotoPager photos={entry.photos} index={index} onIndexChange={setIndex} />

      {photo ? (
        <View style={styles.photoMeta}>
          <MetaLine icon="person-outline">
            {photo.uploader_name ?? '退会したユーザー'} · {formatDate(photo.uploaded_at)}
          </MetaLine>
          {photo.point_name ? <MetaLine icon="location-outline">{photo.point_name}</MetaLine> : null}
          {photo.camera_make || photo.camera_model ? (
            <MetaLine icon="camera-outline">
              {[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}
            </MetaLine>
          ) : null}
          {photoHousing ? (
            <MetaLine icon="layers-outline">
              {[photoHousing.brand, photoHousing.model].filter(Boolean).join(' ')}
            </MetaLine>
          ) : null}
          {photoLens ? (
            <MetaLine icon="aperture-outline">
              {[photoLens.brand, photoLens.model].filter(Boolean).join(' ')}
            </MetaLine>
          ) : null}
        </View>
      ) : null}

      <View style={styles.body}>
        <View>
          <Text style={styles.name}>{entry.japanese_name}</Text>
          <Text style={styles.scientific}>{entry.scientific_name}</Text>
        </View>

        {entry.tags.length > 0 ? (
          <Section title="タグ">
            <View style={styles.tags}>
              {entry.tags.map(tag => (
                <Text key={tag.id} style={styles.tag}>{tag.name}</Text>
              ))}
            </View>
          </Section>
        ) : null}

        {creature ? <CreatureSection creature={creature} /> : null}
      </View>
    </ScrollView>
  );
}

function PhotoPager({
  photos,
  index,
  onIndexChange,
}: {
  photos: EncyclopediaPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 0.75);

  if (photos.length === 0) {
    return (
      <View style={[styles.noPhoto, { height }]}>
        <Ionicons name="fish-outline" size={32} color={colors.textMuted} />
        <Text style={styles.noPhotoText}>写真なし</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={photos}
        keyExtractor={p => String(p.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.display_url }}
            style={{ width, height, backgroundColor: '#000' }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        )}
        onMomentumScrollEnd={e => onIndexChange(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MetaLine({
  icon,
  children,
}: {
  icon: 'person-outline' | 'location-outline' | 'camera-outline' | 'layers-outline' | 'aperture-outline';
  children: ReactNode;
}) {
  return (
    <View style={styles.metaLine}>
      <Ionicons name={icon} size={14} color={colors.textSub} />
      <Text style={styles.metaText} numberOfLines={1}>{children}</Text>
    </View>
  );
}

function CreatureSection({ creature }: { creature: CreatureDetail }) {
  const facts = [
    { label: 'サイズ', value: creature.size },
    { label: '水深', value: creature.depth_range },
    { label: 'レア度', value: creature.rarity },
  ].filter(f => f.value);
  const category = [creature.category, creature.subcategory].filter(Boolean).join(' › ');

  return (
    <Section title="生き物情報">
      {creature.description ? (
        <View style={styles.paragraph}>
          <Text style={styles.factLabel}>特徴</Text>
          <Text style={styles.paragraphText}>{creature.description}</Text>
        </View>
      ) : null}
      {creature.habitat ? (
        <View style={styles.paragraph}>
          <Text style={styles.factLabel}>生息環境</Text>
          <Text style={styles.paragraphText}>{creature.habitat}</Text>
        </View>
      ) : null}
      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map(f => (
            <View key={f.label} style={styles.fact}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {category ? (
        <View style={styles.paragraph}>
          <Text style={styles.factLabel}>分類</Text>
          <Text style={styles.paragraphText}>{category}</Text>
        </View>
      ) : null}
    </Section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  notFound: { gap: 12, alignItems: 'center' },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  notFoundSub: { fontSize: 14, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
  backBtn: {
    marginTop: 4,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary,
  },
  backBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  container: { paddingBottom: 48 },

  noPhoto: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPhotoText: { fontSize: 13, color: colors.textSub },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },

  photoMeta: { paddingHorizontal: 16, paddingTop: 10, gap: 0 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  metaText: { fontSize: 13, color: colors.textSub, flexShrink: 1 },

  body: { padding: 16, gap: 24 },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  scientific: { fontSize: 15, fontStyle: 'italic', color: colors.textSub, marginTop: 2, textAlign: 'center' },

  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    fontSize: 13, color: colors.primary,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, overflow: 'hidden',
  },

  paragraph: { gap: 4 },
  paragraphText: { fontSize: 14, color: colors.text, lineHeight: 21 },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 10, gap: 2 },
  factLabel: { fontSize: 12, color: colors.textSub },
  factValue: { fontSize: 14, fontWeight: '600', color: colors.text },
});
