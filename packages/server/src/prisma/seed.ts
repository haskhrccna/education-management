import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Surahs (all 114) ─────────────────────────────────────────────────────────
const SURAH_DATA: Array<{ number: number; nameAr: string; nameEn: string; ayahCount: number; juz: number }> = [
  // Juz 1
  { number: 1, nameAr: 'الفاتحة', nameEn: 'Al-Fatiha', ayahCount: 7, juz: 1 },
  // Juz 1-3
  { number: 2, nameAr: 'البقرة', nameEn: 'Al-Baqarah', ayahCount: 286, juz: 1 },
  // Juz 3
  { number: 3, nameAr: 'آل عمران', nameEn: "Ali 'Imran", ayahCount: 200, juz: 3 },
  { number: 4, nameAr: 'النساء', nameEn: 'An-Nisa', ayahCount: 176, juz: 4 },
  // Juz 5
  { number: 5, nameAr: 'المائدة', nameEn: "Al-Ma'idah", ayahCount: 120, juz: 5 },
  // Juz 6
  { number: 6, nameAr: 'الأنعام', nameEn: "Al-An'am", ayahCount: 165, juz: 6 },
  // Juz 7
  { number: 7, nameAr: 'الأعراف', nameEn: "Al-A'raf", ayahCount: 206, juz: 7 },
  // Juz 8-9
  { number: 8, nameAr: 'الأنفال', nameEn: 'Al-Anfal', ayahCount: 75, juz: 8 },
  { number: 9, nameAr: 'التوبة', nameEn: 'At-Tawbah', ayahCount: 129, juz: 9 },
  // Juz 10-11
  { number: 10, nameAr: 'يونس', nameEn: 'Yunus', ayahCount: 109, juz: 10 },
  { number: 11, nameAr: 'هود', nameEn: 'Hud', ayahCount: 123, juz: 11 },
  { number: 12, nameAr: 'يوسف', nameEn: 'Yusuf', ayahCount: 111, juz: 12 },
  // Juz 13-14
  { number: 13, nameAr: 'الرعد', nameEn: "Ar-Ra'd", ayahCount: 43, juz: 13 },
  { number: 14, nameAr: 'إبراهيم', nameEn: 'Ibrahim', ayahCount: 52, juz: 13 },
  { number: 15, nameAr: 'الحجر', nameEn: 'Al-Hijr', ayahCount: 99, juz: 14 },
  { number: 16, nameAr: 'النحل', nameEn: 'An-Nahl', ayahCount: 128, juz: 14 },
  // Juz 15
  { number: 17, nameAr: 'الإسراء', nameEn: "Al-Isra'", ayahCount: 111, juz: 15 },
  { number: 18, nameAr: 'الكهف', nameEn: 'Al-Kahf', ayahCount: 110, juz: 15 },
  // Juz 16
  { number: 19, nameAr: 'مريم', nameEn: 'Maryam', ayahCount: 98, juz: 16 },
  { number: 20, nameAr: 'طه', nameEn: 'Ta-Ha', ayahCount: 135, juz: 16 },
  // Juz 17
  { number: 21, nameAr: 'الأنبياء', nameEn: "Al-Anbiya'", ayahCount: 112, juz: 17 },
  { number: 22, nameAr: 'الحج', nameEn: 'Al-Hajj', ayahCount: 78, juz: 17 },
  // Juz 18
  { number: 23, nameAr: 'المؤمنون', nameEn: "Al-Mu'minun", ayahCount: 118, juz: 18 },
  { number: 24, nameAr: 'النور', nameEn: 'An-Nur', ayahCount: 64, juz: 18 },
  { number: 25, nameAr: 'الفرقان', nameEn: 'Al-Furqan', ayahCount: 77, juz: 18 },
  // Juz 19-20
  { number: 26, nameAr: 'الشعراء', nameEn: "Ash-Shu'ara", ayahCount: 227, juz: 19 },
  { number: 27, nameAr: 'النمل', nameEn: 'An-Naml', ayahCount: 93, juz: 19 },
  { number: 28, nameAr: 'القصص', nameEn: 'Al-Qasas', ayahCount: 88, juz: 19 },
  { number: 29, nameAr: 'العنكبوت', nameEn: "Al-'Ankabut", ayahCount: 69, juz: 20 },
  // Juz 20-21
  { number: 30, nameAr: 'الروم', nameEn: 'Ar-Rum', ayahCount: 60, juz: 20 },
  { number: 31, nameAr: 'لقمان', nameEn: 'Luqman', ayahCount: 34, juz: 20 },
  { number: 32, nameAr: 'السجدة', nameEn: 'As-Sajdah', ayahCount: 30, juz: 21 },
  // Juz 21-22
  { number: 33, nameAr: 'الأحزاب', nameEn: 'Al-Ahzab', ayahCount: 73, juz: 21 },
  { number: 34, nameAr: 'سبأ', nameEn: "Saba'", ayahCount: 54, juz: 21 },
  { number: 35, nameAr: 'فاطر', nameEn: 'Fatir', ayahCount: 45, juz: 21 },
  // Juz 22-23
  { number: 36, nameAr: 'يس', nameEn: 'Yasin', ayahCount: 83, juz: 22 },
  { number: 37, nameAr: 'الصافات', nameEn: 'As-Saffat', ayahCount: 182, juz: 23 },
  // Juz 23-24
  { number: 38, nameAr: 'ص', nameEn: 'Sad', ayahCount: 88, juz: 23 },
  { number: 39, nameAr: 'الزمر', nameEn: 'Az-Zumar', ayahCount: 75, juz: 23 },
  { number: 40, nameAr: 'غافر', nameEn: 'Ghafir', ayahCount: 85, juz: 24 },
  // Juz 24-25
  { number: 41, nameAr: 'فصلت', nameEn: 'Fussilat', ayahCount: 54, juz: 24 },
  { number: 42, nameAr: 'الشورى', nameEn: 'Ash-Shura', ayahCount: 53, juz: 25 },
  { number: 43, nameAr: 'الزخرف', nameEn: 'Az-Zukhruf', ayahCount: 89, juz: 25 },
  // Juz 25-26
  { number: 44, nameAr: 'الدخان', nameEn: 'Ad-Dukhan', ayahCount: 59, juz: 25 },
  { number: 45, nameAr: 'الجاثية', nameEn: 'Al-Jathiyyah', ayahCount: 37, juz: 25 },
  { number: 46, nameAr: 'الأحقاف', nameEn: 'Al-Ahqaf', ayahCount: 35, juz: 26 },
  // Juz 26-27
  { number: 47, nameAr: 'محمد', nameEn: 'Muhammad', ayahCount: 38, juz: 26 },
  { number: 48, nameAr: 'الفتح', nameEn: 'Al-Fath', ayahCount: 29, juz: 26 },
  { number: 49, nameAr: 'الحجرات', nameEn: 'Al-Hujurat', ayahCount: 18, juz: 26 },
  // Juz 27-28
  { number: 50, nameAr: 'ق', nameEn: 'Qaf', ayahCount: 45, juz: 27 },
  { number: 51, nameAr: 'الذاريات', nameEn: 'Adh-Dhariyat', ayahCount: 60, juz: 27 },
  { number: 52, nameAr: 'الطور', nameEn: 'At-Tur', ayahCount: 49, juz: 27 },
  // Juz 28
  { number: 53, nameAr: 'النجم', nameEn: 'An-Najm', ayahCount: 62, juz: 27 },
  { number: 54, nameAr: 'القمر', nameEn: 'Al-Qamar', ayahCount: 55, juz: 28 },
  { number: 55, nameAr: 'الرحمن', nameEn: 'Ar-Rahman', ayahCount: 78, juz: 28 },
  // Juz 28-29
  { number: 56, nameAr: 'الواقعة', nameEn: "Al-Waqi'ah", ayahCount: 96, juz: 28 },
  { number: 57, nameAr: 'الحديد', nameEn: 'Al-Hadid', ayahCount: 29, juz: 28 },
  // Juz 29-30
  { number: 58, nameAr: 'المجادلة', nameEn: 'Al-Mujadila', ayahCount: 22, juz: 29 },
  { number: 59, nameAr: 'الحشر', nameEn: 'Al-Hashr', ayahCount: 24, juz: 29 },
  { number: 60, nameAr: 'الممتحنة', nameEn: 'Al-Mumtahanah', ayahCount: 13, juz: 29 },
  // Juz 29
  { number: 61, nameAr: 'الصف', nameEn: 'As-Saff', ayahCount: 14, juz: 29 },
  { number: 62, nameAr: 'الجمعة', nameEn: "Al-Jumu'ah", ayahCount: 11, juz: 29 },
  { number: 63, nameAr: 'المنافقون', nameEn: 'Al-Munafiqun', ayahCount: 11, juz: 29 },
  { number: 64, nameAr: 'التغابن', nameEn: 'At-Taghabun', ayahCount: 18, juz: 29 },
  // Juz 29
  { number: 65, nameAr: 'الطلاق', nameEn: 'At-Talaq', ayahCount: 12, juz: 29 },
  { number: 66, nameAr: 'التحريم', nameEn: 'At-Tahrim', ayahCount: 12, juz: 29 },
  // Juz 29-30
  { number: 67, nameAr: 'الملك', nameEn: 'Al-Mulk', ayahCount: 30, juz: 29 },
  { number: 68, nameAr: 'القلم', nameEn: 'Al-Qalam', ayahCount: 52, juz: 30 },
  // Juz 30
  { number: 69, nameAr: 'الحاقة', nameEn: 'Al-Haqah', ayahCount: 52, juz: 30 },
  { number: 70, nameAr: 'المعارج', nameEn: "Al-Ma'arij", ayahCount: 44, juz: 30 },
  // Juz 30
  { number: 71, nameAr: 'نوح', nameEn: 'Nuh', ayahCount: 28, juz: 30 },
  { number: 72, nameAr: 'الجن', nameEn: 'Al-Jinn', ayahCount: 28, juz: 30 },
  { number: 73, nameAr: 'المزمل', nameEn: 'Al-Muzzammil', ayahCount: 20, juz: 30 },
  { number: 74, nameAr: 'المدثر', nameEn: 'Al-Muddaththir', ayahCount: 56, juz: 30 },
  // Juz 30
  { number: 75, nameAr: 'القيامة', nameEn: 'Al-Qiyamah', ayahCount: 40, juz: 30 },
  { number: 76, nameAr: 'الإنسان', nameEn: 'Al-Insan', ayahCount: 31, juz: 30 },
  // Juz 30
  { number: 77, nameAr: 'المرسلات', nameEn: 'Al-Mursalat', ayahCount: 50, juz: 30 },
  // Juz 30
  { number: 78, nameAr: 'النبأ', nameEn: "An-Naba'", ayahCount: 40, juz: 30 },
  { number: 79, nameAr: 'النازعات', nameEn: "An-Nazi'at", ayahCount: 46, juz: 30 },
  // Juz 30
  { number: 80, nameAr: 'عبس', nameEn: 'Abasa', ayahCount: 42, juz: 30 },
  // Juz 30
  { number: 81, nameAr: 'التكوير', nameEn: 'At-Takwir', ayahCount: 29, juz: 30 },
  // Juz 30
  { number: 82, nameAr: 'الإنفطار', nameEn: 'Al-Infitar', ayahCount: 19, juz: 30 },
  // Juz 30
  { number: 83, nameAr: 'المطففين', nameEn: 'Al-Mutaffifin', ayahCount: 36, juz: 30 },
  // Juz 30
  { number: 84, nameAr: 'الإنشقاق', nameEn: 'Al-Inshiqaq', ayahCount: 25, juz: 30 },
  // Juz 30
  { number: 85, nameAr: 'البروج', nameEn: 'Al-Buruj', ayahCount: 22, juz: 30 },
  // Juz 30
  { number: 86, nameAr: 'الطارق', nameEn: 'At-Tariq', ayahCount: 17, juz: 30 },
  // Juz 30
  { number: 87, nameAr: 'الأعلى', nameEn: "Al-A'la", ayahCount: 19, juz: 30 },
  // Juz 30
  { number: 88, nameAr: 'الغاشية', nameEn: 'Al-Ghashiyah', ayahCount: 26, juz: 30 },
  // Juz 30
  { number: 89, nameAr: 'الفجر', nameEn: 'Al-Fajr', ayahCount: 30, juz: 30 },
  // Juz 30
  { number: 90, nameAr: 'البلد', nameEn: 'Al-Balad', ayahCount: 20, juz: 30 },
  // Juz 30
  { number: 91, nameAr: 'الشمس', nameEn: 'Ash-Shams', ayahCount: 15, juz: 30 },
  // Juz 30
  { number: 92, nameAr: 'الليل', nameEn: 'Al-Layl', ayahCount: 21, juz: 30 },
  // Juz 30
  { number: 93, nameAr: 'الضحى', nameEn: 'Ad-Duha', ayahCount: 11, juz: 30 },
  // Juz 30
  { number: 94, nameAr: 'الشرح', nameEn: 'Ash-Sharh', ayahCount: 8, juz: 30 },
  // Juz 30
  { number: 95, nameAr: 'التين', nameEn: 'At-Tin', ayahCount: 8, juz: 30 },
  // Juz 30
  { number: 96, nameAr: 'العلق', nameEn: "Al-'Alaq", ayahCount: 19, juz: 30 },
  // Juz 30
  { number: 97, nameAr: 'القدر', nameEn: 'Al-Qadr', ayahCount: 5, juz: 30 },
  // Juz 30
  { number: 98, nameAr: 'البينة', nameEn: 'Al-Bayyinah', ayahCount: 8, juz: 30 },
  // Juz 30
  { number: 99, nameAr: 'الزلزلة', nameEn: 'Az-Zalzalah', ayahCount: 8, juz: 30 },
  // Juz 30
  { number: 100, nameAr: 'العاديات', nameEn: "Al-'Adiyat", ayahCount: 11, juz: 30 },
  // Juz 30
  { number: 101, nameAr: 'القارعة', nameEn: "Al-Qari'ah", ayahCount: 11, juz: 30 },
  // Juz 30
  { number: 102, nameAr: 'التكاثر', nameEn: 'At-Takathur', ayahCount: 8, juz: 30 },
  // Juz 30
  { number: 103, nameAr: 'العصر', nameEn: "Al-'Asr", ayahCount: 3, juz: 30 },
  // Juz 30
  { number: 104, nameAr: 'الهمزة', nameEn: 'Al-Humazah', ayahCount: 9, juz: 30 },
  // Juz 30
  { number: 105, nameAr: 'الفيل', nameEn: 'Al-Fil', ayahCount: 5, juz: 30 },
  // Juz 30
  { number: 106, nameAr: 'قريش', nameEn: 'Quraysh', ayahCount: 4, juz: 30 },
  // Juz 30
  { number: 107, nameAr: 'الماعون', nameEn: "Al-Ma'un", ayahCount: 7, juz: 30 },
  // Juz 30
  { number: 108, nameAr: 'الكوثر', nameEn: 'Al-Kawthar', ayahCount: 3, juz: 30 },
  // Juz 30
  { number: 109, nameAr: 'الكافرون', nameEn: 'Al-Kafirun', ayahCount: 6, juz: 30 },
  // Juz 30
  { number: 110, nameAr: 'النصر', nameEn: 'An-Nasr', ayahCount: 3, juz: 30 },
  // Juz 30
  { number: 111, nameAr: 'المسد', nameEn: 'Al-Masad', ayahCount: 5, juz: 30 },
  // Juz 30
  { number: 112, nameAr: 'الإخلاص', nameEn: 'Al-Ikhlas', ayahCount: 4, juz: 30 },
  // Juz 30
  { number: 113, nameAr: 'الفلق', nameEn: 'Al-Falaq', ayahCount: 5, juz: 30 },
  // Juz 30
  { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 6, juz: 30 },
];

