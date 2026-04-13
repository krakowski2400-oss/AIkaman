require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  try {
    const modelsResult = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // dummy to get to SDK object
    // Wait, getGenerativeModel doesn't list models. The genAI object doesn't have listModels?
    // Actually the SDK @google/generative-ai version 0.24.1 might have listModels?
    // Let's check docs or try a different approach.
    
    // Standard names for Gemini 1.5
    const names = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
    for (const name of names) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        await model.generateContent("ping");
        console.log(`Model ${name}: SUCCESS`);
      } catch (e) {
        console.log(`Model ${name}: FAIL - ${e.message}`);
      }
    }
  } catch (err) {
    console.error('Błąd:', err.message);
  }
}

listModels();