import { requireAdmin, canManageWard } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { newPublicSlug, newAccessCode } from '@/lib/tokens';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { addDays, format } from 'date-fns';

async function createFast(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const wardId = formData.get('wardId') as string;
  if (!(await canManageWard(user, wardId))) throw new Error('Forbidden');

  const name = (formData.get('name') as string)?.trim();
  const purpose = (formData.get('purpose') as string)?.trim();
  const landingMessage = (formData.get('landingMessage') as string)?.trim() || null;
  const startDateStr = formData.get('startDate') as string;

  if (!name || !purpose || !startDateStr) throw new Error('Missing fields');

  // Parse as local date (no time component)
  const [y, m, d] = startDateStr.split('-').map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, d));

  const fast = await prisma.fast.create({
    data: {
      wardId,
      name,
      purpose,
      landingMessage,
      startDate,
      publicSlug: newPublicSlug(),
      accessCode: newAccessCode(),
      createdById: user.id,
      status: 'DRAFT',
    },
  });

  redirect(`/admin/fasts/${fast.id}`);
}

export default async function NewFastPage({ searchParams }: { searchParams: { ward?: string } }) {
  const user = await requireAdmin();
  const wards = user.role === 'SUPER_ADMIN'
    ? await prisma.ward.findMany({ orderBy: { name: 'asc' }, include: { stake: true } })
    : user.role === 'STAKE_ADMIN' && user.stakeId
      ? await prisma.ward.findMany({ where: { stakeId: user.stakeId }, include: { stake: true } })
      : user.wardId
        ? await prisma.ward.findMany({ where: { id: user.wardId }, include: { stake: true } })
        : [];

  const defaultWard = searchParams.ward || user.wardId || wards[0]?.id;
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={defaultWard ? `/admin/wards/${defaultWard}` : '/admin'} className="btn-ghost text-sm mb-4">← Back</Link>
        <p className="display-eyebrow mb-3">New 40-day fast</p>
        <h1 className="display-h2 mb-3">Set the foundation.</h1>
        <p className="text-ink-700 max-w-lg">
          You'll be able to configure reminders, share the signup link, and review participants after you create it.
        </p>
      </div>

      <form action={createFast} className="space-y-5 card p-8">
        <div>
          <label className="label">Ward</label>
          <select name="wardId" required className="input" defaultValue={defaultWard}>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.stake.name} — {w.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Fast name</label>
          <input name="name" required className="input" placeholder="e.g., Lenten Fast 2026" autoFocus />
          <p className="text-xs text-ink-500 mt-1.5">A short title participants will see.</p>
        </div>

        <div>
          <label className="label">Purpose of the fast</label>
          <textarea name="purpose" required rows={4} className="input" placeholder="Describe what the congregation is fasting for. This will be the first thing participants read on the signup page." />
        </div>

        <div>
          <label className="label">Additional landing-page message <span className="text-ink-500 font-normal">(optional)</span></label>
          <textarea name="landingMessage" rows={3} className="input" placeholder="Optional invitation, scripture, or further context shown beneath the purpose." />
        </div>

        <div>
          <label className="label">Start date</label>
          <input name="startDate" type="date" required className="input" defaultValue={tomorrow} />
          <p className="text-xs text-ink-500 mt-1.5">Day 40 will be calculated automatically.</p>
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary">Create fast (as draft)</button>
        </div>
      </form>
    </div>
  );
}
