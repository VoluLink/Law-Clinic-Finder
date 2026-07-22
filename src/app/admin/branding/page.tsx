import type { Metadata } from 'next';

import { loadBranding } from '@/lib/branding/branding';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { BrandingForm } from './BrandingForm';

export const metadata: Metadata = { title: 'Branding – Admin' };

export default async function AdminBrandingPage() {
  const supabase = await createSupabaseServerClient();
  const branding = await loadBranding(supabase);
  return <BrandingForm branding={branding} />;
}
