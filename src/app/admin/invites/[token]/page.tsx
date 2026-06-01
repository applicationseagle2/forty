import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';

async function acceptInvite(formData: FormData) {
  'use server';
  const token = formData.get('token') as string;
  const name = (formData.get('name') as string)?.trim();
  if (!token || !name) throw new Error('Missing fields');

  const invite = await prisma.adminInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error('Invitation invalid or expired');
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: invite.email } });
  if (!existing) {
    await prisma.adminUser.create({
      data: {
        email: invite.email,
        name,
        role: invite.role,
        stakeId: invite.stakeId,
        wardId: invite.wardId,
      },
    });
  } else {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        role: invite.role,
        stakeId: invite.stakeId ?? existing.stakeId,
        wardId: invite.wardId ?? existing.wardId,
      },
    });
  }

  await prisma.adminInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  redirect(`/admin/signin?email=${encodeURIComponent(invite.email)}`);
}

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const invite = await prisma.adminInvite.findUnique({ where: { token: params.token } });
  if (!invite) notFound();

  if (invite.acceptedAt) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="display-eyebrow mb-4">Already accepted</p>
          <h1 className="display-h2 mb-4">This invitation has already been used.</h1>
          <p className="text-ink-700 mb-6">Sign in instead.</p>
          <a href="/admin/signin" className="btn-primary">Sign in</a>
        </div>
      </main>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="display-eyebrow mb-4">Expired</p>
          <h1 className="display-h2">This invitation has expired.</h1>
          <p className="text-ink-700 mt-4">Ask the person who invited you to send a new one.</p>
        </div>
      </main>
    );
  }

  // Fetch scope name separately
  let scopeName = '';
  if (invite.wardId) {
    const ward = await prisma.ward.findUnique({ where: { id: invite.wardId } });
    if (ward) scopeName = ward.name;
  } else if (invite.stakeId) {
    const stake = await prisma.stake.findUnique({ where: { id: invite.stakeId } });
    if (stake) scopeName = stake.name;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="display-eyebrow mb-4">You're invited</p>
        <h1 className="display-h2 mb-3">Welcome.</h1>
        <p className="text-ink-700 mb-8">
          You've been invited to serve as a <strong>{invite.role.replace('_', ' ').toLowerCase()}</strong>
          {scopeName && <> for <strong>{scopeName}</strong></>}.
        </p>

        <form action={acceptInvite} className="space-y-4 card p-6">
          <input type="hidden" name="token" value={params.token} />
          <div>
            <label className="label">Email</label>
            <input className="input" value={invite.email} disabled />
          </div>
          <div>
            <label className="label">Your name</label>
            <input name="name" required className="input" placeholder="Full name" autoFocus />
          </div>
          <button type="submit" className="btn-primary w-full">Accept &amp; continue</button>
        </form>
      </div>
    </main>
  );
}
