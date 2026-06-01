import { requireAdmin, canManageStake } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { formatDate, endDate } from '@/lib/dates';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

// Aggregate stats only — no PII for stake-level
export default async function StakeReportPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageStake(user, params.id))) redirect('/admin');

  const stake = await prisma.stake.findUnique({
    where: { id: params.id },
    include: {
      wards: {
        include: {
          fasts: {
            include: {
              signups: { include: { participants: true } },
              _count: { select: { signups: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!stake) notFound();

  // Aggregate everything
  const allFasts = stake.wards.flatMap((w) => w.fasts);
  const active = allFasts.filter((f) => f.status === 'ACTIVE').length;
  const completed = allFasts.filter((f) => f.status === 'COMPLETED').length;
  const totalParticipants = allFasts.reduce(
    (acc, f) => acc + f.signups.reduce((a, s) => a + s.participants.length, 0),
    0
  );

  // Experience aggregate (just counts and themes summary)
  const approvedExperiences = await prisma.experience.findMany({
    where: {
      signup: { fast: { wardId: { in: stake.wards.map((w) => w.id) } } },
      moderationStatus: 'APPROVED',
    },
    include: { signup: { include: { fast: { include: { ward: true } } } } },
  });

  return (
    <div className="space-y-10">
      <div className="print:hidden">
        <Link href={`/admin/stakes/${stake.id}`} className="btn-ghost text-sm mb-4">← {stake.name}</Link>
        <p className="display-eyebrow mb-3">Stake report</p>
        <h1 className="display-h2">Aggregate activity.</h1>
        <div className="mt-2 flex items-center gap-3">
          <p className="text-ink-700">Use your browser's Print → Save as PDF to export.</p>
          <PrintButton />
        </div>
      </div>

      <div className="bg-white p-12 max-w-4xl mx-auto print:p-0 print:max-w-none">
        <header className="pb-8 mb-8 border-b-2 border-ink-900">
          <p className="display-eyebrow mb-2">{stake.name}</p>
          <h1 className="font-display text-4xl tracking-tightest font-light">40-Day Fast — Stake Report</h1>
          <p className="text-ink-500 mt-2">Generated {formatDate(new Date(), 'MMMM d, yyyy')}</p>
        </header>

        <section className="mb-10">
          <h2 className="font-display text-2xl tracking-tightest mb-4">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Wards" value={stake.wards.length} />
            <Stat label="Active fasts" value={active} />
            <Stat label="Completed fasts" value={completed} />
            <Stat label="Participants total" value={totalParticipants} />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-2xl tracking-tightest mb-4">By ward</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left">
                <th className="py-2">Ward</th>
                <th className="py-2 text-right">Fasts</th>
                <th className="py-2 text-right">Days claimed</th>
                <th className="py-2 text-right">Participants</th>
              </tr>
            </thead>
            <tbody>
              {stake.wards.map((w) => {
                const claimedDays = w.fasts.reduce(
                  (acc, f) => acc + new Set(f.signups.filter((s) => s.isPrimary).map((s) => s.dayNumber)).size,
                  0
                );
                const totalDays = w.fasts.length * 40;
                const participants = w.fasts.reduce(
                  (acc, f) => acc + f.signups.reduce((a, s) => a + s.participants.length, 0),
                  0
                );
                return (
                  <tr key={w.id} className="border-b border-parchment-200">
                    <td className="py-2">{w.name}</td>
                    <td className="py-2 text-right">{w.fasts.length}</td>
                    <td className="py-2 text-right">
                      {claimedDays}/{totalDays || '—'}{' '}
                      {totalDays > 0 && (
                        <span className="text-ink-500">
                          ({Math.round((claimedDays / totalDays) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">{participants}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-2xl tracking-tightest mb-4">By fast</h2>
          <div className="space-y-3">
            {allFasts.map((f) => {
              const w = stake.wards.find((w) => w.id === f.wardId)!;
              const claimedDays = new Set(f.signups.filter((s) => s.isPrimary).map((s) => s.dayNumber)).size;
              const participants = f.signups.reduce((a, s) => a + s.participants.length, 0);
              return (
                <div key={f.id} className="border-l-2 border-sage-500 pl-4">
                  <p className="font-medium">{f.name} <span className="text-ink-500">— {w.name}</span></p>
                  <p className="text-sm text-ink-700">
                    {formatDate(f.startDate, 'MMM d')} – {formatDate(endDate(f.startDate), 'MMM d, yyyy')} ·{' '}
                    <span className="uppercase tracking-wider text-xs">{f.status}</span>
                  </p>
                  <p className="text-sm text-ink-500 mt-1">{claimedDays}/40 days claimed · {participants} participants</p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl tracking-tightest mb-4">Reflections shared</h2>
          <p className="text-ink-700 mb-4">
            <strong>{approvedExperiences.length}</strong> approved reflection{approvedExperiences.length === 1 ? '' : 's'}
            {' '}from participants across the stake.
          </p>
          {approvedExperiences.length > 0 && (
            <div className="space-y-3">
              {approvedExperiences.slice(0, 12).map((e) => (
                <blockquote key={e.id} className="border-l-2 border-parchment-300 pl-4 italic text-ink-700">
                  "{e.content.length > 280 ? e.content.slice(0, 280) + '...' : e.content}"
                  <footer className="text-xs text-ink-500 not-italic mt-1">— {e.signup.fast.ward.name}</footer>
                </blockquote>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 pt-6 border-t border-parchment-200 text-xs text-ink-500">
          Confidential. Personal contact information is held only at the Ward Admin level.
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-parchment-200 p-4">
      <p className="display-eyebrow mb-1">{label}</p>
      <p className="font-display text-3xl tracking-tightest">{value}</p>
    </div>
  );
}

import { PrintButton } from '@/components/PrintButton';
