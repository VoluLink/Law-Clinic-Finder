'use client';

import { useEffect, useRef } from 'react';
import { z } from 'zod';

import {
  confirmationDestinationSchema,
  confirmationPayloadFromFragment,
  type ConfirmationDestination,
  type ConfirmationPayload,
} from '@/lib/auth/confirmation-payload';

const confirmationResponseSchema = z
  .object({ destination: confirmationDestinationSchema })
  .strict();
const ERROR_DESTINATION: ConfirmationDestination = '/login?error=1';

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type ConfirmationRuntime = {
  clearFragment: () => void;
  post: (payload: ConfirmationPayload) => Promise<ConfirmationDestination>;
  navigate: (destination: ConfirmationDestination) => void;
};

export async function postConfirmation(
  payload: ConfirmationPayload,
  fetcher: Fetcher = fetch,
): Promise<ConfirmationDestination> {
  try {
    const response = await fetcher('/api/auth/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return ERROR_DESTINATION;
    const parsed = confirmationResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.destination : ERROR_DESTINATION;
  } catch {
    return ERROR_DESTINATION;
  }
}

export async function runConfirmation(
  fragment: string,
  runtime: ConfirmationRuntime,
): Promise<void> {
  runtime.clearFragment();
  const payload = confirmationPayloadFromFragment(fragment);
  if (!payload) {
    runtime.navigate(ERROR_DESTINATION);
    return;
  }
  try {
    runtime.navigate(await runtime.post(payload));
  } catch {
    runtime.navigate(ERROR_DESTINATION);
  }
}

function browserRuntime(): ConfirmationRuntime {
  return {
    clearFragment: () => window.history.replaceState(null, '', window.location.pathname),
    post: postConfirmation,
    navigate: (destination) => window.location.replace(destination),
  };
}

export function ConfirmLink() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runConfirmation(window.location.hash, browserRuntime());
  }, []);

  return (
    <p role="status" className="text-sm text-foreground">
      Anmeldung wird sicher bestätigt …
    </p>
  );
}
