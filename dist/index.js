"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const google_drive_service_1 = require("./services/google-drive.service");
const gemini_service_1 = require("./services/gemini.service");
const processor_service_1 = require("./services/processor.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const upload = (0, multer_1.default)();
// Inicjalizacja usług
const driveService = new google_drive_service_1.GoogleDriveService(process.env.GOOGLE_API_KEY || '');
const geminiService = new gemini_service_1.GeminiService(process.env.GEMINI_KEY || '');
const processorService = new processor_service_1.ProcessorService(driveService, geminiService);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// --- TRASY API ---
app.post('/api/process', async (req, res) => {
    const { folder_link } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!folder_link) {
        res.write(`data: ${JSON.stringify({ error: 'Brak linku do folderu' })}\n\n`);
        return res.end();
    }
    await processorService.processDrive(folder_link, res);
});
app.post('/api/process-custom', upload.any(), async (req, res) => {
    const { prompt } = req.body;
    const files = req.files;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!prompt) {
        res.write(`data: ${JSON.stringify({ error: 'Brak promptu' })}\n\n`);
        return res.end();
    }
    await processorService.processCustom(prompt, files, res);
});
app.get('/api/download/:filename', async (req, res) => {
    const { filename } = req.params;
    const filePath = await processorService.getZipPath(filename);
    if (filePath) {
        res.download(filePath);
    }
    else {
        res.status(404).json({ error: 'Plik nie został znaleziony' });
    }
});
// Serwowanie frontendu
const publicPath = path_1.default.join(process.cwd(), 'public');
app.use(express_1.default.static(publicPath));
// Błędy
app.use((err, req, res, next) => {
    console.error('Błąd aplikacji:', err.stack);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Wystąpił błąd serwera' });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Serwer (Node.js/Express) pomyślnie uruchomiony!`);
    console.log(`👉 Wejdź na: http://localhost:${PORT}`);
});
