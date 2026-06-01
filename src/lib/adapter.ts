import type { Adapter } from 'next-auth/adapters';
import type { PrismaClient } from '@prisma/client';

export function CustomPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    createUser: async () => {
      throw new Error('Users must be invited; signup not allowed via auth');
    },
    getUser: (id: string) =>
      prisma.adminUser.findUnique({ where: { id } }) as any,
    getUserByEmail: (email: string) =>
      prisma.adminUser.findUnique({ where: { email } }) as any,
    getUserByAccount: async ({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }) => {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return (account?.user as any) ?? null;
    },
    updateUser: ({ id, ...data }: any) =>
      prisma.adminUser.update({ where: { id }, data }) as any,
    deleteUser: (id: string) =>
      prisma.adminUser.delete({ where: { id } }) as any,
    linkAccount: (data: any) =>
      prisma.account.create({ data }) as any,
    unlinkAccount: ({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }) =>
      prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      }) as any,
    getSessionAndUser: async (sessionToken: string) => {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!session) return null;
      const { user, ...sessionData } = session;
      return { session: sessionData as any, user: user as any };
    },
    createSession: (data: any) => prisma.session.create({ data }) as any,
    updateSession: (data: any) =>
      prisma.session.update({
        where: { sessionToken: data.sessionToken },
        data,
      }) as any,
    deleteSession: (sessionToken: string) =>
      prisma.session.delete({ where: { sessionToken } }) as any,
    createVerificationToken: (data: any) =>
      prisma.verificationToken.create({ data }),
    useVerificationToken: async (identifier_token: {
      identifier: string;
      token: string;
    }) => {
      try {
        return await prisma.verificationToken.delete({
          where: { identifier_token },
        });
      } catch {
        return null;
      }
    },
  };
}