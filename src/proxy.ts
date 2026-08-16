import { NextResponse, type NextRequest } from 'next/server';

import { loadProxySession } from '@/lib/supabase/proxy-session';

const PENDING_PATH = '/clinic/pending';

/**
 * First defense layer only (per Next.js proxy docs): every gated route and
 * page re-checks the role via requireRole(), and RLS enforces it in the DB.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, role, pending } = await loadProxySession(request);
  if (!role) return NextResponse.redirect(new URL('/login', request.url));
  const { pathname } = request.nextUrl;
  // A pending claimant proved they own the address but not that the clinic is
  // theirs, so the waiting page is the only gated route they may see.
  if (pending) {
    if (pathname === PENDING_PATH) return response;
    return NextResponse.redirect(new URL(PENDING_PATH, request.url));
  }
  if (pathname === PENDING_PATH) return NextResponse.redirect(new URL('/clinic', request.url));
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/clinic', request.url));
  }
  return response;
}

export const config = { matcher: ['/admin/:path*', '/clinic/:path*'] };
