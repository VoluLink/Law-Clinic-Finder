import { NextResponse, type NextRequest } from 'next/server';

import { readOptimisticSession } from '@/lib/firebase/proxy-session';
import {
  contentSecurityPolicy,
  PRIVATE_CACHE_CONTROL,
  requiresPrivateCache,
} from '@/lib/http/security-headers';
import { stagingAccessState, type StagingAccessState } from '@/lib/http/staging-access';

const PENDING_PATH = '/clinic/pending';

/**
 * First defense layer only (per Next.js proxy docs): every gated route and
 * page re-checks the signed cookie and current Firestore profile via requireRole().
 * Claims decoded here are routing hints only and are deliberately not trusted.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const stagingState = stagingAccessState(request.headers.get('authorization'), process.env);
  const stagingResponse = stagingGate(stagingState, requestId);
  if (stagingResponse) return stagingResponse;
  const policy = contentSecurityPolicy(crypto.randomUUID(), process.env.NODE_ENV !== 'production');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('authorization');
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('Content-Security-Policy', policy);
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  if (nonce) requestHeaders.set('x-nonce', nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const redirect = protectedRedirect(request);
  const result = redirect ? NextResponse.redirect(new URL(redirect, request.url)) : response;
  result.headers.set('Content-Security-Policy', policy);
  result.headers.set('x-request-id', requestId);
  /* Not gated on the staging state: that gate disappears at public launch, which
   * is exactly when an intermediary cache holding an admin page starts to
   * matter. */
  if (stagingState === 'granted' || requiresPrivateCache(request.nextUrl.pathname)) {
    result.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
  }
  return result;
}

function stagingGate(state: StagingAccessState, requestId: string): NextResponse | null {
  if (state === 'disabled' || state === 'granted') return null;
  const status = state === 'misconfigured' ? 503 : 401;
  const headers = new Headers({ 'Cache-Control': 'no-store', 'x-request-id': requestId });
  if (status === 401) {
    headers.set('WWW-Authenticate', 'Basic realm="Law Clinic Finder staging", charset="UTF-8"');
  }
  return new NextResponse('Staging access is restricted.', { status, headers });
}

function protectedRedirect(request: NextRequest): string | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/clinic')) return null;
  const { role, pending } = readOptimisticSession(request.headers.get('cookie'));
  if (!role) return '/login';
  // A pending claimant proved they own the address but not that the clinic is
  // theirs, so the waiting page is the only gated route they may see.
  if (pending) {
    return pathname === PENDING_PATH ? null : PENDING_PATH;
  }
  if (pathname === PENDING_PATH) return '/clinic';
  return pathname.startsWith('/admin') && role !== 'admin' ? '/clinic' : null;
}

export const config = {
  matcher: ['/robots.txt', '/sitemap.xml', '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
