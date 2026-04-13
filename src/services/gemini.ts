import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Inicjalizacja klienta Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function processImageGeneration(
  taskId: string, 
  imagePaths: string[], 
  stylePrompt: string, 
  aspectRatio: string = "1:1", 
  imageSize: string = "4K",
  onProgress?: (text: string) => void
): Promise<string[]> {
  if (onProgress) onProgress('Analizowanie zdjęcia produktu (Gemini)...');
  console.log(`Zadanie ${taskId}: Rozpoczynam inteligentną analizę produktu...`);
  
  const textModel = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
  const imageModel = genAI.getGenerativeModel({ model: 'models/gemini-3-pro-image-preview' });

  const imageParts = imagePaths.map(imagePath => {
    // Basic content type detection based on extension
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(imagePath)).toString('base64'),
        mimeType: mimeType,
      }
    };
  });

  // KROK 1: Analiza obrazu i wygenerowanie 4 RÓŻNYCH koncepcji
  const analysisPrompt = `Działaj jako ekspert fotografii produktowej. Przeanalizuj załączone zdjęcia produktu i stwórz 4 UNIKALNE prompty w języku angielskim, aby umieścić ten produkt w nowej scenie o stylu: ${stylePrompt}.
  
  Zasady:
  1. Zidentyfikuj kluczowe cechy produktu (kolor, składniki na etykiecie, materiał).
  2. Każdy prompt musi opisywać inną kompozycję tła pasującą do stylu.
  3. Format: Zwróć TYLKO 4 prompty, każdy w nowej linii, bez numeracji.
  4. Schemat: "[Opis produktu z obrazka], placed on [opis tła], professional lighting, 8k, photorealistic".`;

  const analysisResult = await textModel.generateContent([analysisPrompt, ...imageParts]);
  const promptsText = analysisResult.response.text();
  const individualPrompts = promptsText.split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 10)
    .slice(0, 4);

  console.log(`Zadanie ${taskId}: Wygenerowano ${individualPrompts.length} unikalnych koncepcji.`);

  // KROK 2: Generowanie 4 wariantów (każdy na osobnym prompcie)
  const resultUrls: string[] = [];
  const outputDir = path.join(process.cwd(), 'output', taskId);
  fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < individualPrompts.length; i++) {
    const currentPrompt = individualPrompts[i];
    if (onProgress) onProgress(`Generowanie wariantu ${i+1} z 4...`);
    
    // Dodajemy mały odstęp czasu, aby nie zapchać API (rate limiting)
    if (i > 0) {
      console.log(`Zadanie ${taskId}: Oczekiwanie 2s przed kolejnym wariantem...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Zadanie ${taskId}: Generuję wariant ${i+1} z promptem: ${currentPrompt.substring(0, 40)}...`);

    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        const result = await imageModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: currentPrompt }, ...imageParts] }],
          generationConfig: {
            // @ts-ignore
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: imageSize
            }
          } as any
        });

        const response = await result.response;
        
        // Szukamy obrazu w odpowiedzi
        let foundImage = false;
        for (const candidate of (response as any).candidates || []) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData) {
                const fileName = `variant_v${resultUrls.length + 1}.png`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
                resultUrls.push(`/api/download/${taskId}/${fileName}`);
                foundImage = true;
                success = true;
              }
            }
          }
        }
        
        if (!foundImage) {
            console.warn(`Zadanie ${taskId}: Model nie zwrócił obrazu dla wariantu ${i+1}, próba ${retryCount + 1}`);
            retryCount++;
        }
      } catch (innerErr: any) {
        console.error(`Zadanie ${taskId}: Błąd generowania wariantu ${i+1} (próba ${retryCount + 1}):`, innerErr.message);
        
        if (innerErr.message.includes('429') || innerErr.message.includes('Resource has been exhausted')) {
          const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff: 5s, 10s, 20s
          console.log(`Zadanie ${taskId}: Przekroczono limit (429). Czekam ${waitTime/1000}s przed ponowieniem...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
        } else {
          // Inne błędy (np. safety) przerywają próby dla tego wariantu
          break;
        }
      }
    }
  }

  if (resultUrls.length === 0) {
    throw new Error('Model nie zwrócił żadnego obrazu. Sprawdź filtry bezpieczeństwa lub klucz API.');
  }
  
  return resultUrls;
}

export async function processSlideGeneration(
  taskId: string, 
  slideContent: string, 
  stylePrompt: string, 
  aspectRatio: string = "16:9", 
  imageSize: string = "4K",
  onProgress?: (text: string) => void
): Promise<string[]> {
  if (onProgress) onProgress('Analizowanie treści slajdu (Gemini)...');
  console.log(`Zadanie ${taskId}: Rozpoczynam analizę slajdu...`);
  
  const textModel = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
  const imageModel = genAI.getGenerativeModel({ model: 'models/gemini-3-pro-image-preview' });

  // KROK 1: Analiza tekstu i wygenerowanie 4 RÓŻNYCH koncepcji tła
  const analysisPrompt = `Działaj jako ekspert od designu prezentacji. Przeanalizuj poniższą treść slajdu i stwórz 4 UNIKALNE prompty w języku angielskim, aby wygenerować samo tło wizualne (BEZ TEKSTU) idealnie pasujące do tego slajdu, uwzględniając styl: ${stylePrompt}.
  
  Treść slajdu:
  "${slideContent}"

  Zasady:
  1. Zaproponuj scenę lub obiekty nawiązujące do treści slajdu, ale WYŁĄCZNIE w formie RYSUNKU CZARNYM PISAKIEM (black marker line art, ink sketch) na czystym BIAŁYM tle. ZABRONIONE JEST UMIESZCZANIE TEKSTÓW, liter ani wykresów z napisami.
  2. Rygorystyczna kompozycja: Lewa połowa (50%) obrazu to rysunek, prawa połowa (50%) MUSI być całkowicie pusta (czysta biel, pure white negative space) pod tekst.
  3. Każdy prompt musi opisywać inną koncepcję rysunku pasującą do treści.
  4. Format: Zwróć TYLKO 4 prompty, każdy w nowej linii, bez numeracji.
  5. Schemat promptu: "Black marker line art drawing on pure white background of [opis rysunku nawiązującego do treści], placed strictly on the left side of the image, the right half of the image is completely empty pure white negative space, minimalistic sketch style, high contrast".`;

  const analysisResult = await textModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }]
  });
  const promptsText = analysisResult.response.text();
  const individualPrompts = promptsText.split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 10)
    .slice(0, 4);

  console.log(`Zadanie ${taskId}: Wygenerowano ${individualPrompts.length} unikalnych koncepcji tła.`);

  // KROK 2: Generowanie 4 wariantów
  const resultUrls: string[] = [];
  const outputDir = path.join(process.cwd(), 'output', taskId);
  fs.mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < individualPrompts.length; i++) {
    const currentPrompt = individualPrompts[i];
    if (onProgress) onProgress(`Generowanie wariantu ${i+1} z 4...`);
    
    if (i > 0) {
      console.log(`Zadanie ${taskId}: Oczekiwanie 2s przed kolejnym wariantem...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Zadanie ${taskId}: Generuję wariant ${i+1} z promptem: ${currentPrompt.substring(0, 40)}...`);

    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        const result = await imageModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
          generationConfig: {
            // @ts-ignore
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: imageSize
            }
          } as any
        });

        const response = await result.response;
        
        let foundImage = false;
        for (const candidate of (response as any).candidates || []) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData) {
                const fileName = `variant_v${resultUrls.length + 1}.png`;
                const filePath = path.join(outputDir, fileName);
                fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
                resultUrls.push(`/api/download/${taskId}/${fileName}`);
                foundImage = true;
                success = true;
              }
            }
          }
        }
        
        if (!foundImage) {
            console.warn(`Zadanie ${taskId}: Model nie zwrócił obrazu dla wariantu ${i+1}, próba ${retryCount + 1}`);
            retryCount++;
        }
      } catch (innerErr: any) {
        console.error(`Zadanie ${taskId}: Błąd generowania wariantu ${i+1} (próba ${retryCount + 1}):`, innerErr.message);
        
        if (innerErr.message.includes('429') || innerErr.message.includes('Resource has been exhausted')) {
          const waitTime = Math.pow(2, retryCount) * 5000;
          console.log(`Zadanie ${taskId}: Przekroczono limit (429). Czekam ${waitTime/1000}s przed ponowieniem...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
        } else {
          break;
        }
      }
    }
  }

  if (resultUrls.length === 0) {
    throw new Error('Model nie zwrócił żadnego obrazu. Sprawdź filtry bezpieczeństwa lub klucz API.');
  }
  
  return resultUrls;
}
