import type { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import { sendMagicLinkEmail } from './email';
import type { AdminRole } from '@prisma/client';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    EmailProvider({
      // We use SendGrid directly; this provider only handles token storage.
      server: { host: 'localhost', port: 25, auth: { user: '', pass: '' } },
      from: process.env.SENDGRID_FROM_EMAIL!,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],
  pages: {
    signIn: '/admin/signin',
    verifyRequest: '/admin/signin/verify',
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow sign-in for emails that exist as AdminUser
      if (!user.email) return false;
      const admin = await prisma.adminUser.findUnique({ where: { email: user.email } });
      return !!admin;
    },
    async session({ session, user }) {
      if (!session.user || !user.email) return session;
      const admin = await prisma.adminUser.findUnique({ where: { email: user.email } });
      if (admin) {
        (session.user as any).id = admin.id;
        (session.user as any).role = admin.role;
        (session.user as any).stakeId = admin.stakeId;
        (session.user as any).wardId = admin.wardId;
        (session.user as any).name = admin.name;
      }
      return session;
    },
  },
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  stakeId: string | null;
  wardId: string | null;
};
