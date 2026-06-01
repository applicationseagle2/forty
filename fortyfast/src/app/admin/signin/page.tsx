'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await signIn('email', { email, callbackUrl: '/admin' });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-xl tracking-tightest block mb-12">Forty</Link>
        <p className="display-eyebrow mb-4">Admin sign in</p>
        <h1 className="display-h2 mb-8">Welcome back.</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Sending link...' : 'Send sign-in link'}
          </button>
          <p className="text-sm text-ink-500 leading-relaxed pt-4">
            We'll send a one-time link to your email. Only invited admins can sign in.
          </p>
        </form>
      </div>
    </main>
  );
}
