import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { pin } = req.body;

  if (!pin) {
    res.status(400).json({ error: 'Podaj kod PIN' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { pin }
    });

    if (!user) {
      res.status(401).json({ error: 'Nieprawidłowy kod PIN' });
      return;
    }

    // Generujemy JWT po pomyślnym zalogowaniu PINem
    const token = jwt.sign(
      { id: user.id, pin: user.pin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, dailyLimit: user.dailyLimit, usedToday: user.usedToday } });
  } catch (error) {
    console.error('Błąd logowania:', error);
    res.status(500).json({ error: 'Błąd serwera podczas autoryzacji' });
  }
});