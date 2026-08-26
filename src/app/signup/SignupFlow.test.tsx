import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DirectoryMatch } from '@/lib/signup/directory';

import { SignupFlow } from './SignupFlow';

const SEARCH_FIELD = 'Name der Law Clinic';

const unclaimed: DirectoryMatch = {
  id: '9f8b6c3a-0000-4000-8000-000000000001',
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Köln',
  claimed: false,
  hasContactEmail: true,
};

const claimed: DirectoryMatch = {
  ...unclaimed,
  id: '9f8b6c3a-0000-4000-8000-000000000002',
  name: 'Refugee Law Clinic Berlin',
  claimed: true,
};

function stubRoutes(routes: Record<string, () => Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const handler = routes[String(input)];
      if (!handler) throw new Error(`unexpected fetch: ${String(input)}`);
      return Promise.resolve(handler());
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignupFlow', () => {
  it('lists the directory before anything is typed', async () => {
    stubRoutes({ '/api/signup/search': () => Response.json({ results: [unclaimed, claimed] }) });
    render(<SignupFlow />);
    expect(await screen.findByText(unclaimed.name)).toBeInTheDocument();
    expect(screen.getByText(claimed.name)).toBeInTheDocument();
  });

  it('sends the typed query to the search endpoint', async () => {
    stubRoutes({ '/api/signup/search': () => Response.json({ results: [unclaimed] }) });
    render(<SignupFlow />);
    await screen.findByText(unclaimed.name);
    await userEvent.type(screen.getByLabelText(SEARCH_FIELD), 'Miet');
    await vi.waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls;
      const last = calls[calls.length - 1]?.[1] as RequestInit;
      expect(JSON.parse(String(last.body))).toEqual({ query: 'Miet' });
    });
  });

  it('walks search → claim → verify for an unclaimed clinic', async () => {
    stubRoutes({
      '/api/signup/search': () => Response.json({ results: [unclaimed] }),
      '/api/signup/claim': () =>
        Response.json({ status: 'sent', maskedEmail: 'k****t@example.org' }),
    });
    render(<SignupFlow />);
    await userEvent.click(await screen.findByRole('button', { name: 'Das ist meine' }));
    /* The confirm screen says an address is on file but never shows it: the
     * search that led here is public, so anything it renders is harvestable. */
    expect(screen.getByText(/bereits eine E-Mail-Adresse hinterlegt/)).toBeInTheDocument();
    expect(screen.queryByText('k****t@example.org')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Anmeldelink anfordern' }));
    /* Once a claim is actually made, the masked address is shown — by then the
     * claimant has triggered a mail to it and needs to know which one to open. */
    expect(await screen.findByText('Prüfe dein Postfach')).toBeInTheDocument();
    expect(screen.getByText('k****t@example.org')).toBeInTheDocument();
  });

  it('offers login instead of claiming for already active clinics', async () => {
    stubRoutes({ '/api/signup/search': () => Response.json({ results: [claimed] }) });
    render(<SignupFlow />);
    const loginLink = await screen.findByRole('link', { name: 'Mit E-Mail anmelden' });
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Das ist meine' })).not.toBeInTheDocument();
  });

  it('marks an already active clinic with a badge', async () => {
    stubRoutes({ '/api/signup/search': () => Response.json({ results: [claimed] }) });
    render(<SignupFlow />);
    expect(await screen.findByText('bereits aktiv')).toBeInTheDocument();
  });

  it('shows the wait time when the resend window is exhausted', async () => {
    stubRoutes({
      '/api/signup/search': () => Response.json({ results: [unclaimed] }),
      '/api/signup/claim': () => Response.json({ status: 'blocked', retryDays: 5 }),
    });
    render(<SignupFlow />);
    await userEvent.click(await screen.findByRole('button', { name: 'Das ist meine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anmeldelink anfordern' }));
    expect(await screen.findByRole('status')).toHaveTextContent('in 5 Tagen');
  });

  it('opens the registration form from the directory footer', async () => {
    stubRoutes({ '/api/signup/search': () => Response.json({ results: [] }) });
    render(<SignupFlow />);
    await userEvent.click(
      await screen.findByRole('button', { name: '+ Neue Law Clinic eintragen' }),
    );
    expect(screen.getByRole('heading', { name: 'Neue Law Clinic eintragen' })).toBeInTheDocument();
  });

  it('debounces typing into fewer requests than keystrokes', async () => {
    stubRoutes({ '/api/signup/search': () => Response.json({ results: [unclaimed] }) });
    render(<SignupFlow />);
    await screen.findByText(unclaimed.name);
    const typed = 'Mietrecht';
    await userEvent.type(screen.getByLabelText(SEARCH_FIELD), typed);
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThan(typed.length);
  });

  it('does not let a superseded response overwrite newer results', async () => {
    let releaseFirst: (() => void) | undefined;
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        call += 1;
        if (call === 1) {
          return new Promise<Response>((resolve) => {
            releaseFirst = () => resolve(Response.json({ results: [claimed] }));
          });
        }
        return Promise.resolve(Response.json({ results: [unclaimed] }));
      }),
    );
    render(<SignupFlow />);
    await userEvent.type(screen.getByLabelText(SEARCH_FIELD), 'Miet');
    expect(await screen.findByText(unclaimed.name)).toBeInTheDocument();
    // act() flushes the late resolution, so the assertion below is only
    // reachable after the stale response has had its chance to apply.
    await act(async () => releaseFirst?.());
    expect(screen.queryByText(claimed.name)).not.toBeInTheDocument();
    expect(screen.getByText(unclaimed.name)).toBeInTheDocument();
  });

  it('surfaces a generic message when the search endpoint fails', async () => {
    stubRoutes({ '/api/signup/search': () => new Response('nope', { status: 500 }) });
    render(<SignupFlow />);
    expect(await screen.findByText(/schiefgelaufen/)).toBeInTheDocument();
  });
});
