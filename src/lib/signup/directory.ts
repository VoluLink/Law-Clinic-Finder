/**
 * What the public signup search exposes per clinic. Deliberately no address at
 * all, not even a masked one: an unauthenticated caller could otherwise walk the
 * directory and collect a recognisable fragment of every clinic's contact
 * address. Whether one is on file is enough to explain what will happen next.
 */
export type DirectoryMatch = {
  id: string;
  name: string;
  region: string | null;
  claimed: boolean;
  hasContactEmail: boolean;
};

/** The claim path additionally needs the masked address, but only to tell the
 *  person who just claimed which mailbox to open. */
export type ClaimMatch = DirectoryMatch & { maskedEmail: string | null };
