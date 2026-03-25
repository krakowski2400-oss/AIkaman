"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const archiver_1 = __importDefault(require("archiver"));
const auth_1 = require("../middleware/auth");
const queue_1 = require("../services/queue");
const gemini_1 = require("../services/gemini");
const db_1 = require("../services/db");
exports.apiRouter = (0, express_1.Router)();
// Zrzucanie wgrywanego pliku na dysk tylko na czas przetwarzania
const upload = (0, multer_1.default)({ dest: 'temp_processing/' });
exports.apiRouter.get('/styles', (req, res) => {
    const stylesPath = path_1.default.join(__dirname, '../config/styles.json');
    const styles = JSON.parse(fs_1.default.readFileSync(stylesPath, 'utf-8'));
    res.json(styles);
});
exports.apiRouter.post('/generate', auth_1.authenticateToken, upload.array('images', 5), async (req, res) => {
    const files = req.files;
    const { styleId, customPrompt, aspectRatio = "1:1", resolution = "4K" } = req.body;
    const userId = req.user?.id;
    if (!files || files.length === 0 || !styleId || !userId) {
        return res.status(400).json({ error: 'Brak plików, stylu lub autoryzacji' });
    }
    // Weryfikacja limitów użytkownika
    const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.usedToday >= user.dailyLimit) {
        return res.status(429).json({ error: 'Wykorzystano dzienny limit generacji' });
    }
    // Pobranie limitu za sesję
    await db_1.prisma.user.update({
        where: { id: userId },
        data: { usedToday: user.usedToday + 1 }
    });
    const stylesPath = path_1.default.join(__dirname, '../config/styles.json');
    const styles = JSON.parse(fs_1.default.readFileSync(stylesPath, 'utf-8'));
    const selectedStyle = styles.find((s) => s.id === styleId);
    if (!selectedStyle) {
        return res.status(400).json({ error: 'Nieprawidłowy styl' });
    }
    // Wybór finalnego promptu (jeśli custom, bierzemy tekst od usera)
    const finalPrompt = (styleId === 'custom' && customPrompt) ? customPrompt : selectedStyle.systemPrompt;
    const taskId = crypto_1.default.randomUUID();
    (0, queue_1.initTask)(taskId);
    // Zlecenie do Kolejki
    queue_1.imageQueue.add(async () => {
        try {
            (0, queue_1.updateTask)(taskId, { status: 'processing', progress: 'Inicjalizacja modelu AI...' });
            const filePaths = files.map(f => f.path);
            const resultUrls = await (0, gemini_1.processImageGeneration)(taskId, filePaths, finalPrompt, aspectRatio, resolution, (progressText) => (0, queue_1.updateTask)(taskId, { progress: progressText }));
            // Kasujemy oryginalne wgrane zdjęcia
            filePaths.forEach(p => {
                if (fs_1.default.existsSync(p))
                    fs_1.default.unlinkSync(p);
            });
            // Tworzenie archiwum ZIP
            (0, queue_1.updateTask)(taskId, { progress: 'Pakowanie do archiwum ZIP...' });
            const outputDir = path_1.default.join(process.cwd(), 'output', taskId);
            const zipFileName = `creations_${taskId}.zip`;
            const zipPath = path_1.default.join(outputDir, zipFileName);
            await new Promise((resolve, reject) => {
                const output = fs_1.default.createWriteStream(zipPath);
                const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
                output.on('close', () => resolve());
                archive.on('error', (err) => reject(err));
                archive.pipe(output);
                const filesToZip = fs_1.default.readdirSync(outputDir).filter(f => f.endsWith('.png'));
                for (const file of filesToZip) {
                    archive.file(path_1.default.join(outputDir, file), { name: file });
                }
                archive.finalize();
            });
            const zipUrl = `/api/download/${taskId}/${zipFileName}`;
            (0, queue_1.updateTask)(taskId, { status: 'completed', progress: 'Zakończono sukcesem!', resultUrls, zipUrl });
            // 15-minutowy timer automatycznego zniszczenia sesji w razie porzucenia karty
            setTimeout(() => {
                if (fs_1.default.existsSync(outputDir)) {
                    fs_1.default.rmSync(outputDir, { recursive: true, force: true });
                    queue_1.tasks.delete(taskId);
                }
            }, 15 * 60 * 1000);
        }
        catch (error) {
            console.error(error);
            const filePaths = files.map(f => f.path);
            filePaths.forEach(p => {
                if (fs_1.default.existsSync(p))
                    fs_1.default.unlinkSync(p);
            });
            (0, queue_1.updateTask)(taskId, { status: 'error', error: error.message || 'Błąd', progress: 'Zatrzymano' });
        }
    });
    // Użytkownik dostaje tylko numerek z szatni, idzie słuchać po SSE
    res.status(202).json({ taskId });
});
// Endpoint SSE
exports.apiRouter.get('/stream/:taskId', (req, res) => {
    const { taskId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const task = (0, queue_1.getTask)(taskId);
    if (!task) {
        res.write(`data: ${JSON.stringify({ error: 'Nie znaleziono zadania' })}\n\n`);
        return res.end();
    }
    res.write(`data: ${JSON.stringify(task)}\n\n`);
    const onUpdate = (updatedTask) => {
        res.write(`data: ${JSON.stringify(updatedTask)}\n\n`);
        if (updatedTask.status === 'completed' || updatedTask.status === 'error') {
            res.end();
        }
    };
    const { taskEmitter } = require('../services/queue');
    taskEmitter.on(`task-${taskId}`, onUpdate);
    req.on('close', () => {
        taskEmitter.off(`task-${taskId}`, onUpdate);
    });
});
// Pobieranie wygenerowanych plików (PNG i ZIP)
exports.apiRouter.get('/download/:taskId/:filename', (req, res) => {
    const { taskId, filename } = req.params;
    const filePath = path_1.default.join(process.cwd(), 'output', taskId, filename);
    if (fs_1.default.existsSync(filePath)) {
        res.download(filePath, (err) => {
            // Opcjonalnie: usunięcie ZIP po pobraniu, jeśli chcemy to natychmiastowo obsłużyć
            // if (!err && filename.endsWith('.zip')) {
            //     fs.unlinkSync(filePath);
            // }
        });
    }
    else {
        res.status(404).json({ error: 'Plik usunięty ze względów bezpieczeństwa (wygasł)' });
    }
});
// Wymuszone czyszczenie po pobraniu
exports.apiRouter.delete('/cleanup/:taskId', (req, res) => {
    const { taskId } = req.params;
    const outputDir = path_1.default.join(process.cwd(), 'output', taskId);
    if (fs_1.default.existsSync(outputDir)) {
        fs_1.default.rmSync(outputDir, { recursive: true, force: true });
        queue_1.tasks.delete(taskId);
        res.json({ success: true, message: 'Wyczyszczono obszar roboczy' });
    }
    else {
        res.json({ success: true, message: 'Obszar jest już pusty' });
    }
});
