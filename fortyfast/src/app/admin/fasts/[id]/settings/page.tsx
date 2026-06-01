import { requireAdmin, canManageFast } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { newAccessCode } from '@/lib/tokens';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { format } from 'date-fns';

async function updateSettings(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const fastId = formData.get('fastId') as string;
  if (!(await canManageFast(user, fastId))) throw new Error('Forbidden');

  const name = (formData.get('name') as string)?.trim();
  const purpose = (formData.get('purpose') as string)?.trim();
  const landingMessage = (formData.get('landingMessage') as string)?.trim() || null;
  const status = formData.get('status') as any;
  const allowStacking = formData.get('allowStacking') === 'on';
  const cancellationHours = parseInt(formData.get('cancellationHours') as string, 10) || 72;
  const startDateStr = formData.get('startDate') as string;

  let startDate: Date | undefined;
  if (startDateStr) {
    const [y, m, d] = startDateStr.split('-').map(Number);
    startDate = new Date(Date.UTC(y, m - 1, d));
  }

  await prisma.fast.update({
    where: { id: fastId },
    data: {
      name,
      purpose,
      landingMessage,
      status,
      allowStacking,
      cancellationHours,
      ...(startDate ? { startDate } : {}),
    },
  });

  revalidatePath(`/admin/fasts/${fastId}`);
  revalidatePath(`/admin/fasts/${fastId}/settings`);
}

async function regenerateAccessCode(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const fastId = formData.get('fastId') as string;
  if (!(await canManageFast(user, fastId))) throw new Error('Forbidden');
  await prisma.fast.update({
    where: { id: fastId },
    data: { accessCode: newAccessCode() },
  });
  revalidatePath(`/admin/fasts/${fastId}/settings`);
}

export default async function FastSettingsPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageFast(user, params.id))) redirect('/admin');

  const fast = await prisma.fast.findUnique({ where: { id: params.id } });
  if (!fast) notFound();

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <Link href={`/admin/fasts/${fast.id}`} className="btn-ghost text-sm mb-4">← {fast.name}</Link>
        <p className="display-eyebrow mb-3">Settings</p>
        <h1 className="display-h2">Adjust this fast.</h1>
      </div>

      <form action={updateSettings} className="card p-6 space-y-4">
        <input type="hidden" name="fastId" value={fast.id} />
        <div>
          <label className="label">Name</label>
          <input name="name" required className="input" defaultValue={fast.name} />
        </div>
        <div>
          <label className="label">Purpose</label>
          <textarea name="purpose" required rows={4} className="input" defaultValue={fast.purpose} />
        </div>
        <div>
          <label className="label">Landing page message (optional)</label>
          <textarea name="landingMessage" rows={3} className="input" defaultValue={fast.landingMessage ?? ''} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Start date</label>
            <input name="startDate" type="date" className="input" defaultValue={format(fast.startDate, 'yyyy-MM-dd')} />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue={fast.status}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Cancellation notice (hours)</label>
          <input name="cancellationHours" type="number" min={0} className="input" defaultValue={fast.cancellationHours} />
          <p className="text-xs text-ink-500 mt-1">Participants must give this much notice to cancel a day.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowStacking" defaultChecked={fast.allowStacking} />
          Allow stacking (multiple families on the same day)
        </label>
        <button type="submit" className="btn-primary">Save changes</button>
      </form>

      <section className="card p-6">
        <h2 className="font-display text-xl tracking-tightest mb-3">Access code</h2>
        <p className="text-ink-700 text-sm mb-4">Current code: <code className="bg-parchment-100 px-2 py-1 rounded-sm">{fast.accessCode}</code></p>
        <form action={regenerateAccessCode}>
          <input type="hidden" name="fastId" value={fast.id} />
          <button type="submit" className="btn-secondary text-sm">Regenerate code</button>
          <p className="text-xs text-ink-500 mt-2">Old shared links will stop working. Re-share the new link after rotating.</p>
        </form>
      </section>
    </div>
  );
}
