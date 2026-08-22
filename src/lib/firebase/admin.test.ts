import { afterEach, describe, expect, it, vi } from 'vitest';

const adminAppMocks = vi.hoisted(() => ({
  applicationDefault: vi.fn(() => 'application-default-credential'),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn((): object[] => []),
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

const adminFirestoreMocks = vi.hoisted(() => ({
  getFirestore: vi.fn(() => ({ databaseId: 'primary-eu' })),
}));

vi.mock('firebase-admin/app', () => adminAppMocks);
vi.mock('firebase-admin/firestore', () => adminFirestoreMocks);

import { firebaseAdminApp, firebaseFirestore } from './admin';

const originalEnvironment = { ...process.env };

describe(firebaseAdminApp.name, () => {
  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.clearAllMocks();
  });

  it('initializes with application default credentials and the pinned project', () => {
    configureEnvironment();

    firebaseAdminApp();

    expect(adminAppMocks.initializeApp).toHaveBeenCalledWith({
      credential: 'application-default-credential',
      projectId: 'law-clinic-finder',
      storageBucket: 'law-clinic-finder.firebasestorage.app',
    });
  });

  it('reuses the default app during development reloads', () => {
    configureEnvironment();
    adminAppMocks.getApps.mockReturnValue([{ name: '[DEFAULT]' }]);

    const app = firebaseAdminApp();

    expect(app).toEqual({ name: '[DEFAULT]' });
    expect(adminAppMocks.initializeApp).not.toHaveBeenCalled();
  });

  it('connects the Admin SDK to the named EU database', () => {
    configureEnvironment();

    firebaseFirestore();

    expect(adminFirestoreMocks.getFirestore).toHaveBeenCalledWith(
      { name: '[DEFAULT]' },
      'primary-eu',
    );
  });
});

function configureEnvironment() {
  process.env.FIREBASE_PROJECT_ID = 'law-clinic-finder';
  process.env.FIREBASE_DATABASE_ID = 'primary-eu';
  process.env.FIREBASE_STORAGE_BUCKET = 'law-clinic-finder.firebasestorage.app';
  process.env.IDENTITY_PLATFORM_API_KEY = 'public-web-api-key';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://law-clinic-finder.web.app';
}
