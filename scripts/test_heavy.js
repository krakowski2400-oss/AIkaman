require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  const textModel = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
  const imageModel = genAI.getGenerativeModel({ model: 'models/gemini-3-pro-image-preview' });

  try {
    console.log("Testing gemini-2.5-pro with a real prompt...");
    const textResult = await textModel.generateContent("Analyze this product: A bottle of luxury perfume. Give me 2 creative concepts for a photo shoot.");
    console.log("Text Result:", textResult.response.text());

    console.log("\nTesting gemini-3-pro-image-preview with a real prompt...");
    // Since we don't have an image, we'll try just text if it supports it, 
    // or see if it fails with 429 if we spam it.
    for(let i=1; i<=3; i++) {
        try {
            console.log(`Request ${i}...`);
            const imageResult = await imageModel.generateContent("A luxury perfume bottle on a marble table, professional lighting, 8k");
            console.log(`Result ${i}: SUCCESS`);
        } catch (e) {
            console.log(`Result ${i}: ERROR - ${e.message}`);
        }
    }

  } catch (e) {
    console.log("General Error:", e.message);
  }
}

test();