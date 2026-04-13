require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  const names = ['models/gemini-2.5-pro', 'models/gemini-3-pro-image-preview'];
  for (const name of names) {
    console.log(`Testing model: ${name}`);
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent("ping");
      console.log(`Success:`, result.response.text());
    } catch (e) {
      console.log(`Error for ${name}:`, e.message);
    }
  }
}

test();