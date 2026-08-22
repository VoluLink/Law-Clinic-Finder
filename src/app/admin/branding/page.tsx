import type { Metadata } from 'next';

import { loadBranding } from '@/lib/branding/branding';
import { firebaseBrandingRepository } from '@/lib/firebase/branding-repository';

import { BrandingForm } from './BrandingForm';

export const metadata: Metadata = { title: 'Branding – Admin' };

export default async function AdminBrandingPage() {
  const branding = await loadBranding(firebaseBrandingRepository);
  return <BrandingForm branding={branding} />;
}
