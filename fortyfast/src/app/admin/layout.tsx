import { requireAdmin } from '@/lib/authz';
import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-parchment-200 bg-parchment-50/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/admin" className="font-display text-xl tracking-tightest">Forty</Link>
          <nav className="flex items-center gap-2 text-sm">
            <span className="text-ink-500 hidden md:inline">
              {user.name} · <span className="uppercase tracking-wider text-xs">{user.role.replace('_', ' ')}</span>
            </span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
