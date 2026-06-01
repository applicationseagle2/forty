import { requireAdmin, canManageFast } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ReminderEditor } from '@/components/ReminderEditor';

async function createReminder(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const fastId = formData.get('fastId') as string;
  if (!(await canManageFast(user, fastId))) throw new Error('Forbidden');

  const kind = formData.get('kind') as 'broadcast' | 'individual' | 'experienceFollowUp';
  const name = (formData.get('name') as string)?.trim();
  const daysOffset = parseInt(formData.get('daysOffset') as string, 10);
  const template = (formData.get('template') as string)?.trim();
  const subject = (formData.get('subject') as string)?.trim() || null;
  const channels = (formData.get('channels') as string) as 'EMAIL' | 'SMS' | 'BOTH';

  if (!name || !template || Number.isNaN(daysOffset)) throw new Error('Missing fields');

  const data = { fastId, name, daysOffset, template, subject, channels };
  if (kind === 'broadcast') await prisma.broadcastReminder.create({ data });
  else if (kind === 'individual') await prisma.individualReminder.create({ data });
  else if (kind === 'experienceFollowUp') await prisma.experienceFollowUp.create({ data });
  revalidatePath(`/admin/fasts/${fastId}/reminders`);
}

async function deleteReminder(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const id = formData.get('id') as string;
  const kind = formData.get('kind') as 'broadcast' | 'individual' | 'experienceFollowUp';
  const fastId = formData.get('fastId') as string;
  if (!(await canManageFast(user, fastId))) throw new Error('Forbidden');
  if (kind === 'broadcast') await prisma.broadcastReminder.delete({ where: { id } });
  else if (kind === 'individual') await prisma.individualReminder.delete({ where: { id } });
  else if (kind === 'experienceFollowUp') await prisma.experienceFollowUp.delete({ where: { id } });
  revalidatePath(`/admin/fasts/${fastId}/reminders`);
}

export default async function RemindersPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageFast(user, params.id))) redirect('/admin');

  const fast = await prisma.fast.findUnique({
    where: { id: params.id },
    include: {
      ward: true,
      broadcastReminders: { orderBy: { daysOffset: 'asc' } },
      individualReminders: { orderBy: { daysOffset: 'asc' } },
      experienceFollowUps: { orderBy: { daysOffset: 'asc' } },
    },
  });
  if (!fast) notFound();

  return (
    <div className="space-y-12">
      <div>
        <Link href={`/admin/fasts/${fast.id}`} className="btn-ghost text-sm mb-4">← {fast.name}</Link>
        <p className="display-eyebrow mb-3">Reminders</p>
        <h1 className="display-h2">Plan the cadence.</h1>
      </div>

      <ReminderSection
        title="Broadcasts to everyone"
        description="Sent to all current signups at once, relative to the fast's start date (e.g., −3 means 3 days before day 1)."
        items={fast.broadcastReminders}
        kind="broadcast"
        fastId={fast.id}
        fastName={fast.name}
        fastPurpose={fast.purpose}
        wardName={fast.ward.name}
        onDelete={deleteReminder}
        onCreate={createReminder}
        offsetLabel="Days from start date"
        offsetHint="Negative = before fast begins. 0 = day 1. Positive = during fast."
      />

      <ReminderSection
        title="Individual reminders"
        description="Sent to each participant relative to their individual fast date (e.g., −1 means the day before their fast)."
        items={fast.individualReminders}
        kind="individual"
        fastId={fast.id}
        fastName={fast.name}
        fastPurpose={fast.purpose}
        wardName={fast.ward.name}
        onDelete={deleteReminder}
        onCreate={createReminder}
        offsetLabel="Days from participant's fast date"
        offsetHint="Negative = before their day. 0 = morning of their day. Positive = after their day."
      />

      <ReminderSection
        title="Experience follow-ups"
        description="Post-fast prompts inviting participants to share what they experienced. Sent days after their fast date."
        items={fast.experienceFollowUps}
        kind="experienceFollowUp"
        fastId={fast.id}
        fastName={fast.name}
        fastPurpose={fast.purpose}
        wardName={fast.ward.name}
        onDelete={deleteReminder}
        onCreate={createReminder}
        offsetLabel="Days after participant's fast date"
        offsetHint="Suggested: 1, 7, 30, 60."
      />
    </div>
  );
}

function ReminderSection(props: {
  title: string;
  description: string;
  items: any[];
  kind: 'broadcast' | 'individual' | 'experienceFollowUp';
  fastId: string;
  fastName: string;
  fastPurpose: string;
  wardName: string;
  onDelete: (fd: FormData) => Promise<void>;
  onCreate: (fd: FormData) => Promise<void>;
  offsetLabel: string;
  offsetHint: string;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl tracking-tightest mb-2">{props.title}</h2>
      <p className="text-ink-700 mb-6">{props.description}</p>

      {props.items.length > 0 && (
        <div className="space-y-3 mb-6">
          {props.items.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-display text-lg tracking-tightest">{r.name}</span>
                    <span className="text-xs text-ink-500 uppercase tracking-wider">
                      Day offset: {r.daysOffset >= 0 ? `+${r.daysOffset}` : r.daysOffset}
                    </span>
                    <span className="text-xs text-sage-700 uppercase tracking-wider">{r.channels}</span>
                    {r.sentAt && <span className="text-xs text-ink-500">Sent {new Date(r.sentAt).toLocaleDateString()}</span>}
                  </div>
                  {r.subject && <p className="text-sm text-ink-700 mb-1"><strong>Subject:</strong> {r.subject}</p>}
                  <p className="text-sm text-ink-700 whitespace-pre-wrap line-clamp-3">{r.template}</p>
                </div>
                <form action={props.onDelete}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="kind" value={props.kind} />
                  <input type="hidden" name="fastId" value={props.fastId} />
                  <button type="submit" className="text-sm text-ember-700 hover:underline ml-4">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReminderEditor
        kind={props.kind}
        fastId={props.fastId}
        fastName={props.fastName}
        fastPurpose={props.fastPurpose}
        wardName={props.wardName}
        offsetLabel={props.offsetLabel}
        offsetHint={props.offsetHint}
        action={props.onCreate}
      />
    </section>
  );
}
