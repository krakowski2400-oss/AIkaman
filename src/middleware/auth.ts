import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    pin: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Brak tokenu autoryzacyjnego' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string, pin: string };
    
    // Weryfikacja czy użytkownik nadal istnieje w bazie
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    
    if (!user) {
      res.status(403).json({ error: 'Nieprawidłowy token lub użytkownik nie istnieje' });
      return;
    }

    req.user = { id: user.id, pin: user.pin };
    next();
  } catch (err) {
    res.status(403).json({ error: 'Nieprawidłowy lub wygasły token' });
    return;
  }
};