// Seed passwords come from env vars. Defaults are intentionally weak and
// MUST NOT be used outside local development. Override via SEED_*_PASSWORD.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
const TEACHER_PASSWORD = process.env.SEED_TEACHER_PASSWORD || 'Teacher1234!';
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || 'Student1234!';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    const usingDefault =
      !process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_TEACHER_PASSWORD || !process.env.SEED_STUDENT_PASSWORD;
    if (usingDefault) {
      throw new Error(
        'Refusing to seed in production with default passwords. Set SEED_ADMIN_PASSWORD, SEED_TEACHER_PASSWORD, SEED_STUDENT_PASSWORD.'
      );
    }
  }

  // Admin
  const adminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
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
  const teacherPass = await bcrypt.hash(TEACHER_PASSWORD, 10);
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
  const studentPass = await bcrypt.hash(STUDENT_PASSWORD, 10);
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
      firstName: 'Omar',
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
      {
        studentId: student1.id,
        teacherId: teacher1.id,
        subject: 'Mathematics',
        grade: '95',
        type: 'EXAM',
        notes: 'Excellent work',
      },
      { studentId: student1.id, teacherId: teacher1.id, subject: 'Physics', grade: '88', type: 'QUIZ' },
      { studentId: student1.id, teacherId: teacher2.id, subject: 'English', grade: '92', type: 'ASSIGNMENT' },
    ],
    skipDuplicates: true,
  });

  // Messages
  await prisma.message.createMany({
    data: [
      {
        senderId: student1.id,
        receiverId: teacher1.id,
        content: 'Hello teacher, when is the next exam?',
        type: 'TEXT',
      },
      { senderId: teacher1.id, receiverId: student1.id, content: 'Next Monday at 10 AM', type: 'TEXT' },
    ],
    skipDuplicates: true,
  });

  // Quran: Surahs
  await prisma.surah.createMany({ data: SURAH_DATA, skipDuplicates: true });

  // MemorizationProgress for student1 (sample progress)
  const surahs = await prisma.surah.findMany({ select: { id: true, number: true } });
  const surahMap = new Map(surahs.map((s) => [s.number, s.id]));
  await prisma.revisionSchedule.createMany({
    data: [
      {
        userId: student1.id,
        surahId: surahMap.get(1)!,
        scheduledFor: new Date(Date.now() + 86400000),
        status: 'PENDING',
      },
      {
        userId: student1.id,
        surahId: surahMap.get(2)!,
        scheduledFor: new Date('2026-05-10T00:00:00Z'),
        status: 'PENDING',
      },
      {
        userId: student1.id,
        surahId: surahMap.get(3)!,
        scheduledFor: new Date(Date.now() + 86400000 * 3),
        status: 'PENDING',
      },
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
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n  Seed passwords (override via SEED_*_PASSWORD env vars):`);
    console.log(`    Admin    → ${ADMIN_PASSWORD}`);
    console.log(`    Teacher  → ${TEACHER_PASSWORD}`);
    console.log(`    Student  → ${STUDENT_PASSWORD}`);
  } else {
    console.log(`\n  Production seed complete. Passwords set via SEED_*_PASSWORD env vars.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
