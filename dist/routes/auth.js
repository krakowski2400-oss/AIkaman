"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../services/db");
exports.authRouter = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
exports.authRouter.post('/login', async (req, res) => {
    const { pin } = req.body;
    if (!pin) {
        res.status(400).json({ error: 'Podaj kod PIN' });
        return;
    }
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { pin }
        });
        if (!user) {
            res.status(401).json({ error: 'Nieprawidłowy kod PIN' });
            return;
        }
        // Generujemy JWT po pomyślnym zalogowaniu PINem
        const token = jsonwebtoken_1.default.sign({ id: user.id, pin: user.pin }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, dailyLimit: user.dailyLimit, usedToday: user.usedToday } });
    }
    catch (error) {
        console.error('Błąd logowania:', error);
        res.status(500).json({ error: 'Błąd serwera podczas autoryzacji' });
    }
});
