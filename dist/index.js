"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("./routes/auth");
const api_1 = require("./routes/api");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serwowanie plików statycznych frontendu
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
// Ścieżki autoryzacji i logowania
app.use('/api/auth', auth_1.authRouter);
// Główne ścieżki generowania i API
app.use('/api', api_1.apiRouter);
// Główna strona aplikacji (fallback dla SPA - obsłuży wszystko co nie jest API)
app.use((req, res) => {
    res.sendFile(path_1.default.join(process.cwd(), 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
