"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processImageGeneration = processImageGeneration;
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Inicjalizacja klienta Gemini
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function processImageGeneration(taskId, imagePaths, stylePrompt, aspectRatio = "1:1", imageSize = "4K", onProgress) {
    if (onProgress)
        onProgress('Analizowanie zdjęcia produktu (Gemini)...');
    console.log(`Zadanie ${taskId}: Rozpoczynam inteligentną analizę produktu...`);
    const textModel = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
    const imageModel = genAI.getGenerativeModel({ model: 'models/gemini-3-pro-image-preview' });
    const imageParts = imagePaths.map(imagePath => {
        // Basic content type detection based on extension
        const ext = path_1.default.extname(imagePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png')
            mimeType = 'image/png';
        else if (ext === '.webp')
            mimeType = 'image/webp';
        return {
            inlineData: {
                data: Buffer.from(fs_1.default.readFileSync(imagePath)).toString('base64'),
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
    const resultUrls = [];
    const outputDir = path_1.default.join(process.cwd(), 'output', taskId);
    fs_1.default.mkdirSync(outputDir, { recursive: true });
    for (let i = 0; i < individualPrompts.length; i++) {
        const currentPrompt = individualPrompts[i];
        if (onProgress)
            onProgress(`Generowanie wariantu ${i + 1} z 4...`);
        console.log(`Zadanie ${taskId}: Generuję wariant ${i + 1} z promptem: ${currentPrompt.substring(0, 40)}...`);
        try {
            const result = await imageModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: currentPrompt }, ...imageParts] }],
                generationConfig: {
                    // @ts-ignore
                    imageConfig: {
                        aspectRatio: aspectRatio,
                        imageSize: imageSize
                    }
                }
            });
            const response = await result.response;
            // Szukamy obrazu w odpowiedzi
            for (const candidate of response.candidates || []) {
                if (candidate.content && candidate.content.parts) {
                    for (const part of candidate.content.parts) {
                        if (part.inlineData) {
                            const fileName = `variant_v${resultUrls.length + 1}.png`;
                            const filePath = path_1.default.join(outputDir, fileName);
                            fs_1.default.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
                            resultUrls.push(`/api/download/${taskId}/${fileName}`);
                        }
                    }
                }
            }
        }
        catch (innerErr) {
            console.error(`Zadanie ${taskId}: Błąd generowania wariantu ${i + 1}:`, innerErr.message);
        }
    }
    if (resultUrls.length === 0) {
        throw new Error('Model nie zwrócił żadnego obrazu. Sprawdź filtry bezpieczeństwa lub klucz API.');
    }
    return resultUrls;
}
