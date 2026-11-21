import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  createReminder,
  deleteReminder,
  getUserReminders,
  renewReminder,
} from '../services/reminderService';

const createReminderSchema = z.object({
  motorcycleId: z.string().uuid().optional().nullable(),
  type: z.enum(['TUVTURK_INSPECTION', 'TRAFFIC_INSURANCE', 'KASKO', 'CUSTOM']),
  title: z.string().min(1).optional(),
  lastCompletedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  validityMonths: z.number().int().positive().optional(),
  notes: z.string().optional().nullable(),
});

const renewReminderSchema = z.object({
  newLastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
});

export const reminderRoutes = Router();
reminderRoutes.use(requireAuth);

// GET all active reminders for current user
reminderRoutes.get('/', async (req, res) => {
  try {
    const reminders = await getUserReminders(req.userId!);
    res.json(reminders);
  } catch (err) {
    console.error('Failed to get reminders', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST create new reminder
reminderRoutes.post('/', async (req, res) => {
  const parsed = createReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  try {
    const reminder = await createReminder(req.userId!, parsed.data);
    res.status(201).json(reminder);
  } catch (err) {
    console.error('Failed to create reminder', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT renew a reminder
reminderRoutes.put('/:id/renew', async (req, res) => {
  const parsed = renewReminderSchema.safeParse(req.body);
  const newDate = parsed.success ? parsed.data.newLastDate : undefined;

  try {
    const renewed = await renewReminder(req.userId!, req.params.id, newDate);
    if (!renewed) {
      res.status(404).json({ message: 'Reminder not found' });
      return;
    }
    res.json(renewed);
  } catch (err) {
    console.error('Failed to renew reminder', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a reminder
reminderRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteReminder(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Reminder not found' });
      return;
    }
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    console.error('Failed to delete reminder', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
