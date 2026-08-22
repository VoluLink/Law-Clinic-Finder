import { z } from 'zod';

export const publicClinicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  region: z.string().nullable(),
  website: z.string().nullable(),
  legal_areas: z.string(),
  target_clients: z.string().nullable(),
  languages: z.string().nullable(),
  requirements: z.string().nullable(),
});

export const recommendationClinicSchema = publicClinicSchema
  .pick({
    id: true,
    name: true,
    region: true,
    website: true,
    legal_areas: true,
  })
  .extend({ contact_email: z.string().email().nullable() });

export type PublicClinic = z.infer<typeof publicClinicSchema>;
export type RecommendationClinic = z.infer<typeof recommendationClinicSchema>;

export type ClinicDirectoryRepository = {
  listPublished: () => Promise<PublicClinic[]>;
  findPublishedByIds: (ids: string[]) => Promise<RecommendationClinic[]>;
};
