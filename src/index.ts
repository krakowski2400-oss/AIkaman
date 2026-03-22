import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { GoogleDriveService } from './services/google-drive.service';
import { GeminiService } from './services/gemini.service';
import { ProcessorService } from './services/processor.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer();

// Inicjalizacja usług
const driveService = new GoogleDriveService(process.env.GOOGLE_API_KEY || '');
const geminiService = new GeminiService(process.env.GEMINI_KEY || '');
const processorService = new ProcessorService(driveService, geminiService);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- TRASY API ---

app.post('/api/process', async (req: Request, res: Response) => {
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

app.post('/api/process-custom', upload.any(), async (req: Request, res: Response) => {
  const { prompt } = req.body;
  const files = req.files as Express.Multer.File[];
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (!prompt) {
    res.write(`data: ${JSON.stringify({ error: 'Brak promptu' })}\n\n`);
    return res.end();
  }
  await processorService.processCustom(prompt, files, res);
});

app.get('/api/download/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = await processorService.getZipPath(filename as string);
  if (filePath) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Plik nie został znaleziony' });
  }
});

// Serwowanie frontendu
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Błędy
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Błąd aplikacji:', err.stack);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Wystąpił błąd serwera' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Serwer (Node.js/Express) pomyślnie uruchomiony!`);
    console.log(`👉 Wejdź na: http://localhost:${PORT}`);
});
