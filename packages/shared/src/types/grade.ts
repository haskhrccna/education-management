import { GradeType } from '../enums/gradeType';

export interface SurahSummary {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
}

export interface Grade {
  id: string;
  studentId: string;
  teacherId: string;
  surahId: number | null;
  surah: SurahSummary | null;
  grade: string;
  type: GradeType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGradeInput {
  studentId: string;
  surahId: number | null;
  grade: string;
  type: GradeType;
  notes?: string;
}
