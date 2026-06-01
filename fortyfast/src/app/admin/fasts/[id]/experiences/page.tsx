import { requireAdmin, canManageFast } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { dateForDayNumber, formatInWardTz } from '@/lib/dates';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function moderate(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const experienceId = formData.get('experienceId') as string;
  const fastId = formData.get('fastId') as string;
  const action = formData.get('action') as 'approve' | 'reject' | 'togglePublic';
  if (!(await canManageFast(user, fastId))) throw new Error('Forbidden');

  if (action === 'approve') {
    await prisma.experience.update({
      where: { id: experienceId },
      data: {
        moderationStatus: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });
  } else if (action === 'reject') {
    await prisma.experience.update({
      where: { id: experienceId },
      data: { moderationStatus: 'REJECTED' },
    });
  } else if (action === 'togglePublic') {
    const e = await prisma.experience.findUnique({ where: { id: experienceId } });
    if (e) {
      await prisma.experience.update({
        where: { id: experienceId },
        data: { isPublic: !e.isPublic },
      });
    }
  }
  revalidatePath(`/admin/fasts/${fastId}/experiences`);
}

export default async function ExperiencesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const user = await requireAdmin();
  if (!(await canManageFast(user, params.id))) redirect('/admin');

  const filter = searchParams.filter ?? 'pending';
  const fast = await prisma.fast.findUnique({
    where: { id: params.id },
    include: { ward: true },
  });
  if (!fast) notFound();

  const where: any = { signup: { fastId: fast.id } };
  if (filter === 'pending') where.moderationStatus = 'PENDING';
  else if (filter === 'approved') where.moderationStatus = 'APPROVED';
  else if (filter === 'rejected') where.moderationStatus = 'REJECTED';

  const experiences = await prisma.experience.findMany({
    where,
    include: { signup: { include: { participants: true } } },
    orderBy: { submittedAt: 'desc' },
  });

  const counts = {
    pending: await prisma.experience.count({ where: { signup: { fastId: fast.id }, moderationStatus: 'PENDING' } }),
    approved: await prisma.experience.count({ where: { signup: { fastId: fast.id }, moderationStatus: 'APPROVED' } }),
    rejected: await prisma.experience.count({ where: { signup: { fastId: fast.id }, moderationStatus: 'REJECTED' } }),
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/admin/fasts/${fast.id}`} className="btn-ghost text-sm mb-4">← {fast.name}</Link>
        <p className="display-eyebrow mb-3">Experiences</p>
        <h1 className="display-h2">Moderation queue.</h1>
      </div>

      <div className="flex gap-2 text-sm">
        <FilterTab href={`/admin/fasts/${fast.id}/experiences?filter=pending`} active={filter === 'pending'} label={`Pending (${counts.pending})`} />
        <FilterTab href={`/admin/fasts/${fast.id}/experiences?filter=approved`} active={filter === 'approved'} label={`Approved (${counts.approved})`} />
        <FilterTab href={`/admin/fasts/${fast.id}/experiences?filter=rejected`} active={filter === 'rejected'} label={`Rejected (${counts.rejected})`} />
      </div>

      {experiences.length === 0 ? (
        <div className="card p-12 text-center text-ink-500">Nothing here.</div>
      ) : (
        <div className="space-y-4">
          {experiences.map((e) => {
            const date = dateForDayNumber(fast.startDate, e.signup.dayNumber);
            const realName = e.signup.participants.map((p) => p.name).join(', ');
            return (
              <div key={e.id} className="card p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="display-eyebrow mb-1">Day {e.signup.dayNumber} · {formatInWardTz(date, fast.ward.timezone, 'MMM d')}</p>
                    <p className="text-sm text-ink-700">
                      <strong>From:</strong> {realName}
                      {e.isAnonymous && <span className="ml-2 text-ember-700">(submitted anonymously for public view)</span>}
                    </p>
                    <p className="text-xs text-ink-500">Submitted {new Date(e.submittedAt).toLocaleString()} via {e.source.toLowerCase().replace('_', ' ')}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-sage-700">{e.moderationStatus}</span>
                </div>

                <p className="text-ink-900 leading-relaxed whitespace-pre-wrap mb-4 italic">"{e.content}"</p>

                <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-parchment-200">
                  {e.moderationStatus === 'PENDING' && (
                    <>
                      <form action={moderate} className="inline">
                        <input type="hidden" name="experienceId" value={e.id} />
                        <input type="hidden" name="fastId" value={fast.id} />
                        <input type="hidden" name="action" value="approve" />
                        <button type="submit" className="btn-primary text-sm">Approve</button>
                      </form>
                      <form action={moderate} className="inline">
                        <input type="hidden" name="experienceId" value={e.id} />
                        <input type="hidden" name="fastId" value={fast.id} />
                        <input type="hidden" name="action" value="reject" />
                        <button type="submit" className="btn-secondary text-sm">Reject</button>
                      </form>
                    </>
                  )}
                  {e.moderationStatus === 'APPROVED' && (
                    <form action={moderate} className="inline">
                      <input type="hidden" name="experienceId" value={e.id} />
                      <input type="hidden" name="fastId" value={fast.id} />
                      <input type="hidden" name="action" value="togglePublic" />
                      <button type="submit" className="btn-secondary text-sm">
                        {e.isPublic ? '🌐 Public — make private' : '🔒 Private — make public'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-sm transition-colors ${active ? 'bg-sage-700 text-parchment-50' : 'text-ink-700 hover:bg-parchment-100'}`}
    >
      {label}
    </Link>
  );
}
