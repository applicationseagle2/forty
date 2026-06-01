import { prisma } from '@/lib/prisma';
import { dateForDayNumber, formatInWardTz } from '@/lib/dates';
import { newMagicToken } from '@/lib/tokens';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { SignupForm } from '@/components/SignupForm';

export const dynamic = 'force-dynamic';

async function submitSignup(formData: FormData): Promise<{ error?: string; redirectTo?: string }> {
  'use server';

  const fastId = formData.get('fastId') as string;
  const dayNumberRaw = formData.get('dayNumber') as string;
  const dayNumber = parseInt(dayNumberRaw, 10);

  if (!fastId || !dayNumber || dayNumber < 1 || dayNumber > 40) {
    return { error: 'Invalid request' };
  }

  const fast = await prisma.fast.findUnique({
    where: { id: fastId },
    include: { signups: true },
  });
  if (!fast || fast.status !== 'ACTIVE') return { error: 'Fast not open for signups' };

  const existingPrimary = fast.signups.find((s) => s.dayNumber === dayNumber && s.isPrimary);
  const isPrimary = !existingPrimary;

  if (!isPrimary && !fast.allowStacking) {
    return { error: 'This day is already claimed' };
  }

  // Parse participants from form
  const names = formData.getAll('name').map((v) => String(v).trim());
  const phones = formData.getAll('phone').map((v) => String(v).trim());
  const emails = formData.getAll('email').map((v) => String(v).trim());
  const smsOpts = formData.getAll('smsOptIn').map((v) => v === 'on');
  const emailOpts = formData.getAll('emailOptIn').map((v) => v === 'on');

  const participants = names
    .map((name, i) => ({
      name,
      phone: phones[i] || null,
      email: emails[i] || null,
      smsOptIn: smsOpts[i] ?? false,
      emailOptIn: emailOpts[i] ?? false,
    }))
    .filter((p) => p.name.length > 0);

  if (participants.length === 0) return { error: 'Please enter at least one participant' };

  const magicToken = newMagicToken();

  const signup = await prisma.signup.create({
    data: {
      fastId,
      dayNumber,
      isPrimary,
      magicToken,
      participants: { create: participants },
    },
  });

  // Send confirmations (fire-and-forget; failures don't block the signup)
  try {
    const { sendConfirmation } = await import('@/lib/comms');
    await sendConfirmation(signup.id);
  } catch (e) {
    console.error('Confirmation send failed', e);
  }

  return { redirectTo: `/m/${magicToken}?welcome=1` };
}

export default async function DaySignupPage({
  params,
  searchParams,
}: {
  params: { slug: string; day: string };
  searchParams: { c?: string };
}) {
  const dayNumber = parseInt(params.day, 10);
  if (!dayNumber || dayNumber < 1 || dayNumber > 40) notFound();

  const fast = await prisma.fast.findUnique({
    where: { publicSlug: params.slug },
    include: { ward: true, signups: { where: { dayNumber } } },
  });
  if (!fast) notFound();
  if (searchParams.c !== fast.accessCode) redirect(`/f/${params.slug}`);
  if (fast.status !== 'ACTIVE') redirect(`/f/${params.slug}?c=${fast.accessCode}`);

  const date = dateForDayNumber(fast.startDate, dayNumber);
  const existingPrimary = fast.signups.find((s) => s.isPrimary);
  const isStacking = !!existingPrimary;
  if (isStacking && !fast.allowStacking) {
    redirect(`/f/${params.slug}?c=${fast.accessCode}`);
  }

  return (
    <main className="min-h-screen">
      <header className="px-6 md:px-12 py-6 border-b border-parchment-200">
        <Link href={`/f/${params.slug}?c=${fast.accessCode}`} className="font-display text-lg tracking-tightest">
          ← Back to schedule
        </Link>
      </header>
      <section className="px-6 md:px-12 py-12 max-w-2xl mx-auto">
        <p className="display-eyebrow mb-4">Day {dayNumber} · {formatInWardTz(date, fast.ward.timezone, 'EEEE, MMMM d, yyyy')}</p>
        <h1 className="display-h2 mb-3">{isStacking ? 'Join this day' : 'Claim this day'}</h1>
        <p className="text-ink-700 mb-10">
          {isStacking
            ? 'Another family already has this day. You can join them in fasting on the same day.'
            : 'Enter the names of each family member fasting on this day. Phone and email are optional, used only to send reminders to each participant.'}
        </p>

        <SignupForm
          fastId={fast.id}
          dayNumber={dayNumber}
          isStacking={isStacking}
          action={submitSignup}
        />
      </section>
    </main>
  );
}
