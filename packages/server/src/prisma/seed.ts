import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin
  const adminPass = await bcrypt.hash('Admin1234!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@education.com' },
    update: {},
    create: {
      email: 'admin@education.com',
      passwordHash: adminPass,
      role: 'ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Teachers
  const teacherPass = await bcrypt.hash('Teacher1234!', 10);
  const teacher1 = await prisma.user.upsert({
    where: { email: 'teacher@education.com' },
    update: {},
    create: {
      email: 'teacher@education.com',
      passwordHash: teacherPass,
      role: 'TEACHER',
      firstName: 'Ahmad',
      lastName: 'Al-Rashid',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  const teacher2 = await prisma.user.upsert({
    where: { email: 'sarah@education.com' },
    update: {},
    create: {
      email: 'sarah@education.com',
      passwordHash: teacherPass,
      role: 'TEACHER',
      firstName: 'Sarah',
      lastName: 'Khalil',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Students
  const studentPass = await bcrypt.hash('Student1234!', 10);
  const student1 = await prisma.user.upsert({
    where: { email: 'ali@education.com' },
    update: {},
    create: {
      email: 'ali@education.com',
      passwordHash: studentPass,
      role: 'STUDENT',
      firstName: 'Ali',
      lastName: 'Ahmad',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  const student2 = await prisma.user.upsert({
    where: { email: 'fatima@education.com' },
    update: {},
    create: {
      email: 'fatima@education.com',
      passwordHash: studentPass,
      role: 'STUDENT',
      firstName: 'Fatima',
      lastName: 'Hassan',
      status: 'PENDING',
      emailVerifiedAt: new Date(),
    },
  });
  const student3 = await prisma.user.upsert({
    where: { email: 'student@education.com' },
    update: {},
    create: {
      email: 'student@education.com',
      passwordHash: studentPass,
      role: 'STUDENT',
      firstName: 'Student',
      lastName: 'Demo',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Appointments
  await prisma.appointment.createMany({
    data: [
      {
        studentId: student1.id,
        teacherId: teacher1.id,
        requestedDate: new Date('2026-05-01T00:00:00Z'),
        requestedTime: '10:00',
        durationMinutes: 60,
        status: 'ACCEPTED',
      },
      {
        studentId: student3.id,
        teacherId: teacher2.id,
        requestedDate: new Date('2026-05-02T00:00:00Z'),
        requestedTime: '14:00',
        durationMinutes: 90,
        status: 'REQUESTED',
      },
    ],
    skipDuplicates: true,
  });

  // Grades
  await prisma.grade.createMany({
    data: [
      { studentId: student1.id, teacherId: teacher1.id, subject: 'Mathematics', grade: '95', type: 'EXAM', notes: 'Excellent work' },
      { studentId: student1.id, teacherId: teacher1.id, subject: 'Physics', grade: '88', type: 'QUIZ' },
      { studentId: student1.id, teacherId: teacher2.id, subject: 'English', grade: '92', type: 'ASSIGNMENT' },
    ],
    skipDuplicates: true,
  });

  // Messages
  await prisma.message.createMany({
    data: [
      { senderId: student1.id, receiverId: teacher1.id, content: 'Hello teacher, when is the next exam?', type: 'TEXT' },
      { senderId: teacher1.id, receiverId: student1.id, content: 'Next Monday at 10 AM', type: 'TEXT' },
    ],
    skipDuplicates: true,
  });

  console.log('\n🌱 Seed completed. Users available:\n');
  const allUsers = await prisma.user.findMany({
    select: { email: true, role: true, firstName: true, status: true },
    orderBy: { role: 'asc' },
  });
  for (const u of allUsers) {
    console.log(`  ${u.email.padEnd(24)} | ${u.role.padEnd(7)} | ${u.firstName.padEnd(10)} | ${u.status}`);
  }
  console.log(`\n  Default passwords: Admin1234! / Teacher1234! / Student1234!`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
