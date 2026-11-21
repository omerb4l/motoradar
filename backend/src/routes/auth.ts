import { Router } from 'express';
import { z } from 'zod';
import { AuthError, getUserById, login, signup } from '../services/authService';
import { requireAuth } from '../middleware/auth';

export const authRoutes = Router();

const signupSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'letters, numbers, underscore only'),
  email: z.string().email(),
  password: z.string().min(8).max(72), // bcrypt truncates beyond 72 bytes
});

authRoutes.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid signup payload', issues: parsed.error.issues });
    return;
  }

  try {
    const { user, token } = await signup(parsed.data);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Signup failed', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid login payload', issues: parsed.error.issues });
    return;
  }

  try {
    const { user, token } = await login(parsed.data);
    res.json({ user, token });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Login failed', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

authRoutes.get('/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user });
});
