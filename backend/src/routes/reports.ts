import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { createReport } from '../services/reportService';
import { updateRendezvousStatus } from '../services/rendezvousService';

export const reportsRouter = Router();

const reportSchema = z.object({
  reportedId: z.string().uuid(),
  rendezvousId: z.string().uuid().optional(),
  reason: z.string(),
  details: z.string().optional(),
});

reportsRouter.post('/', requireAuth, async (req, res) => {
  try {
    const parsed = reportSchema.parse(req.body);
    
    const report = await createReport({
      reporterId: req.userId!,
      ...parsed,
    });

    // If there is an associated rendezvous, mark it as CANCELLED or COMPLETED based on reason?
    // The user requested that we cancel the rendezvous when a report is filed for "no-show".
    if (parsed.rendezvousId) {
      await updateRendezvousStatus(parsed.rendezvousId, 'CANCELLED');
    }

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Failed to create report', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});
