import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { nanoid } from 'nanoid';
import { sendEmail, baseTemplate } from '@/lib/email';
import { addDays } from 'date-fns';

async function createInvite(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const name = (formData.get('name') as string)?.trim();
  const role = formData.get('role') as 'STAKE_ADMIN' | 'WARD_ADMIN';
  const stakeId = (formData.get('stakeId') as string) || null;
  const wardId = (formData.get('wardId') as string) || null;

  if (!email || !name || !role) throw new Error('Missing fields');

  // Permission check
  if (role === 'STAKE_ADMIN' && user.role !== 'SUPER_ADMIN') throw new Error('Only super admins can invite stake admins');
  if (role === 'WARD_ADMIN') {
    if (user.role === 'WARD_ADMIN') throw new Error('Ward admins cannot invite');
    if (user.role === 'STAKE_ADMIN' && wardId) {
      const ward = await prisma.ward.findUnique({ where: { id: wardId } });
      if (ward?.stakeId !== user.stakeId) throw new Error('Wrong stake');
    }
  }

  const token = nanoid(40);
  const expiresAt = addDays(new Date(), 14);

  await prisma.adminInvite.create({
    data: {
      email,
      role,
      stakeId,
      wardId,
      token,
      invitedBy: user.id,
      expiresAt,
    },
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/admin/invites/${token}`;

  await sendEmail({
    to: email,
    subject: `You've been invited to help run a 40-day fast`,
    html: baseTemplate(`
      <p style="font-family:Georgia,serif;color:#6B5F52;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">Invitation</p>
      <h1 style="font-family:Georgia,serif;font-weight:400;color:#1A1612;font-size:28px;margin:12px 0 24px;">Welcome, ${name}.</h1>
      <p>${user.name} has invited you to help coordinate a 40-day fast as a <strong>${role === 'STAKE_ADMIN' ? 'Stake Admin' : 'Ward Admin'}</strong>.</p>
      <p style="margin-top:24px;">
        <a href="${link}" style="display:inline-block;padding:14px 24px;background:#4A5B36;color:#FBF8F3;text-decoration:none;border-radius:4px;">Accept invitation</a>
      </p>
      <p style="color:#6B5F52;font-size:13px;">This link expires in 14 days.</p>
    `),
  });

  redirect(stakeId ? `/admin/stakes/${stakeId}` : wardId ? `/admin/wards/${wardId}` : '/admin');
}

export default async function NewInvitePage({ searchParams }: { searchParams: { stake?: string; ward?: string } }) {
  const user = await requireAdmin();
  if (user.role === 'WARD_ADMIN') redirect('/admin');

  const stakes = user.role === 'SUPER_ADMIN'
    ? await prisma.stake.findMany({ orderBy: { name: 'asc' } })
    : user.stakeId
      ? await prisma.stake.findMany({ where: { id: user.stakeId } })
      : [];

  const wards = user.role === 'SUPER_ADMIN'
    ? await prisma.ward.findMany({ orderBy: { name: 'asc' }, include: { stake: true } })
    : user.stakeId
      ? await prisma.ward.findMany({ where: { stakeId: user.stakeId }, include: { stake: true } })
      : [];

  return (
    <div className="max-w-xl">
      <Link href="/admin" className="btn-ghost text-sm mb-6">← Back</Link>
      <p className="display-eyebrow mb-3">Invite admin</p>
      <h1 className="display-h2 mb-8">Bring someone in.</h1>

      <form action={createInvite} className="space-y-4 card p-6">
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input" placeholder="them@example.com" autoFocus />
        </div>
        <div>
          <label className="label">Their name</label>
          <input name="name" required className="input" placeholder="Full name" />
        </div>
        <div>
          <label className="label">Role</label>
          <select name="role" required className="input" defaultValue={searchParams.ward ? 'WARD_ADMIN' : (user.role === 'SUPER_ADMIN' ? 'STAKE_ADMIN' : 'WARD_ADMIN')}>
            {user.role === 'SUPER_ADMIN' && <option value="STAKE_ADMIN">Stake Admin</option>}
            <option value="WARD_ADMIN">Ward Admin</option>
          </select>
        </div>
        {user.role === 'SUPER_ADMIN' && (
          <div>
            <label className="label">Stake (for Stake Admin)</label>
            <select name="stakeId" className="input" defaultValue={searchParams.stake ?? ''}>
              <option value="">— None —</option>
              {stakes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Ward (for Ward Admin)</label>
          <select name="wardId" className="input" defaultValue={searchParams.ward ?? ''}>
            <option value="">— None —</option>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.stake.name} — {w.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">Send invitation</button>
      </form>
    </div>
  );
}
