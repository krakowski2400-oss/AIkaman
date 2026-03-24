"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../services/db");
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Brak tokenu autoryzacyjnego' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Weryfikacja czy użytkownik nadal istnieje w bazie
        const user = await db_1.prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            res.status(403).json({ error: 'Nieprawidłowy token lub użytkownik nie istnieje' });
            return;
        }
        req.user = { id: user.id, pin: user.pin };
        next();
    }
    catch (err) {
        res.status(403).json({ error: 'Nieprawidłowy lub wygasły token' });
        return;
    }
};
exports.authenticateToken = authenticateToken;
