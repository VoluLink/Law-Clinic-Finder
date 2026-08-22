import { Timestamp } from 'firebase-admin/firestore';

import type { SettingRow } from '@/lib/settings';
import type { EditableChatSettings, SettingsRepository } from '@/lib/settings-repository';

import { firebaseFirestore } from './admin';
import { settingDocumentSchema } from './documents';

const CACHE_MS = 60 * 1000;

type SettingsCache = { expiresAt: number; rows: Promise<SettingRow[]> };

let cache: SettingsCache | null = null;

function toRows(values: Record<string, unknown>): SettingRow[] {
  return Object.entries(values).map(([key, value]) => ({ key, value }));
}

async function loadRows(): Promise<SettingRow[]> {
  const snapshot = await firebaseFirestore().collection('settings').doc('chat').get();
  if (!snapshot.exists) return [];
  return toRows(settingDocumentSchema.parse(snapshot.data()).values);
}

async function list(): Promise<SettingRow[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.rows;
  const rows = loadRows();
  cache = { expiresAt: now + CACHE_MS, rows };
  rows.catch(() => {
    if (cache?.rows === rows) cache = null;
  });
  return rows;
}

async function updateEditable(settings: EditableChatSettings): Promise<void> {
  const reference = firebaseFirestore().collection('settings').doc('chat');
  await firebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const stored = settingDocumentSchema.parse(snapshot.data());
    transaction.set(reference, {
      values: { ...stored.values, ...settings },
      updatedAt: Timestamp.now(),
    });
  });
  cache = null;
}

export const firebaseSettingsRepository: SettingsRepository = { list, updateEditable };
