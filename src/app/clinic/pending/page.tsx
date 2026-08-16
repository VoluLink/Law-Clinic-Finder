import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Panel } from '@/components/ui/Panel';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Freigabe ausstehend – Law Clinic Finder' };

/**
 * The only gated page a pending claimant can reach. Verifying the address
 * proved they read that inbox, not that the clinic is theirs — an admin decides
 * that, and until then there is nothing here to edit.
 */
export default async function ClinicPendingPage() {
  const supabase = await createSupabaseServerClient();
  try {
    const profile = await requireRole(supabase, ['clinic', 'admin']);
    if (profile.access_status === 'active') redirect('/clinic');
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : '';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section>
        <div className="text-[13px] font-bold tracking-[0.14em] text-muted-soft uppercase">
          Freigabe ausstehend
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">
          Deine E-Mail-Adresse ist bestätigt
        </h1>
        {email && <p className="mt-2 text-base text-muted">Angemeldet als {email}.</p>}
      </section>
      <Panel>
        <p className="text-base text-foreground">
          Ein Admin prüft gerade, ob dein Zugang zu dieser Law Clinic gehört. Solange diese Prüfung
          läuft, kannst du deinen Eintrag noch nicht bearbeiten und er ist im Verzeichnis nicht
          sichtbar.
        </p>
        <p className="mt-4 text-base text-muted">
          Sobald die Freigabe erfolgt ist, kommst du mit demselben Anmeldelink direkt in deinen
          Mitgliederbereich. Du musst dich dafür nicht erneut registrieren.
        </p>
      </Panel>
    </div>
  );
}
