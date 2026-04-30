import { Request, Response, NextFunction } from 'express';
import * as appointmentService from '../services/appointment.service';
import { AppError } from '../middleware/error.middleware';

export const createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teacherId, requestedDate, requestedTime, durationMinutes } = req.body as any;
    if (!teacherId || !requestedDate || !requestedTime) {
      throw new AppError(400, 'teacherId, requestedDate, and requestedTime are required');
    }
    const appointment = await appointmentService.createAppointment(
      req.userId!, teacherId, String(requestedDate), String(requestedTime), durationMinutes || 60
    );
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
};

export const getMyAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = String(req.userRole).toUpperCase() as 'STUDENT' | 'TEACHER' | 'ADMIN';
    const appointments = await appointmentService.getMyAppointments(req.userId!, role);
    res.json(appointments);
  } catch (err) {
    next(err);
  }
};

export const manageAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const appointmentId = String(req.params.id);
    const body = req.body as any;
    const appointment = await appointmentService.manageAppointment(
      appointmentId, req.userId!, String(req.userRole), body.action, body.amendedNote
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
};
