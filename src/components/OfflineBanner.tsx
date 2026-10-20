import * as Network from 'expo-network';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@expo/vector-icons/Ionicons';

const BANNER_HEIGHT = 34;

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [checked, setChecked] = useState(false);
  const translateY = useRef(new Animated.Value(BANNER_HEIGHT + 100)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
      setChecked(true);
    };
    check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!checked) return;
    Animated.spring(translateY, {
      toValue: isOffline ? 0 : BANNER_HEIGHT + insets.bottom,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOffline, checked, translateY, insets.bottom]);

  return (
    <Animated.View
      style={[styles.banner, { bottom: insets.bottom, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>オフライン — ネットワーク接続を確認してください</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    height: BANNER_HEIGHT,
    backgroundColor: '#374151',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  text: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    flexShrink: 1,
  },
});
