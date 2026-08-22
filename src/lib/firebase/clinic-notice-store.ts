import { z } from 'zod';

import { firebaseFirestore } from './admin';

type NoticeField = 'submissionNotifiedAt' | 'publishNotifiedAt';

/**
 * Compensating write: the mark was claimed inside the write transaction, so a
 * failed or undeliverable notice must release it again. Otherwise a transient
 * SMTP outage would silence the notice permanently.
 */
export async function releaseClinicNotice(clinicId: string, field: NoticeField): Promise<void> {
  const id = z.string().uuid().parse(clinicId);
  await firebaseFirestore()
    .collection('clinics')
    .doc(id)
    .update({ [field]: null });
}
