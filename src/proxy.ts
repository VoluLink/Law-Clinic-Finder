import { NextResponse, type NextRequest } from 'next/server';

import { loadProxySession } from '@/lib/supabase/proxy-session';

/**
 * First defense layer only (per Next.js proxy docs): every gated route and
 * page re-checks the role via requireRole(), and RLS enforces it in the DB.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, role } = await loadProxySession(request);
  if (!role) return NextResponse.redirect(new URL('/login', request.url));
  if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/clinic', request.url));
  }
  return response;
}

export const config = { matcher: ['/admin/:path*', '/clinic/:path*'] };
