import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { imageQueue, initTask, updateTask, getTask, tasks } from '../services/queue';
import { processImageGeneration } from '../services/gemini';
import { prisma } from '../services/db';

export const apiRouter = Router();

// Zrzucanie wgrywanego pliku na dysk tylko na czas przetwarzania
const upload = multer({ dest: 'temp_processing/' });

apiRouter.get('/styles', (req, res) => {
  const stylesPath = path.join(process.cwd(), 'src/config/styles.json');
  try {
    const styles = JSON.parse(fs.readFileSync(stylesPath, 'utf-8'));
    res.json(styles);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się załadować stylów' });
  }
});

apiRouter.post('/generate', authenticateToken, upload.array('images', 5), async (req: AuthRequest, res): Promise<any> => {
  const files = req.files as Express.Multer.File[];
  const { styleId, customPrompt, aspectRatio = "1:1", resolution = "4K" } = req.body;
  const userId = req.user?.id;

  if (!files || files.length === 0 || !styleId || !userId) {
    return res.status(400).json({ error: 'Brak plików, stylu lub autoryzacji' });
  }

  // Weryfikacja limitów użytkownika
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.usedToday >= user.dailyLimit) {
    return res.status(429).json({ error: 'Wykorzystano dzienny limit generacji' });
  }

  // Pobranie limitu za sesję
  await prisma.user.update({
    where: { id: userId },
    data: { usedToday: user.usedToday + 1 }
  });

  const stylesPath = path.join(process.cwd(), 'src/config/styles.json');
  const styles = JSON.parse(fs.readFileSync(stylesPath, 'utf-8'));
  const selectedStyle = styles.find((s: any) => s.id === styleId);

  if (!selectedStyle) {
    return res.status(400).json({ error: 'Nieprawidłowy styl' });
  }

  // Wybór finalnego promptu (jeśli custom, bierzemy tekst od usera)
  const finalPrompt = (styleId === 'custom' && customPrompt) ? customPrompt : selectedStyle.systemPrompt;

  const taskId = crypto.randomUUID();
  initTask(taskId);

  // Zlecenie do Kolejki
  imageQueue.add(async () => {
    try {
      updateTask(taskId, { status: 'processing', progress: 'Inicjalizacja modelu AI...' });
      
      const filePaths = files.map(f => f.path);
      const resultUrls = await processImageGeneration(
        taskId, 
        filePaths, 
        finalPrompt, 
        aspectRatio, 
        resolution,
        (progressText) => updateTask(taskId, { progress: progressText })
      );
      
      // Kasujemy oryginalne wgrane zdjęcia
      filePaths.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });

      // Tworzenie archiwum ZIP
      updateTask(taskId, { progress: 'Pakowanie do archiwum ZIP...' });
      const outputDir = path.join(process.cwd(), 'output', taskId);
      const zipFileName = `creations_${taskId}.zip`;
      const zipPath = path.join(outputDir, zipFileName);
      
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        
        const filesToZip = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
        for (const file of filesToZip) {
          archive.file(path.join(outputDir, file), { name: file });
        }
        
        archive.finalize();
      });

      const zipUrl = `/api/download/${taskId}/${zipFileName}`;
      updateTask(taskId, { status: 'completed', progress: 'Zakończono sukcesem!', resultUrls, zipUrl });
      
      // 15-minutowy timer automatycznego zniszczenia sesji w razie porzucenia karty
      setTimeout(() => {
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
          tasks.delete(taskId);
        }
      }, 15 * 60 * 1000);

    } catch (error: any) {
      console.error(error);
      const filePaths = files.map(f => f.path);
      filePaths.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      updateTask(taskId, { status: 'error', error: error.message || 'Błąd', progress: 'Zatrzymano' });
    }
  });

  // Użytkownik dostaje tylko numerek z szatni, idzie słuchać po SSE
  res.status(202).json({ taskId });
});

// Endpoint SSE
apiRouter.get('/stream/:taskId', (req, res) => {
  const { taskId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const task = getTask(taskId);
  if (!task) {
    res.write(`data: ${JSON.stringify({ error: 'Nie znaleziono zadania' })}\n\n`);
    return res.end();
  }

  res.write(`data: ${JSON.stringify(task)}\n\n`);

  const onUpdate = (updatedTask: any) => {
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
apiRouter.get('/download/:taskId/:filename', (req, res) => {
  const { taskId, filename } = req.params;
  const filePath = path.join(process.cwd(), 'output', taskId, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
        // Opcjonalnie: usunięcie ZIP po pobraniu, jeśli chcemy to natychmiastowo obsłużyć
        // if (!err && filename.endsWith('.zip')) {
        //     fs.unlinkSync(filePath);
        // }
    });
  } else {
    res.status(404).json({ error: 'Plik usunięty ze względów bezpieczeństwa (wygasł)' });
  }
});

// Wymuszone czyszczenie po pobraniu
apiRouter.delete('/cleanup/:taskId', (req, res) => {
  const { taskId } = req.params;
  const outputDir = path.join(process.cwd(), 'output', taskId);
  
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
    tasks.delete(taskId);
    res.json({ success: true, message: 'Wyczyszczono obszar roboczy' });
  } else {
    res.json({ success: true, message: 'Obszar jest już pusty' });
  }
});
