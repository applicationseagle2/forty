import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

async function createStake(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  if (user.role !== 'SUPER_ADMIN') throw new Error('Only super admins can create stakes');
  const name = (formData.get('name') as string)?.trim();
  if (!name) throw new Error('Name required');
  const stake = await prisma.stake.create({ data: { name } });
  redirect(`/admin/stakes/${stake.id}`);
}

export default async function NewStakePage() {
  const user = await requireAdmin();
  if (user.role !== 'SUPER_ADMIN') redirect('/admin');

  return (
    <div className="max-w-xl">
      <Link href="/admin" className="btn-ghost text-sm mb-6">← Back</Link>
      <p className="display-eyebrow mb-3">New stake</p>
      <h1 className="display-h2 mb-8">Name this stake.</h1>
      <form action={createStake} className="space-y-4">
        <div>
          <label htmlFor="name" className="label">Stake name</label>
          <input id="name" name="name" required className="input" placeholder="e.g., Boise Idaho West Stake" autoFocus />
        </div>
        <button type="submit" className="btn-primary">Create stake</button>
      </form>
    </div>
  );
}
