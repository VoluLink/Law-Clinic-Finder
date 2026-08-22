import type { Branding, BrandingUpdate } from './branding';

export type BrandingRepository = {
  read: () => Promise<Branding | null>;
  update: (branding: BrandingUpdate) => Promise<void>;
  uploadLogo: (contents: Buffer) => Promise<string>;
};
