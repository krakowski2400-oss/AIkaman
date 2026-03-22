import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GoogleDriveService } from '../services/google-drive.service';
import { GeminiService } from '../services/gemini.service';
import { ProcessorService } from '../services/processor.service';

const router = Router();
const upload = multer();

const driveService = new GoogleDriveService(process.env.GOOGLE_API_KEY || '');
const geminiService = new GeminiService(process.env.GEMINI_KEY || '');
const processorService = new ProcessorService(driveService, geminiService);

router.post('/process', async (req: Request, res: Response) => {
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

router.post('/process-custom', upload.any(), async (req: Request, res: Response) => {
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

router.get('/download/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  const filePath = await processorService.getZipPath(filename);
  if (filePath) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Plik nie został znaleziony lub wygasł' });
  }
});

// Używamy eksportu nazwanego zamiast default/module.exports dla pewności
export { router as apiRoutes };
