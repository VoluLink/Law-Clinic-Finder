import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogsList, type LogRow } from './LogsList';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const rows: LogRow[] = [
  {
    id: '1',
    logged_at: '2026-07-21T10:00:00.000Z',
    level: 'error',
    msg: 'chat run failed',
    fields: { reason: 'api down' },
  },
  {
    id: '2',
    logged_at: '2026-07-21T09:00:00.000Z',
    level: 'warn',
    msg: 'signup search failed',
    fields: null,
  },
  {
    id: '3',
    logged_at: '2026-07-21T08:00:00.000Z',
    level: 'info',
    msg: 'server started',
    fields: null,
  },
];

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('LogsList', () => {
  it('renders each log with its uppercased level badge', () => {
    render(<LogsList logs={rows} />);
    expect(screen.getByText('chat run failed')).toBeInTheDocument();
    const badge = screen.getByText('ERROR');
    expect(badge.className).toContain('text-danger');
  });

  it('narrows the list to the selected level', async () => {
    render(<LogsList logs={rows} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'warn');
    expect(screen.getByText('signup search failed')).toBeInTheDocument();
    expect(screen.queryByText('chat run failed')).not.toBeInTheDocument();
  });

  it('filters by a search term across message and fields', async () => {
    render(<LogsList logs={rows} />);
    await userEvent.type(screen.getByPlaceholderText(/suchen/i), 'api down');
    expect(screen.getByText('chat run failed')).toBeInTheDocument();
    expect(screen.queryByText('server started')).not.toBeInTheDocument();
  });

  it('copies the filtered logs as NDJSON for pasting into an LLM', async () => {
    render(<LogsList logs={rows} />);
    await userEvent.click(screen.getByRole('button', { name: /LLM kopieren/i }));

    expect(writeText).toHaveBeenCalledOnce();
    const payload = writeText.mock.calls[0][0] as string;
    const first = JSON.parse(payload.split('\n')[0]) as Record<string, unknown>;
    expect(first).toEqual({
      logged_at: '2026-07-21T10:00:00.000Z',
      level: 'error',
      msg: 'chat run failed',
      reason: 'api down',
    });
    expect(payload.split('\n')).toHaveLength(rows.length);
  });

  it('shows an empty-state message when there are no logs', () => {
    render(<LogsList logs={[]} />);
    expect(screen.getByText(/Keine Warnungen oder Fehler/)).toBeInTheDocument();
  });

  it('reports rows that could not be read instead of hiding the gap', () => {
    render(<LogsList logs={[]} unreadable={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('3 Einträge konnten nicht gelesen werden');
  });

  it('filters to a single request when its correlation id is picked', async () => {
    const rows: LogRow[] = [
      {
        id: '1',
        logged_at: '2026-08-23T10:00:00.000Z',
        level: 'error',
        msg: 'chat run failed',
        fields: { requestId: 'req-a' },
      },
      {
        id: '2',
        logged_at: '2026-08-23T10:00:01.000Z',
        level: 'warn',
        msg: 'unrelated warning',
        fields: { requestId: 'req-b' },
      },
    ];
    render(<LogsList logs={rows} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Request anzeigen' })[0]);

    expect(screen.getByText('chat run failed')).toBeInTheDocument();
    expect(screen.queryByText('unrelated warning')).not.toBeInTheDocument();
  });
});
