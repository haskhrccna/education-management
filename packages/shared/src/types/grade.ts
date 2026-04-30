import { GradeType } from '../enums/gradeType';

export interface Grade {
  id: string;
  studentId: string;
  teacherId: string;
  subject: string;
  grade: string;
  type: GradeType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGradeInput {
  studentId: string;
  subject: string;
  grade: string;
  type: GradeType;
  notes?: string;
}
