import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    req.userId = verifyAuthToken(token).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
