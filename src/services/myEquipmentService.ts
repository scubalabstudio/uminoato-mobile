import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Camera, type Housing, type Lens } from '@/services/supabaseService';

const STORAGE_KEY = 'my_equipment_v1';

export interface MyEquipmentSet {
  id: string;
  camera: Camera;
  housing: Housing | null;
  lens: Lens | null;
}

export function equipmentSetLabel(set: MyEquipmentSet): string {
  const cam = set.camera.display_name ?? `${set.camera.brand ?? ''} ${set.camera.model}`.trim();
  const parts = [cam];
  if (set.housing) parts.push(set.housing.brand ? `${set.housing.brand} ${set.housing.model}` : set.housing.model);
  if (set.lens) parts.push(set.lens.brand ? `${set.lens.brand} ${set.lens.model}` : set.lens.model);
  return parts.join(' / ');
}

export async function loadMyEquipment(): Promise<MyEquipmentSet[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addMyEquipmentSet(set: Omit<MyEquipmentSet, 'id'>): Promise<MyEquipmentSet[]> {
  const current = await loadMyEquipment();
  const newSet: MyEquipmentSet = { ...set, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` };
  const next = [...current, newSet];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeMyEquipmentSet(id: string): Promise<MyEquipmentSet[]> {
  const current = await loadMyEquipment();
  const next = current.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
