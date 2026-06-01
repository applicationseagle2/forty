import Link from 'next/link';

export default function VerifyRequestPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="font-display text-xl tracking-tightest block mb-12">Forty</Link>
        <p className="display-eyebrow mb-4">Check your email</p>
        <h1 className="display-h2 mb-6">A sign-in link is on the way.</h1>
        <p className="text-ink-700">
          Open the email and click the link to finish signing in. The link will expire in 24 hours.
        </p>
      </div>
    </main>
  );
}
