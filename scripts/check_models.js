require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function listModels() {
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await genAI.models.list();
    console.log('Odpowiedź z API:', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('Błąd:', err.message);
  }
}

listModels();