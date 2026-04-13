require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  // SDK doesn't have listModels in the main export for node in some versions.
  // Let's try to just generate something with a known good model and correct prefix.
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  try {
    const result = await model.generateContent("Say hello");
    console.log("Success:", result.response.text());
  } catch (e) {
    console.log("Error:", e.message);
    if (e.response) {
        console.log("Response status:", e.response.status);
    }
  }
}

test();