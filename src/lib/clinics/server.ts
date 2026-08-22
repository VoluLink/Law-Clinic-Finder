import { cache } from 'react';

import { readClinic } from '@/lib/firebase/clinic-repository';

export const getClinic = cache(readClinic);
