import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  createRide,
  deleteRide,
  getRideDetails,
  getUserRides,
} from '../services/rideService';

const routePointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  speedKmh: z.number(),
  gForce: z.number().optional(),
  leanDeg: z.number().optional(),
  timestamp: z.number(),
});

const createRideSchema = z.object({
  motorcycleId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  distanceKm: z.number().nonnegative(),
  durationSec: z.number().int().nonnegative(),
  avgSpeedKmh: z.number().nonnegative(),
  maxSpeedKmh: z.number().nonnegative(),
  maxLeanLeftDeg: z.number().nonnegative().optional(),
  maxLeanRightDeg: z.number().nonnegative().optional(),
  maxGForce: z.number().nonnegative().optional(),
  elevationGainM: z.number().optional(),
  routeCoordinates: z.array(routePointSchema).optional(),
});

export const rideRoutes = Router();
rideRoutes.use(requireAuth);

// GET all past rides for current user
rideRoutes.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const rides = await getUserRides(req.userId!, limit, offset);
    res.json(rides);
  } catch (err) {
    console.error('Failed to get rides', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET single ride details
rideRoutes.get('/:id', async (req, res) => {
  try {
    const ride = await getRideDetails(req.userId!, req.params.id);
    if (!ride) {
      res.status(404).json({ message: 'Ride not found' });
      return;
    }
    res.json(ride);
  } catch (err) {
    console.error('Failed to get ride details', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST save completed ride
rideRoutes.post('/', async (req, res) => {
  const parsed = createRideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  try {
    const ride = await createRide(req.userId!, parsed.data);
    res.status(201).json(ride);
  } catch (err) {
    console.error('Failed to create ride summary', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE ride
rideRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteRide(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Ride not found' });
      return;
    }
    res.json({ message: 'Ride deleted' });
  } catch (err) {
    console.error('Failed to delete ride', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
