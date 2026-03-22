import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { GoogleDriveService } from './google-drive.service';
import { GeminiService } from './gemini.service';

export class ProcessorService {
  private driveService: GoogleDriveService;
  private geminiService: GeminiService;
  private baseTempDir: string;

  constructor(driveService: GoogleDriveService, geminiService: GeminiService) {
    this.driveService = driveService;
    this.geminiService = geminiService;
    this.baseTempDir = path.join(process.cwd(), 'temp_processing');
    if (!fs.existsSync(this.baseTempDir)) fs.mkdirSync(this.baseTempDir);
  }

  private sendSSE(res: Response, data: any) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  async processDrive(folderLink: string, res: Response) {
    const sessionId = uuidv4();
    const sessionDir = path.join(this.baseTempDir, sessionId);
    const outputDir = path.join(sessionDir, 'output');
    const tempDownloadDir = path.join(sessionDir, 'temp');
    
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(tempDownloadDir, { recursive: true });

    try {
      this.sendSSE(res, { step: 'init', status: '🔍 Analizuję link do Google Drive...' });
      const folderId = this.driveService.extractFolderId(folderLink);
      if (!folderId) throw new Error('Niepoprawny link do folderu Google Drive');

      const subfolders = await this.driveService.listSubfolders(folderId);
      if (subfolders.length === 0) throw new Error('Nie znaleziono podfolderów produktów w tym folderze');

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

        const images = await this.driveService.listImagesInFolder(folder.id!);
        const localImages: string[] = [];
        const productTempDir = path.join(tempDownloadDir, productSafeName);
        fs.mkdirSync(productTempDir, { recursive: true });

        for (const img of images.slice(0, 5)) {
          const localPath = path.join(productTempDir, img.name!);
          const success = await this.driveService.downloadFile(img.id!, localPath);
          if (success) localImages.push(localPath);
        }

        if (localImages.length === 0) {
           this.sendSSE(res, { step: 'error', product: productName, error: 'Brak zdjęć w folderze' });
           continue;
        }

        this.sendSSE(res, { step: 'processing', product: productName, status: 'AI analizuje produkt...', current: currentNum, total: subfolders.length });
        const prompts = await this.geminiService.generatePrompts(productName, localImages);

        const previewImages: string[] = [];
        for (let i = 0; i < 4; i++) {
          const prompt = prompts[i] || `Professional product photography of ${productName}, studio lighting, 8k`;
          const fileName = `${productSafeName}_v${i + 1}.png`;
          const outputPath = path.join(outputDir, fileName);

          this.sendSSE(res, { 
            step: 'processing', 
            product: productName, 
            status: `Generowanie kreacji ${i + 1}/4...`, 
            current: currentNum, 
            total: subfolders.length 
          });

          const success = await this.geminiService.generateImage(prompt, localImages, outputPath);
          if (success && fs.existsSync(outputPath)) {
            const b64 = fs.readFileSync(outputPath, { encoding: 'base64' });
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

    } catch (error: any) {
      console.error('❌ Błąd procesora:', error);
      this.sendSSE(res, { step: 'error', error: error.message });
    } finally {
      res.end();
    }
  }

  async processCustom(prompt: string, files: Express.Multer.File[], res: Response) {
    const sessionId = uuidv4();
    const sessionDir = path.join(this.baseTempDir, sessionId);
    const outputDir = path.join(sessionDir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      this.sendSSE(res, { step: 'init', status: '🚀 Rozpoczynam generowanie własnej sceny...' });
      
      const localImages: string[] = [];
      if (files && files.length > 0) {
        const tempUploadDir = path.join(sessionDir, 'uploads');
        fs.mkdirSync(tempUploadDir, { recursive: true });
        for (const file of files) {
          const localPath = path.join(tempUploadDir, file.originalname);
          fs.writeFileSync(localPath, file.buffer);
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
      const previewImages: string[] = [];
      
      for (let i = 0; i < 4; i++) {
        const fileName = `custom_v${i + 1}.png`;
        const outputPath = path.join(outputDir, fileName);

        this.sendSSE(res, { 
          step: 'processing', 
          product: productName, 
          status: `Generowanie kreacji ${i + 1}/4...`, 
          current: 1, 
          total: 1 
        });

        const success = await this.geminiService.generateImage(prompt, localImages, outputPath);
        if (success && fs.existsSync(outputPath)) {
          const b64 = fs.readFileSync(outputPath, { encoding: 'base64' });
          previewImages.push(b64);
        }
      }

      this.sendSSE(res, { step: 'complete', product: productName, preview_images: previewImages });
      await this.finalizeAndSendZip(res, outputDir, sessionId, 1);

    } catch (error: any) {
      this.sendSSE(res, { step: 'error', error: error.message });
    } finally {
      res.end();
    }
  }

  private async finalizeAndSendZip(res: Response, outputDir: string, sessionId: string, total: number) {
    this.sendSSE(res, { step: 'packaging', status: '🎁 Pakowanie do ZIP...' });
    
    const zipFileName = `creations_${sessionId}.zip`;
    const zipPath = path.join(this.baseTempDir, zipFileName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise<void>((resolve, reject) => {
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

  async getZipPath(filename: string): Promise<string | null> {
    const filePath = path.join(this.baseTempDir, filename);
    return fs.existsSync(filePath) ? filePath : null;
  }
}
