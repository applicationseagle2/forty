'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/' })} className="btn-ghost text-sm">
      Sign out
    </button>
  );
}
