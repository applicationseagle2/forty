import type { Adapter } from 'next-auth/adapters';
import type { PrismaClient } from '@prisma/client';

export function CustomPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    createUser: async () => {
      throw new Error('Users must be invited; signup not allowed via auth');
    },
    getUser: (id) => prisma.adminUser.findUnique({ where: { id } }) as any,
    getUserByEmail: (email) => prisma.adminUser.findUnique({ where: { email } }) as any,
    getUserByAccount: async ({ providerAccountId, provider }) => {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return (account?.user as any) ?? null;
    },
    updateUser: ({ id, ...data }) =>
      prisma.adminUser.update({ where: { id }, data: data as any }) as any,
    deleteUser: (id) => prisma.adminUser.delete({ where: { id } }) as any,
    linkAccount: (data) => prisma.account.create({ data: data as any }) as any,
    unlinkAccount: ({ providerAccountId, provider }) =>
      prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      }) as any,
    getSessionAndUser: async (sessionToken) => {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!session) return null;
      const { user, ...sessionData } = session;
      return { session: sessionData as any, user: user as any };
    },
    createSession: (data) => prisma.session.create({ data }) as any,
    updateSession: (data) =>
      prisma.session.update({ where: { sessionToken: data.sessionToken }, data }) as any,
    deleteSession: (sessionToken) =>
      prisma.session.delete({ where: { sessionToken } }) as any,
    createVerificationToken: (data) => prisma.verificationToken.create({ data }),
    useVerificationToken: async (identifier_token) => {
      try {
        return await prisma.verificationToken.delete({ where: { identifier_token } });
      } catch {
        return null;
      }
    },
  };
}