import { describe, expect, it } from 'vitest';

import { parseMigrationOptions } from './options';

const SOURCE_REF = 'abcdefghijklmnopqrst';
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${SOURCE_REF}.supabase.co`,
  SUPABASE_SECRET_KEY: 'source-secret',
  FIREBASE_PROJECT_ID: 'law-clinic-finder',
  FIREBASE_DATABASE_ID: 'primary-eu',
  FIREBASE_STORAGE_BUCKET: 'law-clinic-finder.firebasestorage.app',
};

describe(parseMigrationOptions, () => {
  it('defaults to a read-only dry run', () => {
    const options = parseMigrationOptions(
      ['--source-ref', SOURCE_REF, '--run-id', 'copy-20260816'],
      ENV,
    );
    expect(options.mode).toBe('dry-run');
  });

  it('does not require Firebase credentials for a source-only dry run', () => {
    const options = parseMigrationOptions(
      ['--source-ref', SOURCE_REF, '--run-id', 'copy-20260816'],
      {
        NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SECRET_KEY: ENV.SUPABASE_SECRET_KEY,
      },
    );
    expect(options.targetProject).toBe('law-clinic-finder');
  });

  it('requires an exact target confirmation before applying', () => {
    expect(() =>
      parseMigrationOptions(
        ['--source-ref', SOURCE_REF, '--run-id', 'copy-20260816', '--apply'],
        ENV,
      ),
    ).toThrow(/confirm-target/i);
  });

  it('accepts apply only for the configured Firebase project', () => {
    const options = parseMigrationOptions(
      [
        '--source-ref',
        SOURCE_REF,
        '--run-id',
        'copy-20260816',
        '--apply',
        '--confirm-target',
        'law-clinic-finder',
      ],
      ENV,
    );
    expect(options).toMatchObject({
      mode: 'apply',
      targetProject: 'law-clinic-finder',
      databaseId: 'primary-eu',
    });
  });

  it('requires apply mode for an explicit target reconciliation', () => {
    expect(() =>
      parseMigrationOptions(
        ['--source-ref', SOURCE_REF, '--run-id', 'copy-20260816', '--reconcile'],
        ENV,
      ),
    ).toThrow(/reconcile.*apply/i);
  });

  it('accepts reconciliation only with the exact apply target confirmation', () => {
    const options = parseMigrationOptions(
      [
        '--source-ref',
        SOURCE_REF,
        '--run-id',
        'copy-20260816',
        '--apply',
        '--reconcile',
        '--confirm-target',
        'law-clinic-finder',
      ],
      ENV,
    );
    expect(options).toMatchObject({ mode: 'apply', reconcile: true });
  });

  it('refuses apply when the named EU database is not explicit', () => {
    expect(() =>
      parseMigrationOptions(
        [
          '--source-ref',
          SOURCE_REF,
          '--run-id',
          'copy-20260816',
          '--apply',
          '--confirm-target',
          'law-clinic-finder',
        ],
        { ...ENV, FIREBASE_DATABASE_ID: '(default)' },
      ),
    ).toThrow();
  });

  it('requires explicit Firebase environment configuration for apply', () => {
    expect(() =>
      parseMigrationOptions(
        [
          '--source-ref',
          SOURCE_REF,
          '--run-id',
          'copy-20260816',
          '--apply',
          '--confirm-target',
          'law-clinic-finder',
        ],
        {
          NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SECRET_KEY: ENV.SUPABASE_SECRET_KEY,
        },
      ),
    ).toThrow();
  });

  it('rejects a source URL that does not match the declared source project', () => {
    expect(() =>
      parseMigrationOptions(['--source-ref', SOURCE_REF, '--run-id', 'copy-20260816'], {
        ...ENV,
        NEXT_PUBLIC_SUPABASE_URL: 'https://different-project.supabase.co',
      }),
    ).toThrow(/source/i);
  });

  it('requires TLS for the source connection', () => {
    expect(() =>
      parseMigrationOptions(['--source-ref', SOURCE_REF, '--run-id', 'copy-20260816'], {
        ...ENV,
        NEXT_PUBLIC_SUPABASE_URL: `http://${SOURCE_REF}.supabase.co`,
      }),
    ).toThrow(/source/i);
  });
});
