import type { Metadata } from 'next';

import { Footer } from '@/components/layout/Footer';
import { Wordmark } from '@/components/layout/Wordmark';

import { SignupFlow } from './SignupFlow';

export const metadata: Metadata = { title: 'Law Clinic anmelden – Law Clinic Finder' };

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-12">
        <Wordmark className="self-center" />
        <SignupFlow />
      </main>
      <Footer />
    </div>
  );
}
