import { prisma } from '@/lib/prisma';
import { dateForDayNumber, formatInWardTz } from '@/lib/dates';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function addExperience(formData: FormData) {
  'use server';
  const token = formData.get('token') as string;
  const content = (formData.get('content') as string)?.trim();
  const isAnonymous = formData.get('isAnonymous') === 'on';
  const isPublic = formData.get('isPublic') === 'on';
  const participantName = (formData.get('participantName') as string)?.trim() || null;

  if (!content) return;

  const signup = await prisma.signup.findUnique({
    where: { magicToken: token },
    include: { participants: true },
  });
  if (!signup) return;

  await prisma.experience.create({
    data: {
      signupId: signup.id,
      content,
      isAnonymous,
      isPublic,
      participantName: participantName || signup.participants[0]?.name,
      source: 'MAGIC_LINK',
    },
  });

  revalidatePath(`/m/${token}`);
}

export default async function MagicLinkPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { welcome?: string };
}) {
  const signup = await prisma.signup.findUnique({
    where: { magicToken: params.token },
    include: {
      fast: { include: { ward: true } },
      participants: true,
      experiences: { orderBy: { submittedAt: 'desc' } },
    },
  });
  if (!signup) notFound();

  const date = dateForDayNumber(signup.fast.startDate, signup.dayNumber);

  return (
    <main className="min-h-screen">
      <header className="px-6 md:px-12 py-6 border-b border-parchment-200">
        <div className="max-w-3xl mx-auto">
          <p className="font-display text-lg tracking-tightest">{signup.fast.name}</p>
          <p className="text-sm text-ink-500">{signup.fast.ward.name}</p>
        </div>
      </header>

      <section className="px-6 md:px-12 py-12 max-w-3xl mx-auto">
        {searchParams.welcome === '1' && (
          <div className="card bg-sage-50 border-sage-500 p-5 mb-8">
            <p className="font-display text-lg tracking-tightest mb-1">Thank you for committing this day.</p>
            <p className="text-sm text-ink-700">
              Bookmark this page — it's your private link. We've also sent it to you by {signup.participants.some((p) => p.email && p.emailOptIn) ? 'email' : 'message'}.
            </p>
          </div>
        )}

        <p className="display-eyebrow mb-4">Day {signup.dayNumber} {signup.isPrimary ? '· Primary' : '· Joining'}</p>
        <h1 className="display-h2 mb-3">{formatInWardTz(date, signup.fast.ward.timezone, 'EEEE, MMMM d, yyyy')}</h1>
        <p className="text-ink-700 leading-relaxed">{signup.fast.purpose}</p>
      </section>

      <section className="px-6 md:px-12 py-8 max-w-3xl mx-auto">
        <h2 className="font-display text-2xl tracking-tightest mb-4">Your family on this day</h2>
        <div className="card divide-y divide-parchment-200">
          {signup.participants.map((p) => (
            <div key={p.id} className="p-4">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-ink-500">
                {p.email || '—'} · {p.phone || '—'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-12 max-w-3xl mx-auto border-t border-parchment-200">
        <h2 className="font-display text-2xl tracking-tightest mb-2">Share your experience</h2>
        <p className="text-ink-700 mb-6">
          What did you notice during the fast? Your reflection may quietly strengthen others who fast after you.
        </p>

        <form action={addExperience} className="card p-6 space-y-4">
          <input type="hidden" name="token" value={params.token} />
          <div>
            <label className="label">Posting as</label>
            <input
              name="participantName"
              className="input"
              defaultValue={signup.participants[0]?.name || ''}
              placeholder="Your name (or leave blank to use family name)"
            />
          </div>
          <div>
            <label className="label">Your reflection</label>
            <textarea name="content" required rows={6} className="input" placeholder="Whatever you'd like to share..." />
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isAnonymous" />
              Share anonymously (your name will be hidden, but the ward will know it's from you)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isPublic" defaultChecked />
              Allow this to appear on the public signup page (after admin approval)
            </label>
          </div>
          <button type="submit" className="btn-primary">Submit reflection</button>
          <p className="text-xs text-ink-500">All submissions are reviewed before being shared.</p>
        </form>

        {signup.experiences.length > 0 && (
          <div className="mt-10">
            <h3 className="font-display text-lg tracking-tightest mb-4">Your previous reflections</h3>
            <div className="space-y-3">
              {signup.experiences.map((e) => (
                <div key={e.id} className="card p-5">
                  <p className="text-ink-700 italic whitespace-pre-line">"{e.content}"</p>
                  <p className="text-xs text-ink-500 mt-3">
                    Status: <span className="uppercase tracking-wider">{e.moderationStatus}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
