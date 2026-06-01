import { requireAdmin, canManageWard } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { formatDate, endDate } from '@/lib/dates';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function WardDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageWard(user, params.id))) redirect('/admin');

  const ward = await prisma.ward.findUnique({
    where: { id: params.id },
    include: {
      stake: true,
      fasts: {
        orderBy: { startDate: 'desc' },
        include: { _count: { select: { signups: true } } },
      },
      admins: true,
    },
  });
  if (!ward) notFound();

  const twilioConfigured = !!(ward.twilioAccountSid && ward.twilioAuthTokenEnc && ward.twilioFromNumber);

  return (
    <div className="space-y-12">
      <div>
        <Link href={`/admin/stakes/${ward.stakeId}`} className="btn-ghost text-sm mb-4">← {ward.stake.name}</Link>
        <p className="display-eyebrow mb-3">Ward</p>
        <h1 className="display-h2 mb-2">{ward.name}</h1>
        <p className="text-ink-500">{ward.timezone}</p>
      </div>

      <section className="grid md:grid-cols-2 gap-4">
        <Link href={`/admin/wards/${ward.id}/twilio`} className="card p-6 hover:border-sage-500 transition-colors">
          <p className="display-eyebrow mb-2">SMS</p>
          <h3 className="font-display text-xl tracking-tightest mb-1">
            Twilio {twilioConfigured ? '· Configured' : '· Not configured'}
          </h3>
          <p className="text-sm text-ink-500">
            {twilioConfigured ? `Sending from ${ward.twilioFromNumber}` : 'Set up SMS to send text reminders.'}
          </p>
        </Link>
        <Link href={`/admin/invites/new?ward=${ward.id}`} className="card p-6 hover:border-sage-500 transition-colors">
          <p className="display-eyebrow mb-2">Admins</p>
          <h3 className="font-display text-xl tracking-tightest mb-1">{ward.admins.length} admin{ward.admins.length === 1 ? '' : 's'}</h3>
          <p className="text-sm text-ink-500">Invite a new Ward Admin →</p>
        </Link>
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl tracking-tightest">Fasts</h2>
          <Link href={`/admin/fasts/new?ward=${ward.id}`} className="btn-primary text-sm">+ New 40-day fast</Link>
        </div>
        {ward.fasts.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="font-display text-xl mb-2">No fasts yet.</p>
            <p className="text-ink-500 mb-6">Begin by setting up your first 40-day fast.</p>
            <Link href={`/admin/fasts/new?ward=${ward.id}`} className="btn-primary">Start a fast</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ward.fasts.map((f) => {
              const ends = endDate(f.startDate);
              return (
                <Link key={f.id} href={`/admin/fasts/${f.id}`} className="card p-5 flex justify-between items-center hover:border-sage-500 transition-colors">
                  <div>
                    <p className="display-eyebrow mb-1">{f.status}</p>
                    <h3 className="font-display text-xl tracking-tightest">{f.name}</h3>
                    <p className="text-sm text-ink-500">{formatDate(f.startDate, 'MMM d')} – {formatDate(ends, 'MMM d, yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl tracking-tightest">{f._count.signups}/40</p>
                    <p className="text-xs text-ink-500">days claimed</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
