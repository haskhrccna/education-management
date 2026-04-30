import { AppointmentStatus } from '../enums/appointmentStatus';

export interface Appointment {
  id: string;
  studentId: string;
  teacherId: string;
  requestedDate: string;
  requestedTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  amendedNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentInput {
  teacherId: string;
  requestedDate: string;
  requestedTime: string;
  durationMinutes?: number;
}

export interface AmendAppointmentInput {
  status: AppointmentStatus.ACCEPTED | AppointmentStatus.AMENDED | AppointmentStatus.REJECTED;
  amendedNote?: string;
}
