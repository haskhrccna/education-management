export interface Report {
  id: string;
  teacherId: string;
  studentId: string;
  pdfUrl: string;
  generatedAt: Date;
  summary: string;
}

export interface GenerateReportInput {
  teacherId: string;
  studentId: string;
  summary: string;
}
