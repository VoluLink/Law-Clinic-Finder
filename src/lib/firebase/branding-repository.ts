import { randomUUID } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';

import {
  DEFAULT_BRANDING,
  brandingSchema,
  type Branding,
  type BrandingUpdate,
} from '@/lib/branding/branding';
import type { BrandingRepository } from '@/lib/branding/repository';
import { logger } from '@/lib/logger';

import { firebaseFirestore, firebaseStorage } from './admin';
import { brandingDocumentSchema, type BrandingDocument } from './documents';
import { firebaseConfig } from './env';

const CACHE_MS = 5 * 60 * 1000;
const MANAGED_LOGO = /^branding\/logo-[0-9a-f-]+\.png$/;

type BrandingCache = { expiresAt: number; value: Promise<Branding | null> };

let cache: BrandingCache | null = null;

function logoUrl(path: string | null): string | null {
  if (!path) return null;
  const bucket = firebaseConfig().storageBucket;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

function toBranding(document: BrandingDocument): Branding {
  return brandingSchema.parse({
    wordmark: document.wordmark,
    logo_url: logoUrl(document.logoPath),
    color_primary: document.colorPrimary,
    color_background: document.colorBackground,
    color_accent: document.colorAccent,
    color_foreground: document.colorForeground,
    font: document.font,
  });
}

async function loadBrandingDocument(): Promise<Branding | null> {
  const snapshot = await firebaseFirestore().collection('branding').doc('current').get();
  return snapshot.exists ? toBranding(brandingDocumentSchema.parse(snapshot.data())) : null;
}

async function read(): Promise<Branding | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const value = loadBrandingDocument();
  cache = { expiresAt: now + CACHE_MS, value };
  value.catch(() => {
    if (cache?.value === value) cache = null;
  });
  return value;
}

function defaultDocument(): Omit<BrandingDocument, 'updatedAt'> {
  return {
    wordmark: DEFAULT_BRANDING.wordmark,
    logoPath: null,
    colorPrimary: DEFAULT_BRANDING.color_primary,
    colorBackground: DEFAULT_BRANDING.color_background,
    colorAccent: DEFAULT_BRANDING.color_accent,
    colorForeground: DEFAULT_BRANDING.color_foreground,
    font: DEFAULT_BRANDING.font,
  };
}

function updatedDocument(branding: BrandingUpdate, logoPath: string | null) {
  return {
    wordmark: branding.wordmark,
    logoPath,
    colorPrimary: branding.color_primary,
    colorBackground: branding.color_background,
    colorAccent: branding.color_accent,
    colorForeground: branding.color_foreground,
    font: branding.font,
    updatedAt: Timestamp.now(),
  };
}

async function update(branding: BrandingUpdate): Promise<void> {
  const reference = firebaseFirestore().collection('branding').doc('current');
  await firebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? brandingDocumentSchema.parse(snapshot.data()) : null;
    transaction.set(reference, updatedDocument(branding, current?.logoPath ?? null));
  });
  cache = null;
}

async function replaceLogoPath(path: string): Promise<string | null> {
  const reference = firebaseFirestore().collection('branding').doc('current');
  return firebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? brandingDocumentSchema.parse(snapshot.data()) : null;
    transaction.set(reference, {
      ...(current ?? defaultDocument()),
      logoPath: path,
      updatedAt: Timestamp.now(),
    });
    return current?.logoPath ?? null;
  });
}

async function removeManagedLogo(path: string | null): Promise<void> {
  if (!path || !MANAGED_LOGO.test(path)) return;
  try {
    await firebaseStorage().bucket().file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    logger.warn('old branding logo cleanup failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}

async function uploadLogo(contents: Buffer): Promise<string> {
  const path = `branding/logo-${randomUUID()}.png`;
  const file = firebaseStorage().bucket().file(path);
  await file.save(contents, {
    resumable: false,
    contentType: 'image/png',
    metadata: { cacheControl: 'public,max-age=31536000,immutable' },
  });
  try {
    const oldPath = await replaceLogoPath(path);
    await removeManagedLogo(oldPath);
  } catch (cause) {
    await removeManagedLogo(path);
    throw cause;
  }
  cache = null;
  return logoUrl(path)!;
}

export const firebaseBrandingRepository: BrandingRepository = { read, update, uploadLogo };
