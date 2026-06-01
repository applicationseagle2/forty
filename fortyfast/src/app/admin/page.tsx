import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminHome() {
  const user = await requireAdmin();

  // Scope what the user sees by role
  const stakes = user.role === 'SUPER_ADMIN'
    ? await prisma.stake.findMany({
        include: { _count: { select: { wards: true } } },
        orderBy: { name: 'asc' },
      })
    : user.stakeId
      ? await prisma.stake.findMany({
          where: { id: user.stakeId },
          include: { _count: { select: { wards: true } } },
        })
      : [];

  const wards = user.role === 'WARD_ADMIN' && user.wardId
    ? await prisma.ward.findMany({
        where: { id: user.wardId },
        include: { _count: { select: { fasts: true } }, stake: true },
      })
    : user.role === 'STAKE_ADMIN' && user.stakeId
      ? await prisma.ward.findMany({
          where: { stakeId: user.stakeId },
          include: { _count: { select: { fasts: true } }, stake: true },
          orderBy: { name: 'asc' },
        })
      : [];

  return (
    <div className="space-y-12">
      <div>
        <p className="display-eyebrow mb-3">Dashboard</p>
        <h1 className="display-h2">Welcome, {user.name.split(' ')[0]}.</h1>
      </div>

      {user.role === 'SUPER_ADMIN' && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-2xl tracking-tightest">Stakes</h2>
            <Link href="/admin/stakes/new" className="btn-secondary text-sm">+ New stake</Link>
          </div>
          {stakes.length === 0 ? (
            <EmptyState
              title="No stakes yet."
              body="Create your first stake to begin. Stakes contain wards, and each ward runs its own fasts."
              cta={{ href: '/admin/stakes/new', label: 'Create a stake' }}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stakes.map((s) => (
                <Link key={s.id} href={`/admin/stakes/${s.id}`} className="card p-6 hover:border-sage-500 transition-colors">
                  <p className="display-eyebrow mb-2">Stake</p>
                  <h3 className="font-display text-2xl tracking-tightest mb-1">{s.name}</h3>
                  <p className="text-sm text-ink-500">{s._count.wards} ward{s._count.wards === 1 ? '' : 's'}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {(user.role === 'STAKE_ADMIN' || user.role === 'WARD_ADMIN') && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-2xl tracking-tightest">Wards</h2>
            {user.role === 'STAKE_ADMIN' && (
              <Link href="/admin/wards/new" className="btn-secondary text-sm">+ New ward</Link>
            )}
          </div>
          {wards.length === 0 ? (
            <EmptyState
              title="No wards yet."
              body={user.role === 'STAKE_ADMIN' ? 'Create your first ward to begin.' : 'Your account is not yet attached to a ward. Ask your Stake Admin.'}
              cta={user.role === 'STAKE_ADMIN' ? { href: '/admin/wards/new', label: 'Create a ward' } : undefined}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wards.map((w) => (
                <Link key={w.id} href={`/admin/wards/${w.id}`} className="card p-6 hover:border-sage-500 transition-colors">
                  <p className="display-eyebrow mb-2">{w.stake.name}</p>
                  <h3 className="font-display text-2xl tracking-tightest mb-1">{w.name}</h3>
                  <p className="text-sm text-ink-500">{w._count.fasts} fast{w._count.fasts === 1 ? '' : 's'} · {w.timezone}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card p-12 text-center">
      <h3 className="font-display text-xl tracking-tightest mb-2">{title}</h3>
      <p className="text-ink-500 max-w-md mx-auto mb-6">{body}</p>
      {cta && <Link href={cta.href} className="btn-primary">{cta.label}</Link>}
    </div>
  );
}
