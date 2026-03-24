import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

async function listModels() {
  const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || '');
  try {
    const models = await genAI.listModels();
    console.log('Dostępne modele dla Twojego klucza:');
    models.forEach((m: any) => {
      console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (err) {
    console.error('Błąd podczas pobierania listy modeli:', err);
  }
}

listModels();