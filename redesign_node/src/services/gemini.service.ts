import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private readonly TEXT_MODEL = 'gemini-2.5-pro';
  private readonly IMAGE_MODEL = 'gemini-3-pro-image-preview';

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Pomocnicza funkcja do konwersji pliku na format Gemini
   */
  private fileToGenerativePart(filePath: string, mimeType: string) {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
        mimeType,
      },
    };
  }

  /**
   * KROK 1: Analiza obrazu i generowanie 4 promptów (zastępuje logic_analyze_product)
   */
  async generatePrompts(productName: string, imagePaths: string[]): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.TEXT_MODEL });

      const prompt = `Działaj jako ekspert fotografii produktowej i inżynier promptów AI. Twoim zadaniem jest stworzenie profesjonalnych promptów do wygenerowania scen z produktem dla produktu widocznego na załączonym zdjęciu. Nazwa produktu (czasami też dodatkowe informacje): ${productName}.

KROK 1: ANALIZA OBRAZU
Dokładnie przeanalizuj załączone zdjęcie. Zidentyfikuj:
1. Wygląd produktu: kształt opakowania, kolor, materiał (szkło, plastik, metal?), kolor etykiety i tekstu.
2. Sugestie z etykiety: czy są tam nazwy owoców, roślin, minerałów lub słowa kluczowe (np. "Gold", "Eco", "Aqua")? To posłuży do doboru motywu tła.

KROK 2: OPRACOWANIE KONCEPCJI
Na podstawie analizy opracuj 4 różne koncepcje tła, które najlepiej sprzedadzą ten konkretny produkt.

KROK 3: GENEROWANIE PROMPTÓW (OUTPUT)
Wygeneruj 4 gotowe prompty w języku angielskim. Każdy prompt musi być skonstruowany wg schematu:
"[Szczegółowy opis wizualny produktu], placed on [opis tła i podłoża], surrounded by [elementy dodatkowe], [rodzaj oświetlenia], [styl: 8k, photorealistic, product photography, sharp focus, depth of field]".

WAŻNE: Zwróć TYLKO 4 prompty, każdy w nowej linii, bez numeracji, bez dodatkowych komentarzy.

FORMAT ODPOWIEDZI:
[Prompt 1]
[Prompt 2]
[Prompt 3]
[Prompt 4]`;

      const imageParts = imagePaths.map(p => this.fileToGenerativePart(p, 'image/jpeg'));
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      return text.split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 20 && !p.startsWith('#') && !p.startsWith('*'))
        .slice(0, 4);
    } catch (error) {
      console.error('❌ Błąd analizy Gemini:', error);
      return [];
    }
  }

  /**
   * KROK 2: Generowanie obrazu na podstawie promptu (zastępuje logic_generate_image)
   */
  async generateImage(prompt: string, referenceImagePaths: string[], outputPath: string): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.IMAGE_MODEL });

      const imageParts = referenceImagePaths.slice(0, 5).map(p => this.fileToGenerativePart(p, 'image/jpeg'));
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: {
          // @ts-ignore - parametry specyficzne dla Imagen 3 w nowym API
          imageConfig: {
            aspectRatio: "2:3",
            imageSize: "4K"
          }
        }
      });

      const response = await result.response;
      
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            fs.writeFileSync(outputPath, buffer);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Błąd generowania obrazu Gemini:', error);
      return false;
    }
  }
}
