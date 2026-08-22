export type RevokeAccessOptions = {
  unpublish: boolean;
  clearContactEmail: boolean;
};

export type ClinicAccessStore = {
  revoke: (clinicId: string, options: RevokeAccessOptions) => Promise<void>;
};

export async function revokeClinicAccess(
  store: ClinicAccessStore,
  clinicId: string,
  options: RevokeAccessOptions,
): Promise<void> {
  await store.revoke(clinicId, options);
}
