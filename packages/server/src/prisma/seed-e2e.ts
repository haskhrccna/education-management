import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { runSeed } from './seed';

const prisma = new PrismaClient();
const PARENT_PASSWORD = process.env.SEED_PARENT_PASSWORD || 'Parent1234!';

async function mainE2E() {
  await runSeed();

  const parentPass = await bcrypt.hash(PARENT_PASSWORD, 10);
  const ali = await prisma.user.findUniqueOrThrow({ where: { email: 'ali@quran-review.com' } });
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@quran-review.com' } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@quran-review.com' } });

  const mkParent = (email: string, firstName: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: parentPass,
        role: 'PARENT',
        firstName,
        lastName: 'Guardian',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

  const parent1 = await mkParent('parent@quran-review.com', 'Yusuf'); // APPROVED link
  const parent2 = await mkParent('parent2@quran-review.com', 'Layla'); // PENDING link
  const parent3 = await mkParent('parent3@quran-review.com', 'Zaid'); // REVOKED link

  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent1.id, studentId: ali.id } },
    update: { status: 'APPROVED', decidedAt: new Date(), decidedBy: admin.id },
    create: { parentId: parent1.id, studentId: ali.id, status: 'APPROVED', decidedAt: new Date(), decidedBy: admin.id },
  });
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent2.id, studentId: ali.id } },
    update: { status: 'PENDING' },
    create: { parentId: parent2.id, studentId: ali.id, status: 'PENDING', reason: "I am Ali's mother" },
  });
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent3.id, studentId: ali.id } },
    update: { status: 'REVOKED', decidedAt: new Date(), decidedBy: admin.id },
    create: { parentId: parent3.id, studentId: ali.id, status: 'REVOKED', decidedAt: new Date(), decidedBy: admin.id },
  });

  // Content for Ali so student/parent/teacher detail screens render data.
  // Delete existing content to ensure idempotency (no unique constraints on these tables).
  await prisma.grade.deleteMany({ where: { studentId: ali.id } });
  await prisma.message.deleteMany({
    where: {
      OR: [
        { senderId: teacher.id, receiverId: ali.id },
        { senderId: ali.id, receiverId: teacher.id },
      ],
    },
  });
  await prisma.notification.deleteMany({ where: { userId: ali.id } });

  const fatiha = await prisma.surah.findFirst({ where: { number: 1 } });
  await prisma.grade.createMany({
    data: [
      {
        studentId: ali.id,
        teacherId: teacher.id,
        surahId: fatiha?.id ?? null,
        grade: 'A',
        type: 'QUIZ',
        notes: 'Excellent tajweed',
      },
      {
        studentId: ali.id,
        teacherId: teacher.id,
        surahId: fatiha?.id ?? null,
        grade: 'B+',
        type: 'ASSIGNMENT',
        notes: 'Minor hesitation',
      },
    ],
  });
  await prisma.message.createMany({
    data: [
      { senderId: teacher.id, receiverId: ali.id, content: 'أحسنت في حفظ سورة الفاتحة', type: 'TEXT' },
      { senderId: ali.id, receiverId: teacher.id, content: 'جزاك الله خيراً يا أستاذ', type: 'TEXT' },
    ],
  });
  await prisma.notification.createMany({
    data: [
      { userId: ali.id, type: 'new_grade', title: 'درجة جديدة', body: 'حصلت على درجة جديدة في سورة الفاتحة' },
      { userId: ali.id, type: 'new_message', title: 'تذكير', body: 'موعد المراجعة غداً' },
    ],
  });

  // Task 5 (coordinator resolution #1): app/_layout.tsx redirects any active
  // student/teacher/parent with onboardingCompletedAt == null to the
  // onboarding wizard before it ever reaches home/appointments/grades. Stamp
  // the seeded accounts used by E2E flows as already onboarded so their
  // login lands directly on the role home screen. fatima@ (PENDING) and any
  // freshly-registered journey user are deliberately left unstamped.
  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'ali@quran-review.com',
          'student@quran-review.com',
          'teacher@quran-review.com',
          'sarah@quran-review.com',
          'parent@quran-review.com',
          'parent2@quran-review.com',
          'parent3@quran-review.com',
        ],
      },
    },
    data: { onboardingCompletedAt: new Date() },
  });

  console.log('\n🧪 E2E seed complete. Extra users:');
  console.log(`  parent@quran-review.com  | PARENT | APPROVED link → Ali | ${PARENT_PASSWORD}`);
  console.log(`  parent2@quran-review.com | PARENT | PENDING link → Ali`);
  console.log(`  parent3@quran-review.com | PARENT | REVOKED link → Ali`);
}

mainE2E()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
