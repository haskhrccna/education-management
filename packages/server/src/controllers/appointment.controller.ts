import { Request, Response, NextFunction } from 'express';
import * as appointmentService from '../services/appointment.service';

export const createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teacherId, requestedDate, requestedTime, durationMinutes } = req.body;
    const appointment = await appointmentService.createAppointment(
      req.userId!,
      teacherId,
      String(requestedDate),
      String(requestedTime),
      durationMinutes || 60
    );
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
};

export const getMyAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.userRole as 'STUDENT' | 'TEACHER' | 'ADMIN';
    const appointments = await appointmentService.getMyAppointments(req.userId!, role);
    res.json(appointments);
  } catch (err) {
    next(err);
  }
};

export const manageAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const appointmentId = String(req.params.id);
    const { action, amendedNote } = req.body;
    const appointment = await appointmentService.manageAppointment(
      appointmentId,
      req.userId!,
      String(req.userRole),
      action,
      amendedNote
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
};
