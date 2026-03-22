"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const google_drive_service_1 = require("../services/google-drive.service");
const gemini_service_1 = require("../services/gemini.service");
const processor_service_1 = require("../services/processor.service");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)(); // Do obsługi przesyłania plików w pamięci RAM
// Inicjalizacja usług (pobieranie kluczy z .env)
const driveService = new google_drive_service_1.GoogleDriveService(process.env.GOOGLE_API_KEY || '');
const geminiService = new gemini_service_1.GeminiService(process.env.GEMINI_KEY || '');
const processorService = new processor_service_1.ProcessorService(driveService, geminiService);
/**
 * Endpoint dla Google Drive (SSE)
 */
router.post('/process', async (req, res) => {
    const { folder_link } = req.body;
    // Nagłówki dla Server-Sent Events (SSE) - kluczowe dla paska postępu
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!folder_link) {
        res.write(`data: ${JSON.stringify({ error: 'Brak linku do folderu' })}\n\n`);
        return res.end();
    }
    await processorService.processDrive(folder_link, res);
});
/**
 * Endpoint dla trybu Custom Prompt (SSE + Upload)
 */
router.post('/process-custom', upload.any(), async (req, res) => {
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
/**
 * Pobieranie gotowego pliku ZIP
 */
router.get('/download/:filename', async (req, res) => {
    const { filename } = req.params;
    const filePath = await processorService.getZipPath(filename);
    if (filePath) {
        res.download(filePath);
    }
    else {
        res.status(404).json({ error: 'Plik nie został znaleziony lub wygasł' });
    }
});
exports.default = router;
//# sourceMappingURL=api.js.map