import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { 
  addFuelLog, 
  deleteFuelLog, 
  getFuelLogsForUser, 
  getLiveFuelPrices 
} from '../services/fuelLogService';

const addFuelLogSchema = z.object({
  liters: z.number().positive(),
  cost: z.number().positive(),
  stationBrand: z.string().optional(),
  odometerKm: z.number().nonnegative().optional(),
  motorcycleId: z.string().uuid().optional(),
});

export const fuelLogRoutes = Router();
fuelLogRoutes.use(requireAuth);

fuelLogRoutes.get('/', async (req, res) => {
  try {
    const summary = await getFuelLogsForUser(req.userId!);
    res.json(summary);
  } catch (err) {
    console.error('Failed to get fuel logs', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

fuelLogRoutes.get('/prices', async (_req, res) => {
  try {
    const prices = getLiveFuelPrices();
    res.json(prices);
  } catch (err) {
    console.error('Failed to get fuel prices', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

fuelLogRoutes.post('/', async (req, res) => {
  const parsed = addFuelLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  try {
    const log = await addFuelLog(req.userId!, parsed.data);
    res.status(201).json(log);
  } catch (err) {
    console.error('Failed to add fuel log', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

fuelLogRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteFuelLog(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Log not found' });
      return;
    }
    res.json({ message: 'Log deleted' });
  } catch (err) {
    console.error('Failed to delete fuel log', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
