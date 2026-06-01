import { requireAdmin, canManageStake } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function StakeDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  const ok = await canManageStake(user, params.id);
  if (!ok) redirect('/admin');

  const stake = await prisma.stake.findUnique({
    where: { id: params.id },
    include: {
      wards: {
        include: { _count: { select: { fasts: true } } },
        orderBy: { name: 'asc' },
      },
      admins: { orderBy: { name: 'asc' } },
    },
  });
  if (!stake) notFound();

  // Aggregate stats — no PII for stake-level
  const fastIds = await prisma.fast.findMany({
    where: { wardId: { in: stake.wards.map((w) => w.id) } },
    select: { id: true, status: true },
  });
  const activeFasts = fastIds.filter((f) => f.status === 'ACTIVE').length;
  const completedFasts = fastIds.filter((f) => f.status === 'COMPLETED').length;
  const totalSignups = await prisma.signup.count({ where: { fastId: { in: fastIds.map((f) => f.id) } } });
  const totalParticipants = await prisma.participant.count({
    where: { signup: { fastId: { in: fastIds.map((f) => f.id) } } },
  });

  return (
    <div className="space-y-12">
      <div>
        <Link href="/admin" className="btn-ghost text-sm mb-4">← All stakes</Link>
        <p className="display-eyebrow mb-3">Stake</p>
        <h1 className="display-h2 mb-2">{stake.name}</h1>
        <p className="text-ink-500">{stake.wards.length} ward{stake.wards.length === 1 ? '' : 's'}</p>
      </div>

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="font-display text-2xl tracking-tightest">Activity at a glance</h2>
          <Link href={`/admin/stakes/${stake.id}/report`} className="btn-secondary text-sm">Generate report →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Active fasts" value={activeFasts} />
          <Stat label="Completed fasts" value={completedFasts} />
          <Stat label="Signups" value={totalSignups} />
          <Stat label="Participants" value={totalParticipants} />
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl tracking-tightest">Wards</h2>
          <Link href={`/admin/wards/new?stake=${stake.id}`} className="btn-secondary text-sm">+ New ward</Link>
        </div>
        {stake.wards.length === 0 ? (
          <div className="card p-12 text-center text-ink-500">No wards yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stake.wards.map((w) => (
              <Link key={w.id} href={`/admin/wards/${w.id}`} className="card p-6 hover:border-sage-500 transition-colors">
                <h3 className="font-display text-xl tracking-tightest mb-1">{w.name}</h3>
                <p className="text-sm text-ink-500">{w._count.fasts} fast{w._count.fasts === 1 ? '' : 's'} · {w.timezone}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl tracking-tightest">Admins</h2>
          <Link href={`/admin/invites/new?stake=${stake.id}`} className="btn-secondary text-sm">+ Invite admin</Link>
        </div>
        <div className="card divide-y divide-parchment-200">
          {stake.admins.map((a) => (
            <div key={a.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-ink-500">{a.email}</p>
              </div>
              <span className="text-xs uppercase tracking-wider text-sage-700">{a.role.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="display-eyebrow mb-2">{label}</p>
      <p className="font-display text-4xl tracking-tightest">{value}</p>
    </div>
  );
}
