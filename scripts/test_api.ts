import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("Hello");
    console.log('Test połączenia (Gemini 1.5 Flash): SUCCESS');
    console.log('Response:', result.response.text());
  } catch (err: any) {
    console.error('Błąd testu połączenia:', err.message);
    if (err.message.includes('429')) {
      console.error('LIMIT PRZEKROCZONY (Rate Limit / Too Much Traffic)');
    }
  }
}

listModels();