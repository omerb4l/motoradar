import { Router } from 'express';
import { pingDb } from '../config/db';
import { authRoutes } from './auth';
import { userRoutes } from './users';
import { rendezvousRoutes } from './rendezvous';
import { chatRoutes } from './chats';
import { reportsRouter } from './reports';
import { fuelLogRoutes } from './fuelLogs';
import { albumRoutes } from './album';
import { reminderRoutes } from './reminders';
import { rideRoutes } from './rides';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/users', userRoutes);
routes.use('/rendezvous', rendezvousRoutes);
routes.use('/chats', chatRoutes);
routes.use('/reports', reportsRouter);
routes.use('/fuel-logs', fuelLogRoutes);
routes.use('/album', albumRoutes);
routes.use('/reminders', reminderRoutes);
routes.use('/rides', rideRoutes);

routes.get('/health', async (_req, res) => {
  const dbOk = await pingDb();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

