import { requireAdmin, canManageFast } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { dateForDayNumber, endDate, formatDate } from '@/lib/dates';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function activateFast(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const fastId = formData.get('fastId') as string;
  if (!(await canManageFast(user, fastId))) throw new Error('Forbidden');
  await prisma.fast.update({ where: { id: fastId }, data: { status: 'ACTIVE' } });
  revalidatePath(`/admin/fasts/${fastId}`);
}

export default async function FastDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageFast(user, params.id))) redirect('/admin');

  const fast = await prisma.fast.findUnique({
    where: { id: params.id },
    include: {
      ward: { include: { stake: true } },
      signups: { include: { participants: true } },
      broadcastReminders: { orderBy: { daysOffset: 'asc' } },
      individualReminders: { orderBy: { daysOffset: 'asc' } },
      experienceFollowUps: { orderBy: { daysOffset: 'asc' } },
    },
  });
  if (!fast) notFound();

  const ends = endDate(fast.startDate);
  const claimedDays = new Set(fast.signups.filter((s) => s.isPrimary).map((s) => s.dayNumber));
  const allParticipants = fast.signups.flatMap((s) => s.participants);
  const totalSignups = fast.signups.length;
  const primarySignups = fast.signups.filter((s) => s.isPrimary).length;

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const publicUrl = `${baseUrl}/f/${fast.publicSlug}?c=${fast.accessCode}`;

  return (
    <div className="space-y-12">
      <div>
        <Link href={`/admin/wards/${fast.wardId}`} className="btn-ghost text-sm mb-4">← {fast.ward.name}</Link>
        <p className="display-eyebrow mb-3">{fast.status}</p>
        <h1 className="display-h2 mb-3">{fast.name}</h1>
        <p className="text-ink-700 max-w-3xl">{fast.purpose}</p>
        <p className="text-sm text-ink-500 mt-3">
          {formatDate(fast.startDate, 'EEE, MMM d, yyyy')} → {formatDate(ends, 'EEE, MMM d, yyyy')}
        </p>
      </div>

      {/* Share link */}
      <section className="card p-6">
        <p className="display-eyebrow mb-2">Public signup link</p>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <code className="flex-1 text-sm bg-parchment-100 p-3 rounded-sm overflow-x-auto whitespace-nowrap">{publicUrl}</code>
          <CopyButton text={publicUrl} />
        </div>
        <p className="text-xs text-ink-500 mt-3">
          Share via email or SMS. The access code prevents search engines from finding it.
        </p>
      </section>

      {/* Status */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Day status" value={`${primarySignups}/40`} />
          <Stat label="Total signups" value={String(totalSignups)} />
          <Stat label="Participants" value={String(allParticipants.length)} />
          <Stat label="Days open" value={String(40 - primarySignups)} />
        </div>
        {fast.status === 'DRAFT' && (
          <form action={activateFast} className="mt-6">
            <input type="hidden" name="fastId" value={fast.id} />
            <button type="submit" className="btn-primary">Activate fast (open for signups)</button>
            <p className="text-xs text-ink-500 mt-2">Once activated, the public link begins accepting signups and scheduled reminders begin firing.</p>
          </form>
        )}
      </section>

      {/* Calendar */}
      <section>
        <h2 className="font-display text-2xl tracking-tightest mb-4">The 40 days</h2>
        <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
          {Array.from({ length: 40 }, (_, i) => {
            const day = i + 1;
            const claimed = claimedDays.has(day);
            const date = dateForDayNumber(fast.startDate, day);
            return (
              <div key={day} className={`aspect-square p-2 border rounded-sm text-center flex flex-col justify-center ${claimed ? 'bg-sage-50 border-sage-500 text-sage-900' : 'bg-white border-parchment-200 text-ink-500'}`}>
                <p className="text-xs">Day {day}</p>
                <p className="text-sm font-medium">{formatDate(date, 'M/d')}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sub-management links */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ManagementCard href={`/admin/fasts/${fast.id}/signups`} title="Signups & participants" subtitle={`${totalSignups} signup${totalSignups === 1 ? '' : 's'}`} />
        <ManagementCard href={`/admin/fasts/${fast.id}/reminders`} title="Reminders & broadcasts" subtitle={`${fast.broadcastReminders.length + fast.individualReminders.length + fast.experienceFollowUps.length} scheduled`} />
        <ManagementCard href={`/admin/fasts/${fast.id}/experiences`} title="Experiences" subtitle="Moderate & share" />
        <ManagementCard href={`/admin/fasts/${fast.id}/settings`} title="Settings" subtitle="Purpose, dates, status" />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="display-eyebrow mb-2">{label}</p>
      <p className="font-display text-4xl tracking-tightest">{value}</p>
    </div>
  );
}

function ManagementCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="card p-5 hover:border-sage-500 transition-colors">
      <h3 className="font-display text-lg tracking-tightest mb-1">{title}</h3>
      <p className="text-sm text-ink-500">{subtitle}</p>
    </Link>
  );
}

// Client-side copy button kept inline for simplicity
import { CopyButton } from '@/components/CopyButton';
