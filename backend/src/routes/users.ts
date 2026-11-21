import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  addOrUpdateMotorcycle,
  deleteMotorcycle,
  getUserMotorcycles,
  getUserProfile,
  setPrimaryMotorcycle,
  updateUserProfile,
  getPublicUserProfile,
} from '../services/userService';

export const userRoutes = Router();

userRoutes.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.userId!);
    if (!profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }
    const motorcycles = await getUserMotorcycles(req.userId!);
    res.json({ profile, motorcycles });
  } catch (err) {
    console.error('Failed to fetch user profile', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

userRoutes.patch('/me', requireAuth, async (req, res) => {
  try {
    const updated = await updateUserProfile(req.userId!, req.body);
    res.json({ profile: updated });
  } catch (err) {
    console.error('Failed to update user profile', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

userRoutes.get('/me/motorcycles', requireAuth, async (req, res) => {
  try {
    const motorcycles = await getUserMotorcycles(req.userId!);
    res.json({ motorcycles });
  } catch (err) {
    console.error('Failed to fetch motorcycles', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

userRoutes.post('/me/motorcycles', requireAuth, async (req, res) => {
  try {
    const bike = await addOrUpdateMotorcycle(req.userId!, req.body);
    res.status(201).json({ motorcycle: bike });
  } catch (err) {
    console.error('Failed to add motorcycle', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

userRoutes.delete('/me/motorcycles/:id', requireAuth, async (req, res) => {
  try {
    const bikeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = await deleteMotorcycle(req.userId!, bikeId);
    if (!success) {
      res.status(404).json({ error: 'Motorcycle not found' });
      return;
    }
    res.json({ message: 'Motorcycle deleted' });
  } catch (err) {
    console.error('Failed to delete motorcycle', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

userRoutes.post('/me/motorcycles/:id/primary', requireAuth, async (req, res) => {
  try {
    const bikeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bike = await setPrimaryMotorcycle(req.userId!, bikeId);
    if (!bike) {
      res.status(404).json({ error: 'Motorcycle not found' });
      return;
    }
    res.json({ motorcycle: bike });
  } catch (err) {
    console.error('Failed to set primary motorcycle', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

userRoutes.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await getPublicUserProfile(userId);
    if (!data) {
      res.status(404).json({ error: 'User not found or profile is hidden' });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch public user profile', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
