/**
 * Decides which transactional notice a clinic write owes, so both the member
 * save path and the two admin publish paths answer the question identically.
 *
 * Both marks are stored on the clinic document and claimed inside the same
 * transaction as the write itself, which is what keeps a concurrent retry from
 * sending twice. A failed send clears its mark again so the notice is not lost.
 */
export type ClinicNotificationMarks = {
  submissionNotifiedAt: Date | null;
  publishNotifiedAt: Date | null;
};

/**
 * The admin is told once per unpublished cycle: the first save of an entry that
 * is not published. Publishing clears the mark, so an entry that is withdrawn
 * and reworked is announced again.
 */
export function owesSubmissionNotice(
  clinic: { isPublished: boolean } & Pick<ClinicNotificationMarks, 'submissionNotifiedAt'>,
): boolean {
  return !clinic.isPublished && clinic.submissionNotifiedAt === null;
}

/** The clinic is told about its very first publication only, ever. */
export function owesPublicationNotice(input: {
  wasPublished: boolean;
  willBePublished: boolean;
  publishNotifiedAt: Date | null;
}): boolean {
  return !input.wasPublished && input.willBePublished && input.publishNotifiedAt === null;
}
