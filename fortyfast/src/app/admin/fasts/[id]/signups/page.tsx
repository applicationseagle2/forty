import { requireAdmin, canManageFast } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { dateForDayNumber, formatInWardTz } from '@/lib/dates';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function SignupsPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageFast(user, params.id))) redirect('/admin');

  const fast = await prisma.fast.findUnique({
    where: { id: params.id },
    include: {
      ward: true,
      signups: {
        include: { participants: true, _count: { select: { experiences: true } } },
        orderBy: { dayNumber: 'asc' },
      },
    },
  });
  if (!fast) notFound();

  // Group by day for clarity
  const byDay = new Map<number, typeof fast.signups>();
  for (const s of fast.signups) {
    const arr = byDay.get(s.dayNumber) ?? [];
    arr.push(s);
    byDay.set(s.dayNumber, arr);
  }

  const allParticipants = fast.signups.flatMap((s) => s.participants);
  const emailable = allParticipants.filter((p) => p.email && p.emailOptIn).length;
  const smsable = allParticipants.filter((p) => p.phone && p.smsOptIn).length;

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/admin/fasts/${fast.id}`} className="btn-ghost text-sm mb-4">← {fast.name}</Link>
        <p className="display-eyebrow mb-3">Signups</p>
        <h1 className="display-h2 mb-2">Who has committed.</h1>
        <p className="text-ink-500">
          {fast.signups.length} signup{fast.signups.length === 1 ? '' : 's'} · {allParticipants.length} participant{allParticipants.length === 1 ? '' : 's'} · {emailable} reachable by email · {smsable} reachable by SMS
        </p>
      </div>

      {fast.signups.length === 0 ? (
        <div className="card p-12 text-center text-ink-500">No signups yet.</div>
      ) : (
        <div className="space-y-4">
          {Array.from(byDay.entries()).map(([day, signups]) => {
            const date = dateForDayNumber(fast.startDate, day);
            return (
              <div key={day} className="card p-5">
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-parchment-200">
                  <div>
                    <p className="display-eyebrow">Day {day}</p>
                    <p className="font-display text-lg tracking-tightest">{formatInWardTz(date, fast.ward.timezone, 'EEEE, MMM d')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {signups.map((signup) => (
                    <div key={signup.id} className="pl-3 border-l-2 border-sage-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase tracking-wider text-sage-700">
                          {signup.isPrimary ? 'Primary' : 'Joining'}
                        </span>
                        {signup._count.experiences > 0 && (
                          <span className="text-xs text-ink-500">{signup._count.experiences} reflection{signup._count.experiences === 1 ? '' : 's'}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {signup.participants.map((p) => (
                          <div key={p.id} className="grid md:grid-cols-3 gap-2 text-sm">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-ink-700">
                              {p.email ? <span>{p.email} {p.emailOptIn ? '✓' : '✗'}</span> : <span className="text-ink-300">no email</span>}
                            </p>
                            <p className="text-ink-700">
                              {p.phone ? <span>{p.phone} {p.smsOptIn ? '✓' : '✗'}</span> : <span className="text-ink-300">no phone</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
