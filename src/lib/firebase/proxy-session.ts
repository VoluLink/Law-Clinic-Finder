import { z } from 'zod';

const payloadSchema = z.object({
  exp: z.number().int().positive(),
  role: z.enum(['admin', 'clinic']),
  accessStatus: z.enum(['pending', 'active']),
});

export type OptimisticSession = {
  role: 'admin' | 'clinic' | null;
  pending: boolean;
};

function cookieValue(cookieHeader: string | null, name: string): string | null {
  const prefix = `${name}=`;
  const entry = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry?.slice(prefix.length) ?? null;
}

function decodePayload(token: string): unknown {
  const payload = token.split('.')[1];
  if (!payload) return null;
  const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

export function readOptimisticSession(
  cookieHeader: string | null,
  nowMs = Date.now(),
): OptimisticSession {
  try {
    const token = cookieValue(cookieHeader, '__session');
    const parsed = payloadSchema.safeParse(token ? decodePayload(token) : null);
    if (!parsed.success || parsed.data.exp * 1000 <= nowMs) {
      return { role: null, pending: false };
    }
    return {
      role: parsed.data.role,
      pending: parsed.data.accessStatus === 'pending',
    };
  } catch {
    return { role: null, pending: false };
  }
}
