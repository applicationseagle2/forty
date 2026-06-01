import { PrismaClient, AdminRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';
  if (!email) {
    console.error('Set SUPER_ADMIN_EMAIL in .env before seeding.');
    process.exit(1);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }

  await prisma.adminUser.create({
    data: {
      email,
      name,
      role: AdminRole.SUPER_ADMIN,
    },
  });

  console.log(`✓ Created super admin: ${email}`);
  console.log('Sign in at /admin/signin using the magic-link email flow.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
