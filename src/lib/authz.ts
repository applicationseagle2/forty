import { getServerSession } from 'next-auth';
import { authOptions, type SessionUser } from './auth';
import { prisma } from './prisma';
import { redirect } from 'next/navigation';

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as unknown as SessionUser;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/signin');
  return user;
}

export async function canManageStake(user: SessionUser, stakeId: string): Promise<boolean> {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'STAKE_ADMIN' && user.stakeId === stakeId) return true;
  return false;
}

export async function canManageWard(user: SessionUser, wardId: string): Promise<boolean> {
  if (user.role === 'SUPER_ADMIN') return true;
  const ward = await prisma.ward.findUnique({ where: { id: wardId } });
  if (!ward) return false;
  if (user.role === 'STAKE_ADMIN' && user.stakeId === ward.stakeId) return true;
  if (user.role === 'WARD_ADMIN' && user.wardId === wardId) return true;
  return false;
}

export async function canManageFast(user: SessionUser, fastId: string): Promise<boolean> {
  const fast = await prisma.fast.findUnique({
    where: { id: fastId },
    select: { wardId: true, ward: { select: { stakeId: true } } },
  });
  if (!fast) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'STAKE_ADMIN' && user.stakeId === fast.ward.stakeId) return true;
  if (user.role === 'WARD_ADMIN' && user.wardId === fast.wardId) return true;
  return false;
}
