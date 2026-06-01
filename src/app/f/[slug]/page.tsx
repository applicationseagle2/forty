import { prisma } from '@/lib/prisma';
import { dateForDayNumber, endDate, formatInWardTz, formatDate } from '@/lib/dates';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PublicFastPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { c?: string };
}) {
  const fast = await prisma.fast.findUnique({
    where: { publicSlug: params.slug },
    include: {
      ward: { include: { stake: true } },
      signups: { include: { participants: true } },
    },
  });
  if (!fast) notFound();
  if (searchParams.c !== fast.accessCode) return <AccessGate />;
  if (fast.status === 'DRAFT' || fast.status === 'ARCHIVED') return <NotOpenYet status={fast.status} />;

  const ends = endDate(fast.startDate);

  // Build the calendar: for each day, who's signed up (primary + stackers)?
  const byDay = new Map<number, { primary: typeof fast.signups[0] | null; stackers: typeof fast.signups }>();
  for (let d = 1; d <= 40; d++) byDay.set(d, { primary: null, stackers: [] });
  for (const s of fast.signups) {
    const slot = byDay.get(s.dayNumber)!;
    if (s.isPrimary && !slot.primary) slot.primary = s;
    else slot.stackers.push(s);
  }

  const claimedCount = Array.from(byDay.values()).filter((s) => s.primary).length;
  const allClaimed = claimedCount === 40;

  // Approved public experiences
  const experiences = await prisma.experience.findMany({
    where: {
      signup: { fastId: fast.id },
      moderationStatus: 'APPROVED',
      isPublic: true,
    },
    include: { signup: { include: { participants: { take: 1 } } } },
    orderBy: { approvedAt: 'desc' },
    take: 8,
  });

  return (
    <main className="min-h-screen">
      <header className="px-6 md:px-12 py-6 border-b border-parchment-200">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <p className="font-display text-lg tracking-tightest">{fast.ward.name}</p>
          <p className="text-xs text-ink-500 uppercase tracking-widest">40-Day Fast</p>
        </div>
      </header>

      <section className="px-6 md:px-12 py-16 md:py-24 max-w-5xl mx-auto">
        <p className="display-eyebrow mb-6">
          {formatDate(fast.startDate, 'MMM d')} – {formatDate(ends, 'MMM d, yyyy')}
        </p>
        <h1 className="display-h1 mb-10">{fast.name}</h1>
        <div className="max-w-2xl text-lg text-ink-700 leading-relaxed whitespace-pre-line">
          {fast.purpose}
        </div>
        {fast.landingMessage && (
          <div className="mt-6 max-w-2xl text-ink-700 leading-relaxed whitespace-pre-line italic border-l-2 border-sage-500 pl-4">
            {fast.landingMessage}
          </div>
        )}
      </section>

      <section className="px-6 md:px-12 py-12 max-w-5xl mx-auto">
        <h2 className="font-display text-3xl tracking-tightest mb-2">Choose a day.</h2>
        <p className="text-ink-700 mb-8">
          {allClaimed
            ? 'Every day has a primary family. You can join an existing day to fast alongside another.'
            : 'Pick any open day to commit your family to 24 hours of fasting.'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2">
          {Array.from({ length: 40 }, (_, i) => {
            const day = i + 1;
            const date = dateForDayNumber(fast.startDate, day);
            const slot = byDay.get(day)!;
            const claimed = !!slot.primary;
            const stackerCount = slot.stackers.length;
            const showStack = claimed && fast.allowStacking;

            return (
              <Link
                key={day}
                href={`/f/${fast.publicSlug}/signup/${day}?c=${fast.accessCode}`}
                className={`group aspect-square p-3 border rounded-sm flex flex-col justify-between transition-colors ${
                  claimed
                    ? 'bg-sage-50 border-sage-500 hover:bg-sage-200'
                    : 'bg-white border-parchment-200 hover:border-sage-500 hover:bg-parchment-50'
                }`}
              >
                <div className="text-left">
                  <p className="text-xs text-ink-500">Day {day}</p>
                  <p className="text-sm font-medium">{formatInWardTz(date, fast.ward.timezone, 'EEE M/d')}</p>
                </div>
                <div className="text-right">
                  {claimed ? (
                    <p className="text-xs text-sage-900">
                      Claimed{stackerCount > 0 && ` +${stackerCount}`}
                      {showStack && <span className="block text-ink-500 group-hover:text-sage-700">Join →</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-500 group-hover:text-sage-700">Open →</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {experiences.length > 0 && (
        <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto border-t border-parchment-200">
          <h2 className="font-display text-3xl tracking-tightest mb-2">From those who have fasted.</h2>
          <p className="text-ink-700 mb-10">Reflections shared by participants.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {experiences.map((e) => (
              <article key={e.id} className="card p-6">
                <p className="text-ink-700 leading-relaxed italic whitespace-pre-line">"{e.content}"</p>
                <p className="text-sm text-ink-500 mt-4">
                  — {e.isAnonymous ? 'A participant' : (e.participantName || e.signup.participants[0]?.name || 'A participant')}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="px-6 md:px-12 py-8 border-t border-parchment-200 text-xs text-ink-500">
        <div className="max-w-5xl mx-auto">{fast.ward.stake.name} · {fast.ward.name}</div>
      </footer>
    </main>
  );
}

function AccessGate() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="display-eyebrow mb-4">Access required</p>
        <h1 className="display-h2 mb-4">This page needs an access code.</h1>
        <p className="text-ink-700">Make sure you used the full link your ward shared.</p>
      </div>
    </main>
  );
}

function NotOpenYet({ status }: { status: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="display-eyebrow mb-4">{status}</p>
        <h1 className="display-h2">This fast isn't open for signups.</h1>
      </div>
    </main>
  );
}
