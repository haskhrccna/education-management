import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { runSeed } from './seed';

const prisma = new PrismaClient();

// Review/demo accounts for store submission. Passwords MUST come from env vars;
// the script refuses to run in production without them (fail-fast, never ship
// default/demo passwords to a live environment).
const REVIEW_ADMIN_PASSWORD = process.env.SEED_REVIEW_ADMIN_PASSWORD;
const REVIEW_TEACHER_PASSWORD = process.env.SEED_REVIEW_TEACHER_PASSWORD;
const REVIEW_STUDENT_PASSWORD = process.env.SEED_REVIEW_STUDENT_PASSWORD;
const REVIEW_PARENT_PASSWORD = process.env.SEED_REVIEW_PARENT_PASSWORD;

function requirePassword(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Set it before running seed:review — ` +
        'review accounts must never use default passwords in production.'
    );
  }
  return value;
}

async function main() {
  // 1) Base seed (admin, teachers, students, surahs) — idempotent via upsert.
  await runSeed();

  // 2) Production guard: require explicit passwords for every review account.
  const adminPass = requirePassword('SEED_REVIEW_ADMIN_PASSWORD', REVIEW_ADMIN_PASSWORD);
  const teacherPass = requirePassword('SEED_REVIEW_TEACHER_PASSWORD', REVIEW_TEACHER_PASSWORD);
  const studentPass = requirePassword('SEED_REVIEW_STUDENT_PASSWORD', REVIEW_STUDENT_PASSWORD);
  const parentPass = requirePassword('SEED_REVIEW_PARENT_PASSWORD', REVIEW_PARENT_PASSWORD);

  const hash = (p: string) => bcrypt.hash(p, 10);

  // Admin review account
  await prisma.user.upsert({
    where: { email: 'review-admin@quran-review.app' },
    update: {},
    create: {
      email: 'review-admin@quran-review.app',
      passwordHash: await hash(adminPass),
      role: 'ADMIN',
      firstName: 'Review',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Teacher review account
  const teacher = await prisma.user.upsert({
    where: { email: 'review-teacher@quran-review.app' },
    update: {},
    create: {
      email: 'review-teacher@quran-review.app',
      passwordHash: await hash(teacherPass),
      role: 'TEACHER',
      firstName: 'Review',
      lastName: 'Teacher',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Student review account
  const student = await prisma.user.upsert({
    where: { email: 'review-student@quran-review.app' },
    update: {},
    create: {
      email: 'review-student@quran-review.app',
      passwordHash: await hash(studentPass),
      role: 'STUDENT',
      firstName: 'Review',
      lastName: 'Student',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Parent review account linked to the review student
  const parent = await prisma.user.upsert({
    where: { email: 'review-parent@quran-review.app' },
    update: {},
    create: {
      email: 'review-parent@quran-review.app',
      passwordHash: await hash(parentPass),
      role: 'PARENT',
      firstName: 'Review',
      lastName: 'Parent',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Approved parent→student link (decided by the review admin)
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'review-admin@quran-review.app' },
  });
  await prisma.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    update: { status: 'APPROVED', decidedAt: new Date(), decidedBy: admin.id },
    create: {
      parentId: parent.id,
      studentId: student.id,
      status: 'APPROVED',
      decidedAt: new Date(),
      decidedBy: admin.id,
    },
  });

  // Stamp onboarding as complete so reviewers land on the role home screen
  // (not the onboarding wizard).
  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'review-admin@quran-review.app',
          'review-teacher@quran-review.app',
          'review-student@quran-review.app',
          'review-parent@quran-review.app',
        ],
      },
    },
    data: { onboardingCompletedAt: new Date() },
  });

  console.log('\n🏪 seed:review complete. Review accounts:');
  console.log(`  review-admin@quran-review.app   | ADMIN   | ${REVIEW_ADMIN_PASSWORD}`);
  console.log(`  review-teacher@quran-review.app | TEACHER | ${REVIEW_TEACHER_PASSWORD}`);
  console.log(`  review-student@quran-review.app | STUDENT | ${REVIEW_STUDENT_PASSWORD}`);
  console.log(
    `  review-parent@quran-review.app  | PARENT  | APPROVED link → review-student | ${REVIEW_PARENT_PASSWORD}`
  );
  console.log('\nPoint these at the production backend for store review. Rotate passwords after approval.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
