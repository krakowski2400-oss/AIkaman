"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const api_1 = __importDefault(require("./routes/api"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware (podstawowa konfiguracja bezpieczeństwa i parserów)
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serwowanie tras API
app.use('/api', api_1.default);
// Serwowanie Twoich starych plików HTML, CSS i JS z folderu public
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Prosta obsługa błędów, aby serwer się nie wyłączał po byle problemie
app.use((err, req, res, next) => {
    console.error('Błąd aplikacji:', err.stack);
    res.status(500).json({ error: 'Coś poszło nie tak na serwerze!' });
});
// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`🚀 Serwer (Node.js/Express) pomyślnie uruchomiony!`);
    console.log(`👉 Wejdź na: http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map