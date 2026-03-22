"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessorService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const archiver_1 = __importDefault(require("archiver"));
const uuid_1 = require("uuid");
const google_drive_service_1 = require("./google-drive.service");
const gemini_service_1 = require("./gemini.service");
class ProcessorService {
    driveService;
    geminiService;
    baseTempDir;
    constructor(driveService, geminiService) {
        this.driveService = driveService;
        this.geminiService = geminiService;
        this.baseTempDir = path_1.default.join(process.cwd(), 'temp_processing');
        if (!fs_1.default.existsSync(this.baseTempDir))
            fs_1.default.mkdirSync(this.baseTempDir);
    }
    sendSSE(res, data) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    async processDrive(folderLink, res) {
        const sessionId = (0, uuid_1.v4)();
        const sessionDir = path_1.default.join(this.baseTempDir, sessionId);
        const outputDir = path_1.default.join(sessionDir, 'output');
        const tempDownloadDir = path_1.default.join(sessionDir, 'temp');
        fs_1.default.mkdirSync(outputDir, { recursive: true });
        fs_1.default.mkdirSync(tempDownloadDir, { recursive: true });
        try {
            this.sendSSE(res, { step: 'init', status: '🔍 Analizuję link do Google Drive...' });
            const folderId = this.driveService.extractFolderId(folderLink);
            if (!folderId)
                throw new Error('Niepoprawny link do folderu Google Drive');
            const subfolders = await this.driveService.listSubfolders(folderId);
            if (subfolders.length === 0)
                throw new Error('Nie znaleziono podfolderów produktów w tym folderze');
            this.sendSSE(res, {
                step: 'scan',
                status: `Znalazłem ${subfolders.length} produktów do przetworzenia`,
                total: subfolders.length,
                products: subfolders.map(f => f.name || 'Bez nazwy')
            });
            let totalProcessed = 0;
            for (const [index, folder] of subfolders.entries()) {
                const productName = folder.name || `Produkt_${index + 1}`;
                const productSafeName = productName.replace(/[^\w\s-]/g, '').trim() || 'product';
                const currentNum = index + 1;
                this.sendSSE(res, {
                    step: 'processing',
                    product: productName,
                    status: 'Pobieranie zdjęć z Drive...',
                    current: currentNum,
                    total: subfolders.length
                });
                const images = await this.driveService.listImagesInFolder(folder.id);
                const localImages = [];
                const productTempDir = path_1.default.join(tempDownloadDir, productSafeName);
                fs_1.default.mkdirSync(productTempDir, { recursive: true });
                for (const img of images.slice(0, 5)) {
                    const localPath = path_1.default.join(productTempDir, img.name);
                    const success = await this.driveService.downloadFile(img.id, localPath);
                    if (success)
                        localImages.push(localPath);
                }
                if (localImages.length === 0) {
                    this.sendSSE(res, { step: 'error', product: productName, error: 'Brak zdjęć w folderze' });
                    continue;
                }
                this.sendSSE(res, { step: 'processing', product: productName, status: 'AI analizuje produkt...', current: currentNum, total: subfolders.length });
                const prompts = await this.geminiService.generatePrompts(productName, localImages);
                const previewImages = [];
                for (let i = 0; i < 4; i++) {
                    const prompt = prompts[i] || `Professional product photography of ${productName}, studio lighting, 8k`;
                    const fileName = `${productSafeName}_v${i + 1}.png`;
                    const outputPath = path_1.default.join(outputDir, fileName);
                    this.sendSSE(res, {
                        step: 'processing',
                        product: productName,
                        status: `Generowanie kreacji ${i + 1}/4...`,
                        current: currentNum,
                        total: subfolders.length
                    });
                    const success = await this.geminiService.generateImage(prompt, localImages, outputPath);
                    if (success && fs_1.default.existsSync(outputPath)) {
                        const b64 = fs_1.default.readFileSync(outputPath, { encoding: 'base64' });
                        previewImages.push(b64);
                    }
                }
                this.sendSSE(res, {
                    step: 'complete',
                    product: productName,
                    preview_images: previewImages
                });
                totalProcessed++;
            }
            await this.finalizeAndSendZip(res, outputDir, sessionId, totalProcessed);
        }
        catch (error) {
            console.error('❌ Błąd procesora:', error);
            this.sendSSE(res, { step: 'error', error: error.message });
        }
        finally {
            res.end();
        }
    }
    async processCustom(prompt, files, res) {
        const sessionId = (0, uuid_1.v4)();
        const sessionDir = path_1.default.join(this.baseTempDir, sessionId);
        const outputDir = path_1.default.join(sessionDir, 'output');
        fs_1.default.mkdirSync(outputDir, { recursive: true });
        try {
            this.sendSSE(res, { step: 'init', status: '🚀 Rozpoczynam generowanie własnej sceny...' });
            const localImages = [];
            if (files && files.length > 0) {
                const tempUploadDir = path_1.default.join(sessionDir, 'uploads');
                fs_1.default.mkdirSync(tempUploadDir, { recursive: true });
                for (const file of files) {
                    const localPath = path_1.default.join(tempUploadDir, file.originalname);
                    fs_1.default.writeFileSync(localPath, file.buffer);
                    localImages.push(localPath);
                }
            }
            this.sendSSE(res, {
                step: 'scan',
                status: `Przetwarzanie własnego promptu`,
                total: 1,
                products: ['Twoja Scena']
            });
            const productName = "Custom Scene";
            const previewImages = [];
            for (let i = 0; i < 4; i++) {
                const fileName = `custom_v${i + 1}.png`;
                const outputPath = path_1.default.join(outputDir, fileName);
                this.sendSSE(res, {
                    step: 'processing',
                    product: productName,
                    status: `Generowanie kreacji ${i + 1}/4...`,
                    current: 1,
                    total: 1
                });
                const success = await this.geminiService.generateImage(prompt, localImages, outputPath);
                if (success && fs_1.default.existsSync(outputPath)) {
                    const b64 = fs_1.default.readFileSync(outputPath, { encoding: 'base64' });
                    previewImages.push(b64);
                }
            }
            this.sendSSE(res, { step: 'complete', product: productName, preview_images: previewImages });
            await this.finalizeAndSendZip(res, outputDir, sessionId, 1);
        }
        catch (error) {
            this.sendSSE(res, { step: 'error', error: error.message });
        }
        finally {
            res.end();
        }
    }
    async finalizeAndSendZip(res, outputDir, sessionId, total) {
        this.sendSSE(res, { step: 'packaging', status: '🎁 Pakowanie do ZIP...' });
        const zipFileName = `creations_${sessionId}.zip`;
        const zipPath = path_1.default.join(this.baseTempDir, zipFileName);
        const output = fs_1.default.createWriteStream(zipPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        return new Promise((resolve, reject) => {
            output.on('close', () => {
                this.sendSSE(res, {
                    step: 'done',
                    total_processed: total,
                    download_url: `/api/download/${zipFileName}`
                });
                resolve();
            });
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.directory(outputDir, false);
            archive.finalize();
        });
    }
    async getZipPath(filename) {
        const filePath = path_1.default.join(this.baseTempDir, filename);
        return fs_1.default.existsSync(filePath) ? filePath : null;
    }
}
exports.ProcessorService = ProcessorService;
//# sourceMappingURL=processor.service.js.map