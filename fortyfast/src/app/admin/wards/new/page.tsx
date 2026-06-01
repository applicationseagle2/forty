import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const TIMEZONES = [
  'America/Boise', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Chicago', 'America/New_York',
  'Pacific/Honolulu', 'America/Anchorage',
];

async function createWard(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const stakeId = formData.get('stakeId') as string;
  if (user.role === 'WARD_ADMIN') throw new Error('Insufficient permissions');
  if (user.role === 'STAKE_ADMIN' && user.stakeId !== stakeId) throw new Error('Wrong stake');
  const name = (formData.get('name') as string)?.trim();
  const timezone = (formData.get('timezone') as string) || 'America/Boise';
  if (!name) throw new Error('Name required');
  const ward = await prisma.ward.create({ data: { name, timezone, stakeId } });
  redirect(`/admin/wards/${ward.id}`);
}

export default async function NewWardPage({ searchParams }: { searchParams: { stake?: string } }) {
  const user = await requireAdmin();
  if (user.role === 'WARD_ADMIN') redirect('/admin');

  const stakes = user.role === 'SUPER_ADMIN'
    ? await prisma.stake.findMany({ orderBy: { name: 'asc' } })
    : user.stakeId
      ? await prisma.stake.findMany({ where: { id: user.stakeId } })
      : [];

  const defaultStake = searchParams.stake || user.stakeId || stakes[0]?.id;

  return (
    <div className="max-w-xl">
      <Link href="/admin" className="btn-ghost text-sm mb-6">← Back</Link>
      <p className="display-eyebrow mb-3">New ward</p>
      <h1 className="display-h2 mb-8">Add a ward.</h1>
      <form action={createWard} className="space-y-4">
        <div>
          <label htmlFor="stakeId" className="label">Stake</label>
          <select id="stakeId" name="stakeId" required className="input" defaultValue={defaultStake}>
            {stakes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="name" className="label">Ward name</label>
          <input id="name" name="name" required className="input" placeholder="e.g., Nampa 12th Ward" autoFocus />
        </div>
        <div>
          <label htmlFor="timezone" className="label">Timezone</label>
          <select id="timezone" name="timezone" required className="input" defaultValue="America/Boise">
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <p className="text-xs text-ink-500 mt-1.5">Fast days are interpreted in this timezone.</p>
        </div>
        <button type="submit" className="btn-primary">Create ward</button>
      </form>
    </div>
  );
}
