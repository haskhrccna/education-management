import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@education.com' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('Admin1234!', 10);
    await prisma.user.create({
      data: {
        email: 'admin@education.com',
        passwordHash,
        role: 'ADMIN',
        firstName: 'Super',
        lastName: 'Admin',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        },
     });
    console.log('Created admin user: admin@education.com / Admin1234!');
  }

  // Create a sample teacher
  const teacherExists = await prisma.user.findUnique({ where: { email: 'teacher@education.com' } });
  if (!teacherExists) {
    const passwordHash = await bcrypt.hash('Teacher1234!', 10);
    await prisma.user.create({
      data: {
        email: 'teacher@education.com',
        passwordHash,
        role: 'TEACHER',
        firstName: 'Ahmad',
        lastName: 'Al-Rashid',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        },
     });
    console.log('Created teacher user: teacher@education.com / Teacher1234!');
  }

  console.log('\nSeed completed. Users available:\n');
  const allUsers = await prisma.user.findMany({ select: { email: true, role: true, firstName: true, status: true } });
  for (const u of allUsers) {
    console.log(`  ${u.email} | ${u.role.padEnd(7)} | ${u.firstName} | ${u.status}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